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

/**
 * 验证URL格式
 * @param {string} url - URL地址
 * @returns {boolean} 是否有效
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.length > 2048) return false; // URL最大长度限制
  try {
    const urlObj = new URL(url);
    // 只允许 http 和 https 协议
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * 验证笔记内容
 * @param {string} content - 笔记内容
 * @param {number} maxLength - 最大长度（默认100000字符）
 * @returns {boolean} 是否有效
 */
function validateNoteContent(content, maxLength = 100000) {
  if (content === null || content === undefined) return true; // 允许空内容
  if (typeof content !== 'string') return false;
  if (content.length > maxLength) return false;
  return true;
}

/**
 * 验证文件夹名称
 * @param {string} name - 文件夹名称
 * @returns {boolean} 是否有效
 */
function validateFolderName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 50) return false;
  // 禁止特殊字符，防止路径遍历
  if (/[<>:"/\\|?*]/.test(trimmed)) return false;
  return true;
}

/**
 * 验证版本号
 * @param {number} version - 版本号
 * @returns {boolean} 是否有效
 */
function validateVersion(version) {
  if (version === null || version === undefined) return true; // 允许未设置版本号（向后兼容）
  if (typeof version !== 'number') return false;
  if (version < 0 || version > Number.MAX_SAFE_INTEGER) return false;
  return true;
}

module.exports = {
  validateEmail,
  validateUsername,
  validatePassword,
  validateCode,
  validateUserId,
  validateMessageId,
  sanitizeString,
  validateUrl,
  validateNoteContent,
  validateFolderName,
  validateVersion,
};



