const express = require('express');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { userDataStoreAdapter } = require('../store/storageAdapter');
const { addLog, getLogs, clearLogs, getLogStats } = require('../store/logStore');

/**
 * 清理重复记录：只保留 updatedAt 最大的一条
 * 强制要求：确保 id 唯一性（模拟 UNIQUE(userId, id) 约束）
 * 绝对不允许创建新记录，只允许更新同一个 id 的那条记录
 */
/**
 * 去重函数：确保ID唯一性
 * 优先级：
 * 1. 删除操作（isDeleted = true）总是优先
 * 2. updatedAt 更大的
 */
function deduplicateById(list = []) {
  const map = new Map();
  list.forEach((item) => {
    if (!item.id) {
      return; // 跳过没有 id 的项
    }
    if (!map.has(item.id)) {
      map.set(item.id, item);
    } else {
      const old = map.get(item.id);
      
      // 优先考虑删除状态
      const isDeleteOperation = item.isDeleted === true && !old.isDeleted;
      const oldIsDeleted = old.isDeleted === true && !item.isDeleted;
      
      if (isDeleteOperation) {
        // 新项是删除操作，优先使用
        map.set(item.id, item);
      } else if (oldIsDeleted) {
        // 旧项是删除操作，保留旧项
        map.set(item.id, old);
      } else {
        // 两者都删除或都未删除，使用 updatedAt 更大的
        if ((item.updatedAt || 0) > (old.updatedAt || 0)) {
          map.set(item.id, item);
        }
      }
    }
  });
  return Array.from(map.values());
}

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
    
    const userData = await userDataStoreAdapter.getUserData(userId);
    
    // 强制要求：先清理重复记录，确保 id 唯一性（模拟 UNIQUE(userId, id) 约束）
    // 同步逻辑：保留所有数据（包括已删除的），列表查询时会过滤
    const allFolders = deduplicateById(userData.folders || []);
    const allNotes = deduplicateById(userData.notes || []);
    const allUrls = deduplicateById(userData.urls || []);
    
    // 基于 isDeleted 字段过滤数据（不再使用 trash 数组）
    // 获取永久删除的文件夹ID列表（如果存在）
    const permanentlyDeletedFolderIds = new Set(
      (userData.permanentlyDeletedFolderIds || [])
        .filter(Boolean)
    );
    
    // 重要修复：同步接口必须返回所有数据（包括已删除的），以便前端能正确同步删除状态
    // 前端会根据 isDeleted 字段自行过滤显示，但同步时需要知道哪些项被删除了
    // 只过滤永久删除的文件夹
    const foldersToReturn = allFolders
      .filter((folder) => !permanentlyDeletedFolderIds.has(folder.id))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    // 返回所有笔记（包括已删除的），前端会自行过滤
    const notesToReturn = allNotes
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    // 返回所有网址（包括已删除的），前端会自行过滤
    const urlsToReturn = allUrls
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    // 统计已删除的项（用于日志）
    const deletedFoldersCount = foldersToReturn.filter((f) => f.isDeleted).length;
    const deletedNotesCount = notesToReturn.filter((n) => n.isDeleted).length;
    const deletedUrlsCount = urlsToReturn.filter((u) => u.isDeleted).length;
    
    if (deletedFoldersCount > 0 || deletedNotesCount > 0 || deletedUrlsCount > 0) {
      logger.info('data', `同步接口返回数据（包含已删除的项）: folders=${foldersToReturn.length} (已删除: ${deletedFoldersCount}), notes=${notesToReturn.length} (已删除: ${deletedNotesCount}), urls=${urlsToReturn.length} (已删除: ${deletedUrlsCount})`);
    }
    
    res.json({
      success: true,
      data: {
        folders: foldersToReturn, // 包含已删除的文件夹
        notes: notesToReturn, // 包含已删除的笔记
        urls: urlsToReturn, // 包含已删除的网址
        trash: [], // 保留 trash 数组（向后兼容），但不再使用
        permanentlyDeletedFolderIds: Array.from(permanentlyDeletedFolderIds), // 返回永久删除列表
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
    const { folders, notes, urls, trash, settings, permanentlyDeletedFolderIds } = req.body || {};
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    // 验证数据格式（trash 数组不再必需，但保留向后兼容）
    if (!Array.isArray(folders) || !Array.isArray(notes) || !Array.isArray(urls)) {
      return res.status(400).json({ message: '数据格式不正确' });
    }
    
    // 限制数据大小（防止DoS攻击）
    const totalItems = folders.length + notes.length + urls.length;
    if (totalItems > 10000) {
      return res.status(400).json({ message: '数据量过大，请分批同步' });
    }
    
    // 获取当前数据，保留设置（如果请求中没有提供设置，保留现有设置）
    const currentData = await userDataStoreAdapter.getUserData(userId);
    
    // 基于 isDeleted 字段过滤数据（不再使用 trash 数组）
    // 获取永久删除的文件夹ID列表（合并客户端和服务器端）
    const clientPermanentlyDeletedIds = new Set(
      (permanentlyDeletedFolderIds || [])
        .filter(Boolean)
    );
    const serverPermanentlyDeletedIds = new Set(
      (currentData.permanentlyDeletedFolderIds || [])
        .filter(Boolean)
    );
    const allPermanentlyDeletedIds = new Set([
      ...Array.from(clientPermanentlyDeletedIds),
      ...Array.from(serverPermanentlyDeletedIds),
    ]);
    
    // 强制要求：同步唯一判断标准是 updatedAt
    // 后端必须保存所有数据（包括已删除的），不能过滤掉已删除的数据
    // 否则其他设备无法同步到删除操作
    
    // 合并客户端和服务器端的数据，严格按照 updatedAt 判断
    const folderMap = new Map();
    const noteMap = new Map();
    const urlMap = new Map();
    
    // 先添加服务器端当前数据
    (currentData.folders || []).forEach((folder) => {
      folderMap.set(folder.id, folder);
    });
    (currentData.notes || []).forEach((note) => {
      noteMap.set(note.id, note);
    });
    (currentData.urls || []).forEach((url) => {
      urlMap.set(url.id, url);
    });
    
    // 再添加客户端数据，如果 updatedAt 更大，则覆盖
    // 强制要求：禁止默认 isDeleted = false
    // 如果 incoming 未提供 isDeleted，保持原值
    // 重要：删除操作（isDeleted = true）必须接受，即使 updatedAt 更小
    (folders || []).forEach((folder) => {
      // 跳过永久删除的文件夹
      if (allPermanentlyDeletedIds.has(folder.id)) {
        return;
      }
      
      const existing = folderMap.get(folder.id);
      // 重要：如果客户端发送的是删除操作（isDeleted = true），必须接受，即使 updatedAt 更小
      // 这确保删除操作能够同步到服务器
      const isDeleteOperation = folder.isDeleted === true;
      // 修复：删除操作应该总是被接受，即使 existing 不存在或 existing.isDeleted 已经是 true
      // 这确保删除操作能够同步到服务器，即使服务器端已经有该文件夹
      const shouldUpdate = !existing || 
                          (folder.updatedAt || 0) > (existing.updatedAt || 0) ||
                          (isDeleteOperation && (!existing || !existing.isDeleted));
      
      if (shouldUpdate) {
        // 如果 incoming 未提供 isDeleted 或 deletedAt，保持原值
        if (existing && folder.isDeleted === undefined) {
          folder.isDeleted = existing.isDeleted;
        }
        if (existing && folder.deletedAt === undefined) {
          folder.deletedAt = existing.deletedAt;
        }
        folderMap.set(folder.id, folder);
      }
    });
    
    (notes || []).forEach((note) => {
      const existing = noteMap.get(note.id);
      // 重要：如果客户端发送的是删除操作（isDeleted = true），必须接受，即使 updatedAt 更小
      // 这确保删除操作能够同步到服务器
      const isDeleteOperation = note.isDeleted === true;
      // 修复：删除操作应该总是被接受，即使 existing 不存在或 existing.isDeleted 已经是 true
      // 这确保删除操作能够同步到服务器，即使服务器端已经有该笔记
      const shouldUpdate = !existing || 
                          (note.updatedAt || 0) > (existing.updatedAt || 0) ||
                          (isDeleteOperation && (!existing || !existing.isDeleted));
      
      // 添加日志以便调试删除操作
      if (isDeleteOperation) {
        console.log('[后端同步] 检测到删除笔记操作:', {
          noteId: note.id,
          isDeleted: note.isDeleted,
          deletedAt: note.deletedAt,
          updatedAt: note.updatedAt,
          existing: existing ? {
            isDeleted: existing.isDeleted,
            updatedAt: existing.updatedAt,
          } : null,
          shouldUpdate,
        });
      }
      
      if (shouldUpdate) {
        // 如果 incoming 未提供 isDeleted 或 deletedAt，保持原值
        if (existing && note.isDeleted === undefined) {
          note.isDeleted = existing.isDeleted;
        }
        if (existing && note.deletedAt === undefined) {
          note.deletedAt = existing.deletedAt;
        }
        noteMap.set(note.id, note);
        
        if (isDeleteOperation) {
          console.log('[后端同步] 已保存删除的笔记:', {
            noteId: note.id,
            isDeleted: note.isDeleted,
            deletedAt: note.deletedAt,
            updatedAt: note.updatedAt,
          });
        }
      } else if (isDeleteOperation) {
        console.warn('[后端同步] 删除笔记操作被跳过:', {
          noteId: note.id,
          noteUpdatedAt: note.updatedAt,
          existingUpdatedAt: existing?.updatedAt,
          existingIsDeleted: existing?.isDeleted,
        });
      }
    });
    
    (urls || []).forEach((url) => {
      const existing = urlMap.get(url.id);
      // 重要：如果客户端发送的是删除操作（isDeleted = true），必须接受，即使 updatedAt 更小
      // 这确保删除操作能够同步到服务器
      const isDeleteOperation = url.isDeleted === true;
      // 修复：删除操作应该总是被接受，即使 existing 不存在或 existing.isDeleted 已经是 true
      // 这确保删除操作能够同步到服务器，即使服务器端已经有该网址
      const shouldUpdate = !existing || 
                          (url.updatedAt || 0) > (existing.updatedAt || 0) ||
                          (isDeleteOperation && (!existing || !existing.isDeleted));
      
      // 添加日志以便调试删除操作
      if (isDeleteOperation) {
        console.log('[后端同步] 检测到删除网址操作:', {
          urlId: url.id,
          isDeleted: url.isDeleted,
          deletedAt: url.deletedAt,
          updatedAt: url.updatedAt,
          existing: existing ? {
            isDeleted: existing.isDeleted,
            updatedAt: existing.updatedAt,
          } : null,
          shouldUpdate,
        });
      }
      
      if (shouldUpdate) {
        // 如果 incoming 未提供 isDeleted 或 deletedAt，保持原值
        if (existing && url.isDeleted === undefined) {
          url.isDeleted = existing.isDeleted;
        }
        if (existing && url.deletedAt === undefined) {
          url.deletedAt = existing.deletedAt;
        }
        urlMap.set(url.id, url);
        
        if (isDeleteOperation) {
          console.log('[后端同步] 已保存删除的网址:', {
            urlId: url.id,
            isDeleted: url.isDeleted,
            deletedAt: url.deletedAt,
            updatedAt: url.updatedAt,
          });
        }
      } else if (isDeleteOperation) {
        console.warn('[后端同步] 删除网址操作被跳过:', {
          urlId: url.id,
          urlUpdatedAt: url.updatedAt,
          existingUpdatedAt: existing?.updatedAt,
          existingIsDeleted: existing?.isDeleted,
        });
      }
    });
    
    // 转换为数组
    const finalFolders = Array.from(folderMap.values());
    const finalNotes = Array.from(noteMap.values());
    const finalUrls = Array.from(urlMap.values());
    
    // 检查是否有重复的 id（确保 id 唯一性）
    const folderIdSet = new Set();
    const duplicateFolderIds = [];
    finalFolders.forEach((folder) => {
      if (folderIdSet.has(folder.id)) {
        duplicateFolderIds.push(folder.id);
      } else {
        folderIdSet.add(folder.id);
      }
    });
    
    if (duplicateFolderIds.length > 0) {
      logger.error('data', `检测到重复的文件夹ID: ${duplicateFolderIds.join(', ')}`);
      // 去重：考虑删除状态，确保已删除的项不会被未删除的版本覆盖
      // 优先级：1. 删除操作（isDeleted = true）总是被接受
      //         2. updatedAt 更大的
      const deduplicatedFolderMap = new Map();
      finalFolders.forEach((folder) => {
        const existing = deduplicatedFolderMap.get(folder.id);
        if (!existing) {
          deduplicatedFolderMap.set(folder.id, folder);
        } else {
          // 如果 incoming 是删除操作，且 existing 未删除，使用 incoming
          const isDeleteOperation = folder.isDeleted === true && !existing.isDeleted;
          // 如果 existing 是删除操作，且 incoming 未删除，保留 existing
          const existingIsDeleted = existing.isDeleted === true && !folder.isDeleted;
          
          if (isDeleteOperation) {
            // incoming 是删除操作，优先使用
            deduplicatedFolderMap.set(folder.id, folder);
          } else if (existingIsDeleted) {
            // existing 是删除操作，保留 existing
            deduplicatedFolderMap.set(folder.id, existing);
          } else {
            // 两者都删除或都未删除，使用 updatedAt 更大的
            if ((folder.updatedAt || 0) > (existing.updatedAt || 0)) {
              deduplicatedFolderMap.set(folder.id, folder);
            } else {
              deduplicatedFolderMap.set(folder.id, existing);
            }
          }
        }
      });
      const deduplicatedFolders = Array.from(deduplicatedFolderMap.values());
      logger.warn('data', `已去重文件夹（考虑删除状态）: ${finalFolders.length} -> ${deduplicatedFolders.length}`);
      // 使用去重后的数据
      finalFolders.length = 0;
      finalFolders.push(...deduplicatedFolders);
    }
    
    // 强制要求：所有写操作必须更新 updatedAt
    // 确保所有文件夹、笔记、网址都有 updatedAt 字段
    const now = Date.now();
    const finalFoldersWithUpdatedAt = finalFolders.map((folder) => ({
      ...folder,
      updatedAt: folder.updatedAt || now,
    }));
    const finalNotesWithUpdatedAt = finalNotes.map((note) => ({
      ...note,
      updatedAt: note.updatedAt || now,
    }));
    const finalUrlsWithUpdatedAt = finalUrls.map((url) => ({
      ...url,
      updatedAt: url.updatedAt || now,
    }));
    
    // 记录同步的数据统计
    const deletedFoldersCount = finalFoldersWithUpdatedAt.filter((f) => f.isDeleted).length;
    const deletedNotesCount = finalNotesWithUpdatedAt.filter((n) => n.isDeleted).length;
    const deletedUrlsCount = finalUrlsWithUpdatedAt.filter((u) => u.isDeleted).length;
    if (deletedFoldersCount > 0 || deletedNotesCount > 0 || deletedUrlsCount > 0) {
      logger.info('data', `同步数据（包含已删除的项）: folders=${finalFoldersWithUpdatedAt.length} (已删除: ${deletedFoldersCount}), notes=${finalNotesWithUpdatedAt.length} (已删除: ${deletedNotesCount}), urls=${finalUrlsWithUpdatedAt.length} (已删除: ${deletedUrlsCount})`);
    }
    
    const userData = {
      folders: finalFoldersWithUpdatedAt,
      notes: finalNotesWithUpdatedAt,
      urls: finalUrlsWithUpdatedAt,
      trash: [], // 保留 trash 数组（向后兼容），但不再使用
      permanentlyDeletedFolderIds: Array.from(allPermanentlyDeletedIds), // 保存永久删除列表
      settings: settings || currentData.settings || {
        sortMode: 'updatedAt',
        fontSize: 'medium',
        language: 'zh',
        nightMode: 'auto',
      },
    };
    
    logger.info('data', `保存用户数据: folders=${finalFoldersWithUpdatedAt.length}, notes=${finalNotesWithUpdatedAt.length}, urls=${finalUrlsWithUpdatedAt.length}, permanentlyDeletedFolderIds=${allPermanentlyDeletedIds.size}`);
    
    const savedData = await userDataStoreAdapter.saveUserData(userId, userData);
    
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
    
    const userData = await userDataStoreAdapter.getUserData(userId);
    
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
    
    const userData = await userDataStoreAdapter.getUserData(userId);
    
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
    const currentData = await userDataStoreAdapter.getUserData(userId);
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
    const updatedData = await userDataStoreAdapter.updateUserData(userId, {
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

/**
 * 删除文件夹接口（软删除 + 防止重复）
 * 强制要求：
 * 1. 绝对不允许创建新记录，只允许更新同一个 id 的那条记录
 * 2. 保证同 id 永远唯一
 * 3. 软删除文件夹（isDeleted = true, deletedAt = now, updatedAt = now）
 * 4. 同时软删除文件夹内的所有笔记和网址
 * POST /api/v1/data/folder/delete
 */
router.post('/folder/delete', authenticateToken, async (req, res) => {
  try {
    const { folderId } = req.body;
    const userId = req.user.id;
    const now = Date.now();

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }

    if (!folderId) {
      return res.status(400).json({ message: '文件夹ID无效' });
    }

    const userData = await userDataStoreAdapter.getUserData(userId);

    // --- 第一步：按 id 去重（非常关键）---
    const folders = deduplicateById(userData.folders || []);

    // 记录调试信息（同时输出到 console 和 logger）
    console.log(`[删除文件夹] 请求: folderId=${folderId}, userId=${userId}, 总文件夹数=${folders.length}`);
    console.log(`[删除文件夹] 所有文件夹ID:`, folders.map(f => ({ id: f.id, name: f.name, isDeleted: f.isDeleted || false })));
    logger.info('data', `删除文件夹请求: folderId=${folderId}, userId=${userId}, 总文件夹数=${folders.length}`);
    
    // --- 第二步：找到要删除的文件夹（包括已删除的）---
    const target = folders.find((f) => f.id === folderId);

    if (!target) {
      // 记录详细的调试信息
      const folderIds = folders.map(f => f.id).slice(0, 10); // 只显示前10个ID
      const errorMsg = `删除文件夹失败: folderId=${folderId} 不存在，现有文件夹ID示例: ${folderIds.join(', ')}`;
      console.error(`[删除文件夹] ${errorMsg}`);
      console.error(`[删除文件夹] 请求的folderId类型:`, typeof folderId, `值:`, JSON.stringify(folderId));
      logger.warn('data', errorMsg);
      addLog(errorMsg, 'warn');
      return res.status(404).json({ message: '文件夹不存在' });
    }
    
    console.log(`[删除文件夹] 找到文件夹: id=${target.id}, name=${target.name}, isDeleted=${target.isDeleted || false}`);
    logger.info('data', `找到文件夹: id=${target.id}, name=${target.name}, isDeleted=${target.isDeleted || false}`);

    // --- 第三步：只更新这一条（不新增记录）---
    const updatedFolders = folders.map((f) =>
      f.id === folderId
        ? {
            ...f,
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
          }
        : f
    );

    const logMessage = `删除后 folders = ${JSON.stringify(updatedFolders, null, 2)}`;
    console.log(logMessage);
    addLog(logMessage, 'info');

    // 同时软删除文件夹内的所有笔记和网址
    const notes = deduplicateById(userData.notes || []);
    const urls = deduplicateById(userData.urls || []);

    const updatedNotes = notes.map((n) =>
      n.folderId === folderId && !n.isDeleted
        ? { ...n, isDeleted: true, deletedAt: now, updatedAt: now }
        : n
    );

    const updatedUrls = urls.map((u) =>
      u.folderId === folderId && !u.isDeleted
        ? { ...u, isDeleted: true, deletedAt: now, updatedAt: now }
        : u
    );

    await userDataStoreAdapter.saveUserData(userId, {
      ...userData,
      folders: updatedFolders,
      notes: updatedNotes,
      urls: updatedUrls,
    });

    logger.info('data', `软删除文件夹: folderId=${folderId}, userId=${userId}`);

    res.json({ success: true });
  } catch (e) {
    logger.error('data', 'delete folder error:', e);
    res.status(500).json({ message: '删除文件夹失败' });
  }
});

/**
 * 删除文件夹接口（兼容旧版本）
 * DELETE /api/v1/data/folders/:folderId
 */
router.delete('/folders/:folderId', authenticateToken, async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;
    const now = Date.now();

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }

    if (!folderId) {
      return res.status(400).json({ message: '文件夹ID无效' });
    }

    const userData = await userDataStoreAdapter.getUserData(userId);

    // --- 第一步：按 id 去重（非常关键）---
    const folders = deduplicateById(userData.folders || []);

    // --- 第二步：找到要删除的文件夹 ---
    const target = folders.find((f) => f.id === folderId);

    if (!target) {
      return res.status(404).json({ message: '文件夹不存在' });
    }

    // --- 第三步：只更新这一条（不新增记录）---
    const updatedFolders = folders.map((f) =>
      f.id === folderId
        ? {
            ...f,
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
          }
        : f
    );

    const logMessage = `删除后 folders = ${JSON.stringify(updatedFolders, null, 2)}`;
    console.log(logMessage);
    addLog(logMessage, 'info');

    // 同时软删除文件夹内的所有笔记和网址
    const notes = deduplicateById(userData.notes || []);
    const urls = deduplicateById(userData.urls || []);

    const updatedNotes = notes.map((n) =>
      n.folderId === folderId && !n.isDeleted
        ? { ...n, isDeleted: true, deletedAt: now, updatedAt: now }
        : n
    );

    const updatedUrls = urls.map((u) =>
      u.folderId === folderId && !u.isDeleted
        ? { ...u, isDeleted: true, deletedAt: now, updatedAt: now }
        : u
    );

    await userDataStoreAdapter.saveUserData(userId, {
      ...userData,
      folders: updatedFolders,
      notes: updatedNotes,
      urls: updatedUrls,
    });

    logger.info('data', `软删除文件夹: folderId=${folderId}, userId=${userId}`);

    res.json({ success: true });
  } catch (e) {
    logger.error('data', 'delete folder error:', e);
    res.status(500).json({ message: '删除文件夹失败' });
  }
});

/**
 * 清理重复记录接口（修复脏数据）
 * 强制要求：只保留 updatedAt 最大的一条记录
 * POST /api/v1/data/cleanup-duplicates
 */
router.post('/cleanup-duplicates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    // 获取当前数据
    const userData = await userDataStoreAdapter.getUserData(userId);
    
    // 清理重复记录
    const beforeFoldersCount = (userData.folders || []).length;
    const beforeNotesCount = (userData.notes || []).length;
    const beforeUrlsCount = (userData.urls || []).length;
    
    const deduplicatedFolders = deduplicateById(userData.folders || []);
    const deduplicatedNotes = deduplicateById(userData.notes || []);
    const deduplicatedUrls = deduplicateById(userData.urls || []);
    
    const afterFoldersCount = deduplicatedFolders.length;
    const afterNotesCount = deduplicatedNotes.length;
    const afterUrlsCount = deduplicatedUrls.length;
    
    const removedFolders = beforeFoldersCount - afterFoldersCount;
    const removedNotes = beforeNotesCount - afterNotesCount;
    const removedUrls = beforeUrlsCount - afterUrlsCount;
    
    if (removedFolders > 0 || removedNotes > 0 || removedUrls > 0) {
      // 保存清理后的数据
      const cleanedData = {
        ...userData,
        folders: deduplicatedFolders,
        notes: deduplicatedNotes,
        urls: deduplicatedUrls,
      };
      
      await saveUserData(userId, cleanedData);
      
      logger.info('data', `清理重复记录完成: folders=${removedFolders}, notes=${removedNotes}, urls=${removedUrls}`);
      
      res.json({
        success: true,
        message: '清理重复记录完成',
        data: {
          removed: {
            folders: removedFolders,
            notes: removedNotes,
            urls: removedUrls,
          },
          before: {
            folders: beforeFoldersCount,
            notes: beforeNotesCount,
            urls: beforeUrlsCount,
          },
          after: {
            folders: afterFoldersCount,
            notes: afterNotesCount,
            urls: afterUrlsCount,
          },
        },
      });
    } else {
      res.json({
        success: true,
        message: '没有发现重复记录',
        data: {
          removed: {
            folders: 0,
            notes: 0,
            urls: 0,
          },
        },
      });
    }
  } catch (e) {
    logger.error('data', 'cleanup duplicates error:', e);
    res.status(500).json({ message: '清理重复记录失败' });
  }
});

