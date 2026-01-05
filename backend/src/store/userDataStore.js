// 用户数据存储（笔记、文件夹、URL）
const path = require('path');
const fs = require('fs').promises;
const { readJsonFile, writeJsonFile, ensureDir } = require('../utils/fileStore');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USER_DATA_DIR = path.join(DATA_DIR, 'user-data');

// 确保目录存在（异步初始化）
(async () => {
  try {
    await ensureDir(USER_DATA_DIR);
  } catch (e) {
    logger.error('userDataStore', '初始化目录失败:', e);
  }
})();

/**
 * 获取用户数据文件路径（防止路径遍历攻击）
 */
function getUserDataFile(userId) {
  // 验证userId格式（只允许数字）
  if (!userId || typeof userId !== 'string' || !/^\d+$/.test(userId)) {
    throw new Error('Invalid userId format');
  }
  // 使用basename防止路径遍历
  const safeUserId = path.basename(userId);
  return path.join(USER_DATA_DIR, `${safeUserId}.json`);
}

/**
 * 读取用户数据（异步）
 * 重要：在读取数据时立即过滤掉永久删除的项，防止它们被重新引入
 */
async function readUserData(userId) {
  const filePath = getUserDataFile(userId);
  const defaultData = {
    folders: [],
    notes: [],
    urls: [],
    trash: [],
    homeContent: '', // 首页大白框内容
    permanentlyDeletedFolderIds: [], // 永久删除的文件夹ID列表
    permanentlyDeletedNoteIds: [], // 永久删除的笔记ID列表
    permanentlyDeletedUrlIds: [], // 永久删除的网址ID列表
    settings: {
      sortMode: 'updatedAt',
      fontSize: 'medium',
      language: 'zh',
      nightMode: 'auto',
    },
    lastSyncAt: null,
  };
  const data = await readJsonFile(filePath, defaultData);
  
  // 在读取数据时，立即过滤掉永久删除的项
  const permanentlyDeletedFolderIds = new Set(data.permanentlyDeletedFolderIds || []);
  const permanentlyDeletedNoteIds = new Set(data.permanentlyDeletedNoteIds || []);
  const permanentlyDeletedUrlIds = new Set(data.permanentlyDeletedUrlIds || []);
  
  // 记录过滤前的数量（用于调试）
  const beforeFilterFolders = (data.folders || []).length;
  const beforeFilterNotes = (data.notes || []).length;
  const beforeFilterUrls = (data.urls || []).length;
  
  // 过滤掉永久删除的项
  data.folders = (data.folders || []).filter(f => !permanentlyDeletedFolderIds.has(f.id));
  data.notes = (data.notes || []).filter(n => !permanentlyDeletedNoteIds.has(n.id));
  data.urls = (data.urls || []).filter(u => !permanentlyDeletedUrlIds.has(u.id));
  
  // 记录过滤结果（用于调试）
  const filteredFolders = beforeFilterFolders - data.folders.length;
  const filteredNotes = beforeFilterNotes - data.notes.length;
  const filteredUrls = beforeFilterUrls - data.urls.length;
  
  // 即使过滤数量为0，也输出日志（用于调试永久删除列表）
  if (permanentlyDeletedFolderIds.size > 0 || permanentlyDeletedNoteIds.size > 0 || permanentlyDeletedUrlIds.size > 0 || filteredFolders > 0 || filteredNotes > 0 || filteredUrls > 0) {
    logger.info('userDataStore', `读取数据时过滤掉永久删除的项: folders=${filteredFolders} (过滤前: ${beforeFilterFolders}, 过滤后: ${data.folders.length}), notes=${filteredNotes} (过滤前: ${beforeFilterNotes}, 过滤后: ${data.notes.length}), urls=${filteredUrls} (过滤前: ${beforeFilterUrls}, 过滤后: ${data.urls.length}), permanentlyDeletedFolderIds=${permanentlyDeletedFolderIds.size}, permanentlyDeletedNoteIds=${permanentlyDeletedNoteIds.size}, permanentlyDeletedUrlIds=${permanentlyDeletedUrlIds.size}, permanentlyDeletedNoteIdsList=${Array.from(permanentlyDeletedNoteIds).slice(0, 10).join(', ')}${permanentlyDeletedNoteIds.size > 10 ? '...' : ''}`);
  }
  
  return data;
}

/**
 * 清理重复记录：只保留 updatedAt 最大的一条
 * 强制要求：确保 id 唯一性（模拟 UNIQUE(userId, id) 约束）
 */
function deduplicateById(items, type = 'items') {
  if (!Array.isArray(items) || items.length === 0) {
    return items;
  }
  
  const itemMap = new Map();
  const duplicateIds = new Set();
  
  items.forEach((item) => {
    if (!item.id) {
      logger.warn('userDataStore', `发现没有 id 的${type}项，跳过`);
      return;
    }
    
    const existing = itemMap.get(item.id);
    if (existing) {
      duplicateIds.add(item.id);
      // 保留 updatedAt 最大的
      const existingTime = existing.updatedAt || 0;
      const currentTime = item.updatedAt || 0;
      if (currentTime > existingTime) {
        itemMap.set(item.id, item);
      }
    } else {
      itemMap.set(item.id, item);
    }
  });
  
  if (duplicateIds.size > 0) {
    logger.warn('userDataStore', `清理重复的${type}记录: ${duplicateIds.size} 个重复 id, 已保留 updatedAt 最大的`, {
      duplicateIds: Array.from(duplicateIds),
      before: items.length,
      after: itemMap.size,
    });
  }
  
  return Array.from(itemMap.values());
}

