/**
 * 隐私文件夹密码加密工具
 * 使用简单的哈希算法加密密码（前端存储）
 */

/**
 * 生成简单的哈希值（用于前端存储，不是真正的加密）
 * 注意：这只是基本的混淆，不是真正的安全加密
 * 真正的安全需要后端支持或使用Web Crypto API
 */
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // 添加盐值（基于用户ID，如果可用）
  const userId = localStorage.getItem('piccco-user-storage') 
    ? JSON.parse(localStorage.getItem('piccco-user-storage') || '{}')?.state?.currentUser?.id || ''
    : '';
  const salt = userId ? userId.slice(-8) : 'piccco_salt';
  return `${hash.toString(36)}_${salt}`;
}

/**
 * 加密隐私文件夹密码
 * @param password 明文密码
 * @returns 加密后的密码（用于存储）
 */
export function encryptPrivacyPassword(password: string): string {
  if (!password) return '';
  // 使用简单的哈希 + Base64编码
  const hash = simpleHash(password);
  // 添加时间戳增加唯一性
  const timestamp = Date.now().toString(36);
  return btoa(`${hash}_${timestamp}`).replace(/[+/=]/g, (m) => {
    return { '+': '-', '/': '_', '=': '' }[m] || '';
  });
}

/**
 * 验证隐私文件夹密码
 * @param inputPassword 用户输入的密码
 * @param storedHash 存储的哈希值
 * @returns 是否匹配
 */
export function verifyPrivacyPassword(inputPassword: string, storedHash: string): boolean {
  if (!inputPassword || !storedHash) return false;
  
  try {
    // 解码存储的哈希
    const decoded = atob(storedHash.replace(/[-_]/g, (m) => {
      return { '-': '+', '_': '/' }[m] || '';
    }));
    const [originalHash] = decoded.split('_');
    
    // 计算输入密码的哈希
    const inputHash = simpleHash(inputPassword);
    const [inputHashValue] = inputHash.split('_');
    
    // 比较哈希值（只比较哈希部分，忽略时间戳）
    return originalHash === inputHashValue;
  } catch (e) {
    // 如果解码失败，可能是旧格式的明文密码，尝试直接比较
    // 这是为了兼容性，允许迁移旧数据
    return inputPassword === storedHash;
  }
}

/**
 * 检查密码是否为旧格式（明文）
 * @param storedPassword 存储的密码
 * @returns 是否为旧格式
 */
export function isLegacyPassword(storedPassword: string): boolean {
  if (!storedPassword) return false;
  // 如果密码不包含Base64特征字符，可能是旧格式
  return !storedPassword.includes('-') && !storedPassword.includes('_') && storedPassword.length < 20;
}