/**
 * 列表接口：获取所有未删除的文件夹（支持分页）
 * 强制要求：禁止返回 isDeleted = true 的记录
 * GET /api/v1/data/folders
 * 查询参数：
 *   - page: 页码（默认1）
 *   - pageSize: 每页数量（默认50，最大100）
 */
router.get('/folders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)));

    const data = await userDataStoreAdapter.getUserData(userId);

    const allFolders = deduplicateById(data.folders || [])
      .filter((f) => !f.isDeleted)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // 分页
    const total = allFolders.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const folders = allFolders.slice(start, end);

    res.json({ 
      success: true, 
      data: folders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    logger.error('data', 'get folders error:', e);
    res.status(500).json({ message: '获取文件夹列表失败' });
  }
});

/**
 * 回收站接口：获取所有已删除的文件夹
 * GET /api/v1/data/trash/folders
 */
router.get('/trash/folders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }

    const data = await userDataStoreAdapter.getUserData(userId);

    const trash = deduplicateById(data.folders || [])
      .filter((f) => f.isDeleted)
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

    res.json({ success: true, data: trash });
  } catch (e) {
    logger.error('data', 'get trash folders error:', e);
    res.status(500).json({ message: '获取回收站文件夹失败' });
  }
});

/**
 * 查询文件夹接口（调试用）
 * 查询指定文件夹名的所有记录（包括已删除的）
 * GET /api/v1/data/folders/query?name=文件夹名
 */
