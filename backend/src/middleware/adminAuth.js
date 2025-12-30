// Admin认证中间件
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// 从环境变量获取密码，如果没有设置则使用默认值（仅开发环境）
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || 'admin123';
// 辅助函数：每次调用时从环境变量中读取并去掉首尾空格
function getAdminPasswordHash() {
  const raw = process.env.ADMIN_PASSWORD_HASH;
  if (!raw || typeof raw !== 'string') {
    return undefined;
  }
  return raw.trim();
}

// 初始化时生成哈希（如果使用明文密码）
let adminPasswordHash = getAdminPasswordHash();
if (!adminPasswordHash && ADMIN_PASSWORD_PLAIN) {
  // 同步生成哈希（仅用于初始化，实际比较使用异步）
  adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD_PLAIN, 10);
  logger.warn('adminAuth', '警告：使用明文密码，建议设置 ADMIN_PASSWORD_HASH 环境变量');
}

function requireAdminAuth(req, res, next) {
  // 检查session中是否有admin登录标记
  if (req.session && req.session.isAdmin) {
    // 检查session是否过期（可选：添加登录时间检查）
    return next();
  }
  
  // 如果是API请求，返回JSON错误
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ message: '未授权，请先登录管理员账户' });
  }
  
  // 如果是页面请求，返回401（admin UI会自己处理）
  return res.status(401).json({ message: '未授权，请先登录管理员账户' });
}

async function checkAdminPassword(password) {
  if (!password) {
    return false;
  }

  // 每次检查时重新从环境变量读取哈希，避免进程启动时缓存了错误的值
  const hashFromEnv = getAdminPasswordHash();

  // 如果设置了哈希值，使用bcrypt比较
  if (hashFromEnv) {
    return await bcrypt.compare(password, hashFromEnv);
  }
  
  // 否则使用明文比较（仅开发环境）
  return password === ADMIN_PASSWORD_PLAIN;
}

module.exports = {
  requireAdminAuth,
  checkAdminPassword,
};

