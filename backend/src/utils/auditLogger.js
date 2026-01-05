/**
 * 审计日志工具
 * 记录用户操作，用于安全审计和问题追踪
 */
const logger = require('./logger');
const path = require('path');
const fs = require('fs').promises;
const { ensureDir } = require('./fileStore');

const AUDIT_LOG_DIR = path.join(__dirname, '..', '..', 'data', 'audit-logs');

// 确保审计日志目录存在
(async () => {
  try {
    await ensureDir(AUDIT_LOG_DIR);
  } catch (e) {
    logger.error('auditLogger', '初始化审计日志目录失败:', e);
  }
})();

/**
 * 审计日志级别
 */
const AuditLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY', // 安全相关操作
};

/**
 * 记录审计日志
 * @param {string} userId - 用户ID
 * @param {string} action - 操作类型（如 'login', 'create_note', 'delete_folder'）
 * @param {object} details - 详细信息
 * @param {string} level - 日志级别
 */
async function logAudit(userId, action, details = {}, level = AuditLevel.INFO) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      userId,
      action,
      level,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
    };

    // 写入日志文件（按日期分割）
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(AUDIT_LOG_DIR, `audit-${date}.jsonl`);

    // 追加到文件（JSON Lines 格式）
    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');

    // 同时输出到控制台（重要操作）
    if (level === AuditLevel.SECURITY || level === AuditLevel.ERROR) {
      logger.warn('audit', `[${level}] ${action} by ${userId}:`, details);
    } else if (level === AuditLevel.WARNING) {
      logger.info('audit', `[${level}] ${action} by ${userId}`);
    }
  } catch (e) {
    logger.error('auditLogger', '记录审计日志失败:', e);
  }
}

/**
 * 记录安全相关操作
 */
async function logSecurity(userId, action, details = {}) {
  return logAudit(userId, action, details, AuditLevel.SECURITY);
}

/**
 * 记录警告操作
 */
async function logWarning(userId, action, details = {}) {
  return logAudit(userId, action, details, AuditLevel.WARNING);
}

/**
 * 记录错误操作
 */
async function logError(userId, action, details = {}) {
  return logAudit(userId, action, details, AuditLevel.ERROR);
}

/**
 * 从请求中提取审计信息
 */
function extractAuditInfo(req) {
  return {
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    method: req.method,
    path: req.path,
  };
}

module.exports = {
  logAudit,
  logSecurity,
  logWarning,
  logError,
  extractAuditInfo,
  AuditLevel,
};