router.get('/folders/query', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: '文件夹名不能为空' });
    }
    
    // 获取当前数据
    const userData = await userDataStoreAdapter.getUserData(userId);
    
    // 查询所有匹配的文件夹（包括已删除的）
    // 强制要求：先清理重复记录，确保 id 唯一性（只保留 updatedAt 最大的）
    const allFolders = deduplicateById(userData.folders || []);
    const matchedFolders = allFolders
      .filter((folder) => folder.name === name)
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        isDeleted: folder.isDeleted || false,
        deletedAt: folder.deletedAt || null,
        updatedAt: folder.updatedAt || null,
        createdAt: folder.createdAt || null,
        type: folder.type,
        color: folder.color,
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); // 按 updatedAt DESC 排序
    
    // 强制要求：count 应该 = 1（每个 id 只保留一条记录）
    if (matchedFolders.length > 1) {
      logger.warn('data', `查询到重复的文件夹记录: name=${name}, count=${matchedFolders.length}, 已去重`);
      // 再次去重，只保留 updatedAt 最大的
      const folderMap = new Map();
      matchedFolders.forEach((folder) => {
        const existing = folderMap.get(folder.id);
        if (!existing || (folder.updatedAt || 0) > (existing.updatedAt || 0)) {
          folderMap.set(folder.id, folder);
        }
      });
      const deduplicated = Array.from(folderMap.values());
      logger.warn('data', `去重后: ${matchedFolders.length} -> ${deduplicated.length}`);
      matchedFolders.length = 0;
      matchedFolders.push(...deduplicated);
    }
    
    logger.info('data', `查询文件夹: name=${name}, userId=${userId}, count=${matchedFolders.length}`);
    
    res.json({
      success: true,
      data: {
        name,
        count: matchedFolders.length,
        folders: matchedFolders,
      },
    });
  } catch (e) {
    logger.error('data', 'query folders error:', e);
    res.status(500).json({ message: '查询文件夹失败' });
  }
});

