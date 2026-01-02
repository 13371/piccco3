// 日志存储模块 - 将日志保存到内存中，供网页查看

const MAX_LOG_ENTRIES = 1000; // 最多保存1000条日志

// 内存中的日志数组
let logs = [];

/**
 * 添加日志条目
 * @param {string} message - 日志消息
 * @param {string} level - 日志级别 (info, warn, error, debug)
 */
function addLog(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    id: Date.now() + Math.random(), // 唯一ID
    timestamp,
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message, null, 2),
  };
  
  logs.push(logEntry);
  
  // 限制日志数量，保留最新的
  if (logs.length > MAX_LOG_ENTRIES) {
    logs = logs.slice(-MAX_LOG_ENTRIES);
  }
  
  return logEntry;
}

/**
 * 获取日志
 * @param {number} limit - 返回的日志条数限制
 * @param {string} level - 过滤日志级别
 * @returns {Array} 日志数组
 */
function getLogs(limit = 100, level = null) {
  let filteredLogs = logs;
  
  if (level) {
    filteredLogs = logs.filter(log => log.level === level);
  }
  
  // 返回最新的日志
  return filteredLogs.slice(-limit);
}

/**
 * 清空日志
 */
function clearLogs() {
  logs = [];
}

/**
 * 获取日志统计
 */
function getLogStats() {
  return {
    total: logs.length,
    byLevel: {
      info: logs.filter(l => l.level === 'info').length,
      warn: logs.filter(l => l.level === 'warn').length,
      error: logs.filter(l => l.level === 'error').length,
      debug: logs.filter(l => l.level === 'debug').length,
    },
  };
}

module.exports = {
  addLog,
  getLogs,
  clearLogs,
  getLogStats,
};






