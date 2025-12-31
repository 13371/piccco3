const express = require('express');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getUserData, saveUserData, updateUserData } = require('../store/userDataStore');

const router = express.Router();

// 直接从环境变量读取 JWT_SECRET，与 auth.js 保持一致
const JWT_SECRET = process.env.JWT_SECRET;
const FINAL_JWT_SECRET = JWT_SECRET || 'dev-secret-change-me-in-production';

// JWT 验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: '未授权，请先登录' });
  }

  jwt.verify(token, FINAL_JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token无效或已过期' });
    }
    req.user = user;
    next();
  });
};

/**
 * @swagger
 * /api/v1/data/sync:
 *   get:
 *     summary: 获取用户数据（完整同步）
 *     tags: [数据同步]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     folders:
 *                       type: array
 *                     notes:
 *                       type: array
 *                     urls:
 *                       type: array
 *                     trash:
 *                       type: array
 *       401:
 *         description: 未授权
 */
// 获取用户数据（完整同步）
router.get('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    const userData = await getUserData(userId);
    
    res.json({
      success: true,
      data: {
        folders: userData.folders || [],
        notes: userData.notes || [],
        urls: userData.urls || [],
        trash: userData.trash || [],
        settings: userData.settings || {
          sortMode: 'updatedAt',
          fontSize: 'medium',
          language: 'zh',
          nightMode: 'auto',
        },
        lastSyncAt: userData.lastSyncAt || null,
      },
    });
  } catch (e) {
    logger.error('data', 'get sync error:', e);
    res.status(500).json({ message: '获取数据失败' });
  }
});

// 同步用户数据到服务器（完整同步）
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { folders, notes, urls, trash, settings } = req.body || {};
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    // 验证数据格式
    if (!Array.isArray(folders) || !Array.isArray(notes) || !Array.isArray(urls) || !Array.isArray(trash)) {
      return res.status(400).json({ message: '数据格式不正确' });
    }
    
    // 限制数据大小（防止DoS攻击）
    const totalItems = folders.length + notes.length + urls.length + trash.length;
    if (totalItems > 10000) {
      return res.status(400).json({ message: '数据量过大，请分批同步' });
    }
    
    // 获取当前数据，保留设置（如果请求中没有提供设置，保留现有设置）
    const currentData = await getUserData(userId);
    
    const userData = {
      folders: folders || [],
      notes: notes || [],
      urls: urls || [],
      trash: trash || [],
      settings: settings || currentData.settings || {
        sortMode: 'updatedAt',
        fontSize: 'medium',
        language: 'zh',
        nightMode: 'auto',
      },
    };
    
    const savedData = await saveUserData(userId, userData);
    
    res.json({
      success: true,
      message: '数据同步成功',
      data: {
        lastSyncAt: savedData.lastSyncAt,
      },
    });
  } catch (e) {
    logger.error('data', 'sync error:', e);
    res.status(500).json({ message: '同步数据失败' });
  }
});

// 获取最后同步时间
router.get('/sync/last', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    const userData = await getUserData(userId);
    
    res.json({
      success: true,
      lastSyncAt: userData.lastSyncAt || null,
    });
  } catch (e) {
    logger.error('data', 'get last sync error:', e);
    res.status(500).json({ message: '获取同步时间失败' });
  }
});

// 获取用户设置
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    const userData = await getUserData(userId);
    
    res.json({
      success: true,
      settings: userData.settings || {
        sortMode: 'updatedAt',
        fontSize: 'medium',
        language: 'zh',
        nightMode: 'auto',
      },
    });
  } catch (e) {
    logger.error('data', 'get settings error:', e);
    res.status(500).json({ message: '获取设置失败' });
  }
});

// 更新用户设置
router.patch('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sortMode, fontSize, language, nightMode } = req.body || {};
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    // 获取当前数据
    const currentData = await getUserData(userId);
    const currentSettings = currentData.settings || {
      sortMode: 'updatedAt',
      fontSize: 'medium',
      language: 'zh',
      nightMode: 'auto',
    };
    
    // 构建更新对象（只更新提供的字段）
    const updatedSettings = {
      ...currentSettings,
    };
    
    if (sortMode !== undefined) {
      if (!['updatedAt', 'name'].includes(sortMode)) {
        return res.status(400).json({ message: '无效的排序模式' });
      }
      updatedSettings.sortMode = sortMode;
    }
    
    if (fontSize !== undefined) {
      if (!['small', 'medium', 'large'].includes(fontSize)) {
        return res.status(400).json({ message: '无效的字体大小' });
      }
      updatedSettings.fontSize = fontSize;
    }
    
    if (language !== undefined) {
      if (!['zh', 'en'].includes(language)) {
        return res.status(400).json({ message: '无效的语言' });
      }
      updatedSettings.language = language;
    }
    
    if (nightMode !== undefined) {
      if (!['day', 'night', 'auto'].includes(nightMode)) {
        return res.status(400).json({ message: '无效的夜间模式' });
      }
      updatedSettings.nightMode = nightMode;
    }
    
    // 更新数据
    const updatedData = await updateUserData(userId, {
      settings: updatedSettings,
    });
    
    res.json({
      success: true,
      message: '设置更新成功',
      settings: updatedData.settings,
    });
  } catch (e) {
    logger.error('data', 'update settings error:', e);
    res.status(500).json({ message: '更新设置失败' });
  }
});

module.exports = router;