/**
 * 获取笔记列表（支持分页）
 * GET /api/v1/data/notes
 * 查询参数：
 *   - page: 页码（默认1）
 *   - pageSize: 每页数量（默认50，最大100）
 *   - folderId: 可选，筛选指定文件夹的笔记
 */
router.get('/notes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)));
    const folderId = req.query.folderId || null;

    const data = await userDataStoreAdapter.getUserData(userId);

    let allNotes = deduplicateById(data.notes || [])
      .filter((n) => !n.isDeleted);

    // 如果指定了 folderId，进行筛选
    if (folderId) {
      allNotes = allNotes.filter((n) => n.folderId === folderId);
    }

    // 排序
    allNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // 分页
    const total = allNotes.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const notes = allNotes.slice(start, end);

    res.json({ 
      success: true, 
      data: notes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    logger.error('data', 'get notes error:', e);
    res.status(500).json({ message: '获取笔记列表失败' });
  }
});

/**
 * 获取日志列表（普通用户可访问，只需JWT认证，支持分页）
 * GET /api/v1/data/logs
 * 查询参数：
 *   - page: 页码（默认1）
 *   - pageSize: 每页数量（默认50，最大100）
 *   - level: 过滤日志级别（info, warn, error, debug）
 */
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    // 分页参数
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)));
    const level = req.query.level || null;
    
    // 获取所有日志
    const allLogs = getLogs(10000, level); // 先获取足够多的日志用于分页
    
    // 分页
    const total = allLogs.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const logs = allLogs.slice(start, end);
    
    const stats = getLogStats();
    
    res.json({
      success: true,
      data: {
        logs,
        stats,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    logger.error('data', 'get logs error:', e);
    res.status(500).json({ message: '获取日志失败' });
  }
});

/**
 * 添加日志（普通用户可访问，只需JWT认证）
 * POST /api/v1/data/logs
 */
router.post('/logs', authenticateToken, async (req, res) => {
  try {
    const { message, level = 'info' } = req.body;
    if (!message) {
      return res.status(400).json({ message: '日志消息不能为空' });
    }
    addLog(message, level);
    res.json({ success: true, message: '日志已添加' });
  } catch (e) {
    logger.error('data', 'add log error:', e);
    res.status(500).json({ message: '添加日志失败' });
  }
});

/**
 * 清空日志（普通用户可访问，只需JWT认证）
 * DELETE /api/v1/data/logs
 */
router.delete('/logs', authenticateToken, async (req, res) => {
  try {
    clearLogs();
    res.json({ message: '日志已清空', success: true });
  } catch (e) {
    logger.error('data', 'clear logs error:', e);
    res.status(500).json({ message: '清空日志失败' });
  }
});

module.exports = router;



