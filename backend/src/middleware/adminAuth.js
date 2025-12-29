// Admin认证中间件
const bcrypt = require('bcryptjs');

// 从环境变量获取密码，如果没有设置则使用默认值（仅开发环境）
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || 'admin123';
// 如果设置了ADMIN_PASSWORD_HASH，优先使用哈希值
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// 初始化时生成哈希（如果使用明文密码）
let adminPasswordHash = ADMIN_PASSWORD_HASH;
if (!ADMIN_PASSWORD_HASH && ADMIN_PASSWORD_PLAIN) {
  // 同步生成哈希（仅用于初始化，实际比较使用异步）
  adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD_PLAIN, 10);
  console.warn('[adminAuth] 警告：使用明文密码，建议设置 ADMIN_PASSWORD_HASH 环境变量');
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
  
  // 如果设置了哈希值，使用bcrypt比较
  if (ADMIN_PASSWORD_HASH) {
    return await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  }
  
  // 否则使用明文比较（仅开发环境）
  return password === ADMIN_PASSWORD_PLAIN;
}

module.exports = {
  requireAdminAuth,
  checkAdminPassword,
};

