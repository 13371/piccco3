// 用户数据存储（笔记、文件夹、URL）
const path = require('path');
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
 */
async function readUserData(userId) {
  const filePath = getUserDataFile(userId);
  const defaultData = {
    folders: [],
    notes: [],
    urls: [],
    trash: [],
    settings: {
      sortMode: 'updatedAt',
      fontSize: 'medium',
      language: 'zh',
      nightMode: 'auto',
    },
    lastSyncAt: null,
  };
  return await readJsonFile(filePath, defaultData);
}

/**
 * 写入用户数据（异步）
 */
async function writeUserData(userId, data) {
  const filePath = getUserDataFile(userId);
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

module.exports = {
  getUserData,
  saveUserData,
  updateUserData,
  deleteUserData,
};

