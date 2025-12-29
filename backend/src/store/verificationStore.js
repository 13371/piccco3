// 简单的内存验证码存储（生产环境建议使用 Redis 等独立存储）

const codes = new Map();

const EXPIRE_MS = 10 * 60 * 1000; // 10 分钟

// 标准化邮箱，用于避免大小写或空格导致的验证码查找失败
const normalizeEmail = (email = '') => email.trim().toLowerCase();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function saveCode(email, code) {
  const expiresAt = Date.now() + EXPIRE_MS;
  codes.set(normalizeEmail(email), { code, expiresAt });
}

function verifyCode(email, code) {
  const record = codes.get(normalizeEmail(email));
  if (!record) {
    console.log(`[verificationStore] 邮箱 ${email} 没有验证码记录`);
    return false;
  }
  if (Date.now() > record.expiresAt) {
    codes.delete(email);
    console.log(`[verificationStore] 邮箱 ${email} 的验证码已过期`);
    return false;
  }
  const ok = record.code === code;
  if (ok) {
    codes.delete(normalizeEmail(email));
    console.log(`[verificationStore] 邮箱 ${email} 验证码验证成功`);
  } else {
    console.log(`[verificationStore] 邮箱 ${email} 验证码错误`);
  }
  return ok;
}

module.exports = {
  generateCode,
  saveCode,
  verifyCode,
  codes, // 导出 codes Map 以便在路由中直接访问
  normalizeEmail,
};






