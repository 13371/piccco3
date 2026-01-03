// 用户数据访问层（DAO）- 文件夹、笔记、URL
const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../config');
const logger = require('../../utils/logger');

/**
 * 获取用户完整数据
 */
async function getUserData(userId) {
  try {
    // 获取文件夹
    const foldersResult = await query(
      `SELECT * FROM folders WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );

    // 获取笔记
    const notesResult = await query(
      `SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );

    // 获取URL
    const urlsResult = await query(
      `SELECT * FROM urls WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );

    // 获取设置
    const settingsResult = await query(
      `SELECT * FROM user_settings WHERE user_id = $1`,
      [userId]
    );

    const folders = foldersResult.rows.map(formatFolder);
    const notes = notesResult.rows.map(formatNote);
    const urls = urlsResult.rows.map(formatUrl);
    const settings = settingsResult.rows[0] ? formatSettings(settingsResult.rows[0]) : getDefaultSettings();

    return {
      folders,
      notes,
      urls,
      trash: [], // 向后兼容
      permanentlyDeletedFolderIds: settings.permanentlyDeletedFolderIds || [],
      settings: settings.settings || getDefaultSettings().settings,
      lastSyncAt: settings.lastSyncAt,
    };
  } catch (error) {
    logger.error('userDataDao', '获取用户数据失败', error);
    throw error;
  }
}

/**
 * 获取用户增量数据（基于 updated_at）
 * @param {string} userId - 用户ID
 * @param {number} lastSyncAt - 最后同步时间戳（毫秒）
 * @returns {Promise<Object>} 增量数据
 */
async function getUserDataIncremental(userId, lastSyncAt) {
  try {
    // 将时间戳转换为 Date 对象
    // PostgreSQL 的 timestamp 使用微秒精度，但我们的 updated_at 是毫秒
    const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    
    // 获取文件夹（只返回 updated_at > lastSyncAt 的）
    const foldersResult = await query(
      `SELECT * FROM folders 
       WHERE user_id = $1 AND updated_at > $2 
       ORDER BY updated_at DESC`,
      [userId, since]
    );

    // 获取笔记
    const notesResult = await query(
      `SELECT * FROM notes 
       WHERE user_id = $1 AND updated_at > $2 
       ORDER BY updated_at DESC`,
      [userId, since]
    );

    // 获取URL
    const urlsResult = await query(
      `SELECT * FROM urls 
       WHERE user_id = $1 AND updated_at > $2 
       ORDER BY updated_at DESC`,
      [userId, since]
    );

    // 获取设置（如果更新过）
    const settingsResult = await query(
      `SELECT * FROM user_settings 
       WHERE user_id = $1 AND updated_at > $2`,
      [userId, since]
    );

    const folders = foldersResult.rows.map(formatFolder);
    const notes = notesResult.rows.map(formatNote);
    const urls = urlsResult.rows.map(formatUrl);
    const settings = settingsResult.rows[0] ? formatSettings(settingsResult.rows[0]) : null;

    return {
      folders,
      notes,
      urls,
      settings: settings ? settings.settings : null,
      permanentlyDeletedFolderIds: settings ? settings.permanentlyDeletedFolderIds : null,
      hasMore: false, // 可以用于分页
    };
  } catch (error) {
    logger.error('userDataDao', '获取增量数据失败', error);
    throw error;
  }
}

/**
 * 保存用户完整数据
 */
async function saveUserData(userId, data) {
  const client = await beginTransaction();
  
  try {
    const now = Date.now();

    // 1. 保存文件夹（使用 UPSERT）
    if (data.folders && Array.isArray(data.folders)) {
      for (const folder of data.folders) {
        await client.query(
          `INSERT INTO folders (id, user_id, name, type, color, is_starred, is_deleted, deleted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (user_id, id) 
           DO UPDATE SET 
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             color = EXCLUDED.color,
             is_starred = EXCLUDED.is_starred,
             is_deleted = EXCLUDED.is_deleted,
             deleted_at = EXCLUDED.deleted_at,
             updated_at = EXCLUDED.updated_at`,
          [
            folder.id,
            userId,
            folder.name,
            folder.type || 'normal',
            folder.color,
            folder.isStarred || false,
            folder.isDeleted || false,
            folder.deletedAt || null,
            folder.createdAt || now,
            folder.updatedAt || now,
          ]
        );
      }
    }

    // 2. 保存笔记
    if (data.notes && Array.isArray(data.notes)) {
      for (const note of data.notes) {
        await client.query(
          `INSERT INTO notes (id, user_id, folder_id, title, content, is_starred, is_deleted, deleted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (user_id, id) 
           DO UPDATE SET 
             folder_id = EXCLUDED.folder_id,
             title = EXCLUDED.title,
             content = EXCLUDED.content,
             is_starred = EXCLUDED.is_starred,
             is_deleted = EXCLUDED.is_deleted,
             deleted_at = EXCLUDED.deleted_at,
             updated_at = EXCLUDED.updated_at`,
          [
            note.id,
            userId,
            note.folderId || null,
            note.title || null,
            note.content || null,
            note.isStarred || false,
            note.isDeleted || false,
            note.deletedAt || null,
            note.createdAt || now,
            note.updatedAt || now,
          ]
        );
      }
    }

    // 3. 保存URL
    if (data.urls && Array.isArray(data.urls)) {
      for (const url of data.urls) {
        await client.query(
          `INSERT INTO urls (id, user_id, folder_id, title, url, is_starred, is_deleted, deleted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (user_id, id) 
           DO UPDATE SET 
             folder_id = EXCLUDED.folder_id,
             title = EXCLUDED.title,
             url = EXCLUDED.url,
             is_starred = EXCLUDED.is_starred,
             is_deleted = EXCLUDED.is_deleted,
             deleted_at = EXCLUDED.deleted_at,
             updated_at = EXCLUDED.updated_at`,
          [
            url.id,
            userId,
            url.folderId || null,
            url.title || null,
            url.url || '',
            url.isStarred || false,
            url.isDeleted || false,
            url.deletedAt || null,
            url.createdAt || now,
            url.updatedAt || now,
          ]
        );
      }
    }

    // 4. 保存设置
    const settings = data.settings || getDefaultSettings().settings;
    const permanentlyDeletedFolderIds = data.permanentlyDeletedFolderIds || [];
    
    await client.query(
      `INSERT INTO user_settings (user_id, sort_mode, font_size, language, night_mode, last_sync_at, permanently_deleted_folder_ids, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         sort_mode = EXCLUDED.sort_mode,
         font_size = EXCLUDED.font_size,
         language = EXCLUDED.language,
         night_mode = EXCLUDED.night_mode,
         last_sync_at = EXCLUDED.last_sync_at,
         permanently_deleted_folder_ids = EXCLUDED.permanently_deleted_folder_ids,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        settings.sortMode || 'updatedAt',
        settings.fontSize || 'medium',
        settings.language || 'zh',
        settings.nightMode || 'auto',
        Date.now(),
        permanentlyDeletedFolderIds,
      ]
    );

    await commitTransaction(client);

    // 返回保存后的数据
    return await getUserData(userId);
  } catch (error) {
    await rollbackTransaction(client);
    logger.error('userDataDao', '保存用户数据失败', error);
    throw error;
  }
}

/**
 * 更新用户数据（部分更新）
 */
async function updateUserData(userId, updates) {
  try {
    const currentData = await getUserData(userId);
    const updatedData = {
      ...currentData,
      ...updates,
    };
    return await saveUserData(userId, updatedData);
  } catch (error) {
    logger.error('userDataDao', '更新用户数据失败', error);
    throw error;
  }
}

/**
 * 删除用户数据
 */
async function deleteUserData(userId) {
  try {
    // 由于外键约束，删除用户会自动删除相关数据
    // 这里只需要删除设置
    await query('DELETE FROM user_settings WHERE user_id = $1', [userId]);
    return true;
  } catch (error) {
    logger.error('userDataDao', '删除用户数据失败', error);
    throw error;
  }
}

/**
 * 格式化文件夹数据
 */
function formatFolder(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || 'normal',
    color: row.color,
    isStarred: row.is_starred || false,
    isDeleted: row.is_deleted || false,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

/**
 * 格式化笔记数据
 */
function formatNote(row) {
  return {
    id: row.id,
    folderId: row.folder_id || null,
    title: row.title || null,
    content: row.content || null,
    isStarred: row.is_starred || false,
    isDeleted: row.is_deleted || false,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

/**
 * 格式化URL数据
 */
function formatUrl(row) {
  return {
    id: row.id,
    folderId: row.folder_id || null,
    title: row.title || null,
    url: row.url || '',
    isStarred: row.is_starred || false,
    isDeleted: row.is_deleted || false,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

/**
 * 格式化设置数据
 */
function formatSettings(row) {
  return {
    settings: {
      sortMode: row.sort_mode || 'updatedAt',
      fontSize: row.font_size || 'medium',
      language: row.language || 'zh',
      nightMode: row.night_mode || 'auto',
    },
    permanentlyDeletedFolderIds: row.permanently_deleted_folder_ids || [],
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at).getTime() : null,
  };
}

/**
 * 获取默认设置
 */
function getDefaultSettings() {
  return {
    settings: {
      sortMode: 'updatedAt',
      fontSize: 'medium',
      language: 'zh',
      nightMode: 'auto',
    },
    permanentlyDeletedFolderIds: [],
    lastSyncAt: null,
  };
}

module.exports = {
  getUserData,
  getUserDataIncremental,
  saveUserData,
  updateUserData,
  deleteUserData,
};
