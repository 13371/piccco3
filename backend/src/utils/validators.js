// 输入验证工具函数

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321 限制
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证用户名格式
 * @param {string} username - 用户名
 * @returns {boolean} 是否有效
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 2 || username.length > 50) return false;
  // 只允许字母、数字、下划线、中文字符
  const usernameRegex = /^[\w\u4e00-\u9fa5]+$/;
  return usernameRegex.test(username);
}

/**
 * 验证密码格式
 * @param {string} password - 密码
 * @returns {boolean} 是否有效
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 6 || password.length > 100) return false;
  return true;
}

/**
 * 验证验证码格式（6位数字）
 * @param {string} code - 验证码
 * @returns {boolean} 是否有效
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^\d{6}$/.test(code);
}

/**
 * 验证用户ID格式
 * @param {string} userId - 用户ID
 * @returns {boolean} 是否有效
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') return false;
  // 用户ID通常是时间戳字符串
  return /^\d+$/.test(userId) && userId.length <= 20;
}

/**
 * 验证消息ID格式
 * @param {string} messageId - 消息ID
 * @returns {boolean} 是否有效
 */
function validateMessageId(messageId) {
  if (!messageId || typeof messageId !== 'string') return false;
  return messageId.startsWith('msg_') && messageId.length > 10;
}

/**
 * 清理和验证字符串输入
 * @param {string} input - 输入字符串
 * @param {number} maxLength - 最大长度
 * @returns {string|null} 清理后的字符串，无效返回null
 */
function sanitizeString(input, maxLength = 1000) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

module.exports = {
  validateEmail,
  validateUsername,
  validatePassword,
  validateCode,
  validateUserId,
  validateMessageId,
  sanitizeString,
};


