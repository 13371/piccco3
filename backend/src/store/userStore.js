const path = require('path');
const bcrypt = require('bcryptjs');
const { readJsonFileSync, writeJsonFileSync, ensureDirSync } = require('../utils/fileStore');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// 确保数据目录存在
ensureDirSync(DATA_DIR);

function readUsers() {
  return readJsonFileSync(USERS_FILE, []);
}

function writeUsers(users) {
  const success = writeJsonFileSync(USERS_FILE, users);
  if (!success) {
    throw new Error('写入用户数据失败');
  }
}

async function createUser({ email, username, password }) {
  const users = readUsers();
  const existing = users.find((u) => u.email === email);
  if (existing) {
    throw new Error('该邮箱已注册');
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    email,
    username,
    password: hashed,
    createdAt: new Date().toISOString(),
    isBanned: false,
    bannedAt: null,
    banReason: null,
  };
  users.push(user);
  writeUsers(users);
  return user;
}

async function findUserByEmail(email) {
  const users = readUsers();
  return users.find((u) => u.email === email) || null;
}

async function findUserById(id) {
  const users = readUsers();
  return users.find((u) => u.id === id) || null;
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password);
}

// 获取所有用户（不包含密码）
function getAllUsers() {
  const users = readUsers();
  return users.map(({ password, ...user }) => user);
}

// 根据条件筛选用户
function filterUsers({ keyword, isBanned, sortBy = 'createdAt', order = 'desc' }) {
  let users = getAllUsers();

  // 关键词搜索（用户名或邮箱）
  if (keyword) {
    const kw = keyword.toLowerCase();
    users = users.filter((u) => {
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return username.includes(kw) || email.includes(kw);
    });
  }

  // 封禁状态筛选
  if (isBanned !== undefined) {
    users = users.filter((u) => u.isBanned === isBanned);
  }

  // 排序
  users.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // 处理日期字段
    if (sortBy === 'createdAt' || sortBy === 'bannedAt') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
      // 如果日期无效，使用 0（最早时间）
      if (isNaN(aVal)) aVal = 0;
      if (isNaN(bVal)) bVal = 0;
    }
    
    // 处理 null/undefined 值
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    
    // 转换为字符串进行比较（如果不是数字）
    if (typeof aVal !== 'number' && typeof bVal !== 'number') {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    
    if (order === 'desc') {
      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
    } else {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    }
  });

  return users;
}

// 封禁用户
function banUser(userId, reason = '') {
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    throw new Error('用户不存在');
  }
  user.isBanned = true;
  user.bannedAt = new Date().toISOString();
  user.banReason = reason;
  writeUsers(users);
  return user;
}

// 解封用户
function unbanUser(userId) {
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    throw new Error('用户不存在');
  }
  user.isBanned = false;
  user.bannedAt = null;
  user.banReason = null;
  writeUsers(users);
  return user;
}

// 删除用户（同时清理相关数据）
function deleteUser(userId) {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    throw new Error('用户不存在');
  }
  
  // 删除用户记录
  users.splice(index, 1);
  writeUsers(users);
  
  // 清理用户相关数据
  try {
    // 删除用户的消息
    const { deleteUserMessages } = require('./messageStore');
    const deletedMessagesCount = deleteUserMessages(userId);
    if (deletedMessagesCount > 0) {
      logger.info('userStore', `已删除用户 ${userId} 的 ${deletedMessagesCount} 条消息`);
    }
    
    // 删除用户的消息历史记录
    const { deleteUserHistory } = require('./messageHistoryStore');
    const deletedHistoryCount = deleteUserHistory(userId);
    if (deletedHistoryCount > 0) {
      logger.info('userStore', `已删除用户 ${userId} 的 ${deletedHistoryCount} 条历史记录`);
    }
    
    // 删除用户的数据文件（笔记、文件夹、URL等）
    const { deleteUserData } = require('./userDataStore');
    const deletedData = deleteUserData(userId);
    if (deletedData) {
      logger.info('userStore', `已删除用户 ${userId} 的数据文件`);
    }
  } catch (e) {
    // 记录错误但不阻止用户删除
    logger.error('userStore', `清理用户 ${userId} 相关数据时出错:`, e);
  }
  
  return true;
}

// 修改用户密码
async function updatePassword(email, newPassword) {
  const users = readUsers();
  const user = users.find((u) => u.email === email);
  if (!user) {
    throw new Error('用户不存在');
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  writeUsers(users);
  return user;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  getAllUsers,
  filterUsers,
  banUser,
  unbanUser,
  deleteUser,
  updatePassword,
};


