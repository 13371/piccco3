const express = require('express');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getUserData, saveUserData, updateUserData } = require('../store/userDataStore');
const { addLog, getLogs, clearLogs, getLogStats } = require('../store/logStore');
const { logAudit, extractAuditInfo } = require('../utils/auditLogger');
const { validateNoteContent, validateFolderName, validateUrl: validateUrlFormat, validateVersion } = require('../utils/validators');

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

// 强制要求 JWT_SECRET
if (!JWT_SECRET) {
  logger.error('data', '❌ 错误：未设置 JWT_SECRET 环境变量！');
  logger.error('data', '请在 .env 文件中设置 JWT_SECRET=your-random-secret-string');
  process.exit(1);
}

const FINAL_JWT_SECRET = JWT_SECRET;

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
    req.token = token; // 保存token，用于设备管理
    next();
    
    // 异步更新设备活动时间（不阻塞请求）
    if (user && user.id) {
      setImmediate(() => {
        try {
          const { updateDeviceActivity } = require('../store/deviceStore');
          updateDeviceActivity(user.id, token);
        } catch (e) {
          // 忽略错误，设备管理是可选功能
        }
      });
    }
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
    
    // 强制要求：先清理重复记录，确保 id 唯一性（模拟 UNIQUE(userId, id) 约束）
    // 同步逻辑：保留所有数据（包括已删除的），列表查询时会过滤
    // 获取永久删除的文件夹、笔记、网址ID列表（如果存在）
    const permanentlyDeletedFolderIds = new Set(
      (userData.permanentlyDeletedFolderIds || [])
        .filter(Boolean)
    );
    const permanentlyDeletedNoteIds = new Set(
      (userData.permanentlyDeletedNoteIds || [])
        .filter(Boolean)
    );
    const permanentlyDeletedUrlIds = new Set(
      (userData.permanentlyDeletedUrlIds || [])
        .filter(Boolean)
    );
    
    // 重要修复：在去重之前先过滤掉永久删除的项，确保这些项永远不会被返回
    // 这样可以防止永久删除的项在后续同步中被恢复
    const allFolders = deduplicateById(
      (userData.folders || []).filter((folder) => !permanentlyDeletedFolderIds.has(folder.id)),
      'folders'
    );
    const allNotes = deduplicateById(
      (userData.notes || []).filter((note) => !permanentlyDeletedNoteIds.has(note.id)),
      'notes'
    );
    const allUrls = deduplicateById(
      (userData.urls || []).filter((url) => !permanentlyDeletedUrlIds.has(url.id)),
      'urls'
    );
    
    // 重要修复：同步接口必须返回所有数据（包括已删除的），以便前端能正确同步删除状态
    // 前端会根据 isDeleted 字段自行过滤显示，但同步时需要知道哪些项被删除了
    // 注意：永久删除的项已经在上面被过滤掉了，所以这里不需要再次过滤
    const foldersToReturn = allFolders
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    // 返回所有笔记（包括已删除的），但过滤掉永久删除的笔记
    const notesToReturn = allNotes
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    // 返回所有网址（包括已删除的），但过滤掉永久删除的网址
    const urlsToReturn = allUrls
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    // 统计已删除的项（用于日志）
    const deletedFoldersCount = foldersToReturn.filter((f) => f.isDeleted).length;
    const deletedNotesCount = notesToReturn.filter((n) => n.isDeleted).length;
    const deletedUrlsCount = urlsToReturn.filter((u) => u.isDeleted).length;
    
    // 记录永久删除列表的详细信息（用于调试）
    logger.info('data', `GET /sync 返回数据: folders=${foldersToReturn.length} (已删除: ${deletedFoldersCount}), notes=${notesToReturn.length} (已删除: ${deletedNotesCount}), urls=${urlsToReturn.length} (已删除: ${deletedUrlsCount}), permanentlyDeletedFolderIds=${permanentlyDeletedFolderIds.size}, permanentlyDeletedNoteIds=${permanentlyDeletedNoteIds.size}, permanentlyDeletedUrlIds=${permanentlyDeletedUrlIds.size}, permanentlyDeletedNoteIdsList=${Array.from(permanentlyDeletedNoteIds).slice(0, 10).join(', ')}${permanentlyDeletedNoteIds.size > 10 ? '...' : ''}`);
    
    // 确保永久删除列表始终是数组（而不是 null 或 undefined）
    const permanentlyDeletedFolderIdsArray = Array.from(permanentlyDeletedFolderIds);
    const permanentlyDeletedNoteIdsArray = Array.from(permanentlyDeletedNoteIds);
    const permanentlyDeletedUrlIdsArray = Array.from(permanentlyDeletedUrlIds);
    
    res.json({
      success: true,
      data: {
        folders: foldersToReturn, // 包含已删除的文件夹
        notes: notesToReturn, // 包含已删除的笔记
        urls: urlsToReturn, // 包含已删除的网址
        trash: [], // 保留 trash 数组（向后兼容），但不再使用
        homeContent: userData.homeContent || '', // 首页大白框内容
        permanentlyDeletedFolderIds: permanentlyDeletedFolderIdsArray, // 返回永久删除列表（确保是数组）
        permanentlyDeletedNoteIds: permanentlyDeletedNoteIdsArray, // 返回永久删除的笔记列表（确保是数组）
        permanentlyDeletedUrlIds: permanentlyDeletedUrlIdsArray, // 返回永久删除的网址列表（确保是数组）
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
    const { folders, notes, urls, trash, homeContent, settings, permanentlyDeletedFolderIds, permanentlyDeletedNoteIds, permanentlyDeletedUrlIds } = req.body || {};
    
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
      await logWarning(userId, 'sync_rejected', {
        ...extractAuditInfo(req),
        reason: 'data_too_large',
        totalItems,
      });
      return res.status(400).json({ message: '数据量过大，请分批同步' });
    }
    
    // 增强数据验证
    for (const folder of folders || []) {
      if (folder.name && !validateFolderName(folder.name)) {
        await logWarning(userId, 'sync_validation_failed', {
          ...extractAuditInfo(req),
          reason: 'invalid_folder_name',
          folderId: folder.id,
        });
        return res.status(400).json({ message: `文件夹名称无效: ${folder.name}` });
      }
      if (folder.version !== undefined && !validateVersion(folder.version)) {
        return res.status(400).json({ message: `文件夹版本号无效: ${folder.id}` });
      }
    }
    
    for (const note of notes || []) {
      if (!validateNoteContent(note.content)) {
        await logWarning(userId, 'sync_validation_failed', {
          ...extractAuditInfo(req),
          reason: 'invalid_note_content',
          noteId: note.id,
        });
        return res.status(400).json({ message: `笔记内容无效: ${note.id}` });
      }
      if (note.version !== undefined && !validateVersion(note.version)) {
        return res.status(400).json({ message: `笔记版本号无效: ${note.id}` });
      }
    }
    
    for (const url of urls || []) {
      if (url.url && !validateUrlFormat(url.url)) {
        await logWarning(userId, 'sync_validation_failed', {
          ...extractAuditInfo(req),
          reason: 'invalid_url',
          urlId: url.id,
        });
        return res.status(400).json({ message: `URL格式无效: ${url.id}` });
      }
      if (url.version !== undefined && !validateVersion(url.version)) {
        return res.status(400).json({ message: `URL版本号无效: ${url.id}` });
      }
    }
    
    // 获取当前数据，保留设置（如果请求中没有提供设置，保留现有设置）
    const currentData = await getUserData(userId);
    
    // 基于 isDeleted 字段过滤数据（不再使用 trash 数组）
    // 获取永久删除的文件夹、笔记、网址ID列表（合并客户端和服务器端）
    const clientPermanentlyDeletedFolderIds = new Set(
      (permanentlyDeletedFolderIds || [])
        .filter(Boolean)
    );
    const serverPermanentlyDeletedFolderIds = new Set(
      (currentData.permanentlyDeletedFolderIds || [])
        .filter(Boolean)
    );
    // 重要：合并客户端和服务器端的永久删除列表（使用并集，确保不丢失任何永久删除的项）
    // 这样可以防止并发清空回收站时，某些项被重新引入
    const allPermanentlyDeletedFolderIds = new Set([
      ...Array.from(clientPermanentlyDeletedFolderIds),
      ...Array.from(serverPermanentlyDeletedFolderIds),
    ]);
    
    const clientPermanentlyDeletedNoteIds = new Set(
      (permanentlyDeletedNoteIds || [])
        .filter(Boolean)
    );
    const serverPermanentlyDeletedNoteIds = new Set(
      (currentData.permanentlyDeletedNoteIds || [])
        .filter(Boolean)
    );
    const allPermanentlyDeletedNoteIds = new Set([
      ...Array.from(clientPermanentlyDeletedNoteIds),
      ...Array.from(serverPermanentlyDeletedNoteIds),
    ]);
    
    const clientPermanentlyDeletedUrlIds = new Set(
      (permanentlyDeletedUrlIds || [])
        .filter(Boolean)
    );
    const serverPermanentlyDeletedUrlIds = new Set(
      (currentData.permanentlyDeletedUrlIds || [])
        .filter(Boolean)
    );
    const allPermanentlyDeletedUrlIds = new Set([
      ...Array.from(clientPermanentlyDeletedUrlIds),
      ...Array.from(serverPermanentlyDeletedUrlIds),
    ]);
    
    // 记录合并后的永久删除列表（用于调试并发问题）
    if (allPermanentlyDeletedFolderIds.size > 0 || allPermanentlyDeletedNoteIds.size > 0 || allPermanentlyDeletedUrlIds.size > 0) {
      logger.info('data', `合并永久删除列表: folders=${allPermanentlyDeletedFolderIds.size} (客户端: ${clientPermanentlyDeletedFolderIds.size}, 服务器: ${serverPermanentlyDeletedFolderIds.size}), notes=${allPermanentlyDeletedNoteIds.size} (客户端: ${clientPermanentlyDeletedNoteIds.size}, 服务器: ${serverPermanentlyDeletedNoteIds.size}), urls=${allPermanentlyDeletedUrlIds.size} (客户端: ${clientPermanentlyDeletedUrlIds.size}, 服务器: ${serverPermanentlyDeletedUrlIds.size})`);
    }
    
    // 强制要求：同步唯一判断标准是 updatedAt
    // 后端必须保存所有数据（包括已删除的），不能过滤掉已删除的数据
    // 否则其他设备无法同步到删除操作
    
    // 合并客户端和服务器端的数据，严格按照 updatedAt 判断
    // 强制要求：服务器数据是权威来源，但客户端更新的数据（updatedAt 更大）应该被保存
    const folderMap = new Map();
    const noteMap = new Map();
    const urlMap = new Map();
    
    // 重要修复：在合并数据之前，先从服务器端数据中过滤掉永久删除的项
    // 这样可以防止永久删除的项在并发同步时被重新引入
    // 先添加服务器端当前数据（服务器数据优先），但排除永久删除的项
    (currentData.folders || []).forEach((folder) => {
      // 跳过永久删除的文件夹（无论来自客户端还是服务器端）
      if (allPermanentlyDeletedFolderIds.has(folder.id)) {
        logger.debug('data', `跳过永久删除的文件夹: ${folder.id}`);
        return;
      }
      folderMap.set(folder.id, folder);
    });
    (currentData.notes || []).forEach((note) => {
      // 跳过永久删除的笔记（无论来自客户端还是服务器端）
      if (allPermanentlyDeletedNoteIds.has(note.id)) {
        logger.debug('data', `跳过永久删除的笔记: ${note.id}`);
        return;
      }
      noteMap.set(note.id, note);
    });
    (currentData.urls || []).forEach((url) => {
      // 跳过永久删除的网址（无论来自客户端还是服务器端）
      if (allPermanentlyDeletedUrlIds.has(url.id)) {
        logger.debug('data', `跳过永久删除的网址: ${url.id}`);
        return;
      }
      urlMap.set(url.id, url);
    });
    
    // 再添加客户端数据，如果 updatedAt 更大，则覆盖服务器数据
    // 强制要求：禁止默认 isDeleted = false
    // 如果 incoming 未提供 isDeleted，保持原值
    // 重要：删除操作（isDeleted = true）必须接受，即使 updatedAt 更小
    (folders || []).forEach((folder) => {
      // 跳过永久删除的文件夹
      if (allPermanentlyDeletedFolderIds.has(folder.id)) {
        return;
      }
      
      const existing = folderMap.get(folder.id);
      const isDeleteOperation = folder.isDeleted === true;
      const clientUpdatedAt = folder.updatedAt || 0;
      const serverUpdatedAt = existing?.updatedAt || 0;
      const clientVersion = folder.version || 0;
      const serverVersion = existing?.version || 0;
      
      // 版本号冲突检测：如果版本号相同但 updatedAt 不同，说明有并发冲突
      const hasVersionConflict = existing && 
                                 clientVersion === serverVersion && 
                                 clientUpdatedAt !== serverUpdatedAt;
      
      if (hasVersionConflict) {
        logger.warn('data', `检测到版本冲突: folderId=${folder.id}, version=${clientVersion}, clientUpdatedAt=${clientUpdatedAt}, serverUpdatedAt=${serverUpdatedAt}`);
        // 使用 updatedAt 更大的版本，版本号递增
        if (clientUpdatedAt > serverUpdatedAt) {
          folder.version = serverVersion + 1;
        } else {
          // 保留服务器数据，但版本号递增
          existing.version = serverVersion + 1;
          folderMap.set(folder.id, existing);
          return; // 跳过客户端数据
        }
      }
      
      // 判断是否应该更新：
      // 1. 如果服务器没有该数据，添加客户端数据
      // 2. 如果客户端 updatedAt 更大，使用客户端数据
      // 3. 如果是删除操作且服务器未删除，接受删除操作
      // 4. 如果客户端版本号更大，使用客户端数据
      const shouldUpdate = !existing || 
                          clientUpdatedAt > serverUpdatedAt ||
                          clientVersion > serverVersion ||
                          (isDeleteOperation && existing && !existing.isDeleted);
      
      // 如果更新，确保版本号递增
      if (shouldUpdate && existing) {
        folder.version = Math.max(clientVersion, serverVersion) + 1;
      } else if (shouldUpdate && !existing) {
        folder.version = clientVersion || 1;
      }
      
      if (shouldUpdate) {
        // 如果 incoming 未提供 isDeleted 或 deletedAt，保持原值
        if (existing && folder.isDeleted === undefined) {
          folder.isDeleted = existing.isDeleted;
        }
        if (existing && folder.deletedAt === undefined) {
          folder.deletedAt = existing.deletedAt;
        }
        folderMap.set(folder.id, folder);
        
        // 记录更新日志（用于调试）
        if (existing && clientUpdatedAt <= serverUpdatedAt && !isDeleteOperation) {
          logger.warn('data', `客户端数据 updatedAt 更小但仍被保存（可能是删除操作）: folderId=${folder.id}, client=${clientUpdatedAt}, server=${serverUpdatedAt}`);
        }
      } else if (existing && clientUpdatedAt < serverUpdatedAt) {
        // 服务器数据更新，保留服务器数据（不更新）
        logger.debug('data', `保留服务器数据（updatedAt 更大）: folderId=${folder.id}, client=${clientUpdatedAt}, server=${serverUpdatedAt}`);
      }
    });
    
    (notes || []).forEach((note) => {
      // 跳过永久删除的笔记
      if (allPermanentlyDeletedNoteIds.has(note.id)) {
        return;
      }
      
      const existing = noteMap.get(note.id);
      const isDeleteOperation = note.isDeleted === true;
      const clientUpdatedAt = note.updatedAt || 0;
      const serverUpdatedAt = existing?.updatedAt || 0;
      const clientVersion = note.version || 0;
      const serverVersion = existing?.version || 0;
      
      // 版本号冲突检测
      const hasVersionConflict = existing && 
                                 clientVersion === serverVersion && 
                                 clientUpdatedAt !== serverUpdatedAt;
      
      if (hasVersionConflict) {
        logger.warn('data', `检测到版本冲突: noteId=${note.id}, version=${clientVersion}, clientUpdatedAt=${clientUpdatedAt}, serverUpdatedAt=${serverUpdatedAt}`);
        if (clientUpdatedAt > serverUpdatedAt) {
          note.version = serverVersion + 1;
        } else {
          existing.version = serverVersion + 1;
          noteMap.set(note.id, existing);
          return;
        }
      }
      
      // 判断是否应该更新
      const shouldUpdate = !existing || 
                          clientUpdatedAt > serverUpdatedAt ||
                          clientVersion > serverVersion ||
                          (isDeleteOperation && existing && !existing.isDeleted);
      
      if (shouldUpdate && existing) {
        note.version = Math.max(clientVersion, serverVersion) + 1;
      } else if (shouldUpdate && !existing) {
        note.version = clientVersion || 1;
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
        
        // 记录更新日志（用于调试）
        if (isDeleteOperation) {
          logger.info('data', `保存删除的笔记: noteId=${note.id}, deletedAt=${note.deletedAt}, updatedAt=${note.updatedAt}`);
        } else if (existing && clientUpdatedAt <= serverUpdatedAt) {
          logger.warn('data', `客户端数据 updatedAt 更小但仍被保存（可能是删除操作）: noteId=${note.id}, client=${clientUpdatedAt}, server=${serverUpdatedAt}`);
        }
      } else if (existing && clientUpdatedAt < serverUpdatedAt) {
        // 服务器数据更新，保留服务器数据（不更新）
        logger.debug('data', `保留服务器数据（updatedAt 更大）: noteId=${note.id}, client=${clientUpdatedAt}, server=${serverUpdatedAt}`);
      } else if (isDeleteOperation && existing && existing.isDeleted) {
        // 删除操作被跳过（服务器已经删除）
        logger.debug('data', `删除操作被跳过（服务器已删除）: noteId=${note.id}`);
      }
    });
    
    (urls || []).forEach((url) => {
      // 跳过永久删除的网址
      if (allPermanentlyDeletedUrlIds.has(url.id)) {
        return;
      }
      
      const existing = urlMap.get(url.id);
      const isDeleteOperation = url.isDeleted === true;
      const clientUpdatedAt = url.updatedAt || 0;
      const serverUpdatedAt = existing?.updatedAt || 0;
      const clientVersion = url.version || 0;
      const serverVersion = existing?.version || 0;
      
      // 版本号冲突检测
      const hasVersionConflict = existing && 
                                 clientVersion === serverVersion && 
                                 clientUpdatedAt !== serverUpdatedAt;
      
      if (hasVersionConflict) {
        logger.warn('data', `检测到版本冲突: urlId=${url.id}, version=${clientVersion}, clientUpdatedAt=${clientUpdatedAt}, serverUpdatedAt=${serverUpdatedAt}`);
        if (clientUpdatedAt > serverUpdatedAt) {
          url.version = serverVersion + 1;
        } else {
          existing.version = serverVersion + 1;
          urlMap.set(url.id, existing);
          return;
        }
      }
      
      // 判断是否应该更新
      const shouldUpdate = !existing || 
                          clientUpdatedAt > serverUpdatedAt ||
                          clientVersion > serverVersion ||
                          (isDeleteOperation && existing && !existing.isDeleted);
      
      if (shouldUpdate && existing) {
        url.version = Math.max(clientVersion, serverVersion) + 1;
      } else if (shouldUpdate && !existing) {
        url.version = clientVersion || 1;
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
        
        // 记录更新日志（用于调试）
        if (isDeleteOperation) {
          logger.info('data', `保存删除的网址: urlId=${url.id}, deletedAt=${url.deletedAt}, updatedAt=${url.updatedAt}`);
        } else if (existing && clientUpdatedAt <= serverUpdatedAt) {
          logger.warn('data', `客户端数据 updatedAt 更小但仍被保存（可能是删除操作）: urlId=${url.id}, client=${clientUpdatedAt}, server=${serverUpdatedAt}`);
        }
      } else if (existing && clientUpdatedAt < serverUpdatedAt) {
        // 服务器数据更新，保留服务器数据（不更新）
        logger.debug('data', `保留服务器数据（updatedAt 更大）: urlId=${url.id}, client=${clientUpdatedAt}, server=${serverUpdatedAt}`);
      } else if (isDeleteOperation && existing && existing.isDeleted) {
        // 删除操作被跳过（服务器已经删除）
        logger.debug('data', `删除操作被跳过（服务器已删除）: urlId=${url.id}`);
      }
    });
    
    // 转换为数组，并过滤掉永久删除的项（双重保险，确保永久删除的项不会被保存）
    // 重要：即使某个项在 folderMap/noteMap/urlMap 中，如果它在永久删除列表中，也应该被过滤掉
    const beforeFilterFoldersCount = folderMap.size;
    const beforeFilterNotesCount = noteMap.size;
    const beforeFilterUrlsCount = urlMap.size;
    
    const finalFolders = Array.from(folderMap.values())
      .filter((folder) => {
        if (allPermanentlyDeletedFolderIds.has(folder.id)) {
          logger.debug('data', `过滤掉永久删除的文件夹: ${folder.id}`);
          return false;
        }
        return true;
      });
    const finalNotes = Array.from(noteMap.values())
      .filter((note) => {
        if (allPermanentlyDeletedNoteIds.has(note.id)) {
          logger.debug('data', `过滤掉永久删除的笔记: ${note.id}`);
          return false;
        }
        return true;
      });
    const finalUrls = Array.from(urlMap.values())
      .filter((url) => {
        if (allPermanentlyDeletedUrlIds.has(url.id)) {
          logger.debug('data', `过滤掉永久删除的网址: ${url.id}`);
          return false;
        }
        return true;
      });
    
    // 记录过滤结果（用于调试并发问题）
    const filteredFoldersCount = beforeFilterFoldersCount - finalFolders.length;
    const filteredNotesCount = beforeFilterNotesCount - finalNotes.length;
    const filteredUrlsCount = beforeFilterUrlsCount - finalUrls.length;
    if (filteredFoldersCount > 0 || filteredNotesCount > 0 || filteredUrlsCount > 0) {
      logger.info('data', `过滤掉永久删除的项: folders=${filteredFoldersCount} (过滤前: ${beforeFilterFoldersCount}, 过滤后: ${finalFolders.length}), notes=${filteredNotesCount} (过滤前: ${beforeFilterNotesCount}, 过滤后: ${finalNotes.length}), urls=${filteredUrlsCount} (过滤前: ${beforeFilterUrlsCount}, 过滤后: ${finalUrls.length})`);
    }
    
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
    
    // 合并首页内容：如果客户端提供了，使用客户端的；否则保留服务器的
    const finalHomeContent = homeContent !== undefined ? homeContent : (currentData.homeContent || '');
    
    const userData = {
      folders: finalFoldersWithUpdatedAt,
      notes: finalNotesWithUpdatedAt,
      urls: finalUrlsWithUpdatedAt,
      trash: [], // 保留 trash 数组（向后兼容），但不再使用
      homeContent: finalHomeContent, // 首页大白框内容
      permanentlyDeletedFolderIds: Array.from(allPermanentlyDeletedFolderIds), // 保存永久删除列表
      permanentlyDeletedNoteIds: Array.from(allPermanentlyDeletedNoteIds), // 保存永久删除的笔记列表
      permanentlyDeletedUrlIds: Array.from(allPermanentlyDeletedUrlIds), // 保存永久删除的网址列表
      settings: settings || currentData.settings || {
        sortMode: 'updatedAt',
        fontSize: 'medium',
        language: 'zh',
        nightMode: 'auto',
      },
    };
    
    logger.info('data', `保存用户数据: folders=${finalFoldersWithUpdatedAt.length}, notes=${finalNotesWithUpdatedAt.length}, urls=${finalUrlsWithUpdatedAt.length}, permanentlyDeletedFolderIds=${allPermanentlyDeletedFolderIds.size}, permanentlyDeletedNoteIds=${allPermanentlyDeletedNoteIds.size}, permanentlyDeletedUrlIds=${allPermanentlyDeletedUrlIds.size}`);
    
    const savedData = await saveUserData(userId, userData);
    
    // 记录审计日志
    await logAudit(userId, 'data_sync', {
      ...extractAuditInfo(req),
      foldersCount: finalFoldersWithUpdatedAt.length,
      notesCount: finalNotesWithUpdatedAt.length,
      urlsCount: finalUrlsWithUpdatedAt.length,
      totalItems: totalItems,
    });
    
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

    const userData = await getUserData(userId);

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

    await saveUserData(userId, {
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

    const userData = await getUserData(userId);

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

    await saveUserData(userId, {
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
    const userData = await getUserData(userId);
    
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
 * 列表接口：获取所有未删除的文件夹
 * 强制要求：禁止返回 isDeleted = true 的记录
 * GET /api/v1/data/folders
 */
router.get('/folders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }

    const data = await getUserData(userId);

    const folders = deduplicateById(data.folders || [])
      .filter((f) => !f.isDeleted)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    res.json({ success: true, data: folders });
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

    const data = await getUserData(userId);

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
    const userData = await getUserData(userId);
    
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
 * 获取日志列表（普通用户可访问，只需JWT认证）
 * GET /api/v1/data/logs
 * 查询参数：
 *   - limit: 返回的日志条数（默认100）
 *   - level: 过滤日志级别（info, warn, error, debug）
 */
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const level = req.query.level || null;
    
    const logs = getLogs(limit, level);
    const stats = getLogStats();
    
    res.json({
      success: true,
      data: {
        logs,
        stats,
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



