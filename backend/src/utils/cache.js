// 内存缓存模块 - 用户信息缓存（5分钟TTL）
const logger = require('./logger');

// 缓存项结构：{ data, expiresAt }
const userCache = new Map();

// 缓存TTL（毫秒）- 5分钟
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 获取缓存
 * @param {string} key - 缓存键
 * @returns {any|null} 缓存数据，如果不存在或已过期则返回 null
 */
function get(key) {
  const item = userCache.get(key);
  
  if (!item) {
    return null;
  }
  
  // 检查是否过期
  if (Date.now() > item.expiresAt) {
    userCache.delete(key);
    return null;
  }
  
  return item.data;
}

/**
 * 设置缓存
 * @param {string} key - 缓存键
 * @param {any} data - 要缓存的数据
 * @param {number} ttl - 过期时间（毫秒），默认使用 CACHE_TTL
 */
function set(key, data, ttl = CACHE_TTL) {
  const expiresAt = Date.now() + ttl;
  userCache.set(key, { data, expiresAt });
}

/**
 * 删除缓存
 * @param {string} key - 缓存键
 */
function del(key) {
  userCache.delete(key);
}

/**
 * 清空所有缓存
 */
function clear() {
  userCache.clear();
}

/**
 * 清理过期缓存
 */
function cleanExpired() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, item] of userCache.entries()) {
    if (now > item.expiresAt) {
      userCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug('cache', `清理了 ${cleaned} 个过期缓存项`);
  }
}

/**
 * 获取缓存统计信息
 */
function getStats() {
  const now = Date.now();
  let total = 0;
  let expired = 0;
  
  for (const item of userCache.values()) {
    total++;
    if (now > item.expiresAt) {
      expired++;
    }
  }
  
  return {
    total,
    active: total - expired,
    expired,
  };
}

// 定期清理过期缓存（每10分钟）
setInterval(cleanExpired, 10 * 60 * 1000);

module.exports = {
  get,
  set,
  del,
  clear,
  cleanExpired,
  getStats,
};