/**
 * 写入用户数据（异步）
 * 强制要求：写入前自动清理重复记录，确保 id 唯一性
 * 重要：写入前过滤掉永久删除的项，防止它们被保存到文件
 */
async function writeUserData(userId, data) {
  const filePath = getUserDataFile(userId);
  
  // 获取永久删除列表
  const permanentlyDeletedFolderIds = new Set(data.permanentlyDeletedFolderIds || []);
  const permanentlyDeletedNoteIds = new Set(data.permanentlyDeletedNoteIds || []);
  const permanentlyDeletedUrlIds = new Set(data.permanentlyDeletedUrlIds || []);
  
  // 强制要求：写入前自动清理重复记录，确保 id 唯一性（模拟 UNIQUE(userId, id) 约束）
  // 同时过滤掉永久删除的项（双重保险）
  const beforeFilterFolders = data.folders ? data.folders.length : 0;
  const beforeFilterNotes = data.notes ? data.notes.length : 0;
  const beforeFilterUrls = data.urls ? data.urls.length : 0;
  
  if (data.folders) {
    data.folders = deduplicateById(data.folders, 'folders')
      .filter(f => !permanentlyDeletedFolderIds.has(f.id));
  }
  if (data.notes) {
    data.notes = deduplicateById(data.notes, 'notes')
      .filter(n => !permanentlyDeletedNoteIds.has(n.id));
  }
  if (data.urls) {
    data.urls = deduplicateById(data.urls, 'urls')
      .filter(u => !permanentlyDeletedUrlIds.has(u.id));
  }
  
  // 记录过滤结果（用于调试）
  const filteredFolders = beforeFilterFolders - (data.folders ? data.folders.length : 0);
  const filteredNotes = beforeFilterNotes - (data.notes ? data.notes.length : 0);
  const filteredUrls = beforeFilterUrls - (data.urls ? data.urls.length : 0);
  
  // 即使过滤数量为0，也输出日志（用于调试永久删除列表）
  if (permanentlyDeletedFolderIds.size > 0 || permanentlyDeletedNoteIds.size > 0 || permanentlyDeletedUrlIds.size > 0 || filteredFolders > 0 || filteredNotes > 0 || filteredUrls > 0) {
    logger.info('userDataStore', `写入数据时过滤掉永久删除的项: folders=${filteredFolders} (过滤前: ${beforeFilterFolders}, 过滤后: ${data.folders ? data.folders.length : 0}), notes=${filteredNotes} (过滤前: ${beforeFilterNotes}, 过滤后: ${data.notes ? data.notes.length : 0}), urls=${filteredUrls} (过滤前: ${beforeFilterUrls}, 过滤后: ${data.urls ? data.urls.length : 0}), permanentlyDeletedFolderIds=${permanentlyDeletedFolderIds.size}, permanentlyDeletedNoteIds=${permanentlyDeletedNoteIds.size}, permanentlyDeletedUrlIds=${permanentlyDeletedUrlIds.size}, permanentlyDeletedNoteIdsList=${Array.from(permanentlyDeletedNoteIds).slice(0, 10).join(', ')}${permanentlyDeletedNoteIds.size > 10 ? '...' : ''}`);
  }
  
  // 添加同步时间戳
  data.lastSyncAt = Date.now();
  const success = await writeJsonFile(filePath, data, true);
  if (!success) {
    throw new Error('写入用户数据失败');
  }
  return data;
}

/**
 * 获取用户数据（完整数据，异步）
 */
async function getUserData(userId) {
  return await readUserData(userId);
}

/**
 * 保存用户数据（完整数据，异步）
 */
async function saveUserData(userId, data) {
  return await writeUserData(userId, data);
}

/**
 * 更新用户数据（部分更新，异步）
 */
async function updateUserData(userId, updates) {
  const currentData = await readUserData(userId);
  const updatedData = {
    ...currentData,
    ...updates,
    lastSyncAt: Date.now(),
  };
  return await writeUserData(userId, updatedData);
}

/**
 * 删除用户数据
 */
function deleteUserData(userId) {
  const filePath = getUserDataFile(userId);
  const fs = require('fs');
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (e) {
    logger.error('userDataStore', `删除用户数据失败 ${userId}:`, e);
    return false;
  }
}

/**
 * 初始化用户数据（新用户注册时调用）
 * 确保新用户的数据文件是空的
 */
async function initUserData(userId) {
  const filePath = getUserDataFile(userId);
  
  // 检查文件是否已存在
  try {
    await fs.access(filePath);
    // 文件已存在，不需要初始化
    logger.debug('userDataStore', `用户 ${userId} 的数据文件已存在，跳过初始化`);
    return;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      // 其他错误，记录并抛出
      logger.error('userDataStore', `检查用户数据文件失败 ${userId}:`, e);
      throw e;
    }
    // 文件不存在，继续初始化
  }
  
  // 创建空的用户数据
  const emptyData = {
    folders: [],
    notes: [],
    urls: [],
    trash: [],
    homeContent: '',
    permanentlyDeletedFolderIds: [],
    permanentlyDeletedNoteIds: [],
    permanentlyDeletedUrlIds: [],
    settings: {
      sortMode: 'updatedAt',
      fontSize: 'medium',
      language: 'zh',
      nightMode: 'auto',
    },
    lastSyncAt: null,
  };
  
  // 写入空数据文件
  const success = await writeJsonFile(filePath, emptyData, true);
  if (!success) {
    throw new Error('初始化用户数据失败');
  }
  
  logger.info('userDataStore', `用户 ${userId} 的数据文件已初始化（空数据）`);
}

module.exports = {
  getUserData,
  saveUserData,
  updateUserData,
  deleteUserData,
  initUserData,
};

