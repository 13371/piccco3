const path = require('path');
const bcrypt = require('bcryptjs');
const { readJsonFile, writeJsonFile, ensureDir } = require('../utils/fileStore');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// 确保数据目录存在
ensureDir(DATA_DIR);

function readUsers() {
  return readJsonFile(USERS_FILE, []);
}

function writeUsers(users) {
  const success = writeJsonFile(USERS_FILE, users);
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
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw)
    );
  }

  // 封禁状态筛选
  if (isBanned !== undefined) {
    users = users.filter((u) => u.isBanned === isBanned);
  }

  // 排序
  users.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (sortBy === 'createdAt' || sortBy === 'bannedAt') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    if (order === 'desc') {
      return bVal > aVal ? 1 : -1;
    } else {
      return aVal > bVal ? 1 : -1;
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

// 删除用户
function deleteUser(userId) {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    throw new Error('用户不存在');
  }
  users.splice(index, 1);
  writeUsers(users);
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


