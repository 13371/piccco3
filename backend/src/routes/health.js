// 健康检查和监控接口
const express = require('express');
const { checkConnection, getPool } = require('../db/config');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

// 请求统计
let requestStats = {
  totalRequests: 0,
  totalErrors: 0,
  requestsPerSecond: 0,
  lastResetTime: Date.now(),
  requestHistory: [], // 最近1000个请求的时间戳
};

// 更新请求统计
function updateRequestStats(isError = false) {
  requestStats.totalRequests++;
  if (isError) {
    requestStats.totalErrors++;
  }
  
  const now = Date.now();
  requestStats.requestHistory.push(now);
  
  // 只保留最近1分钟内的请求
  const oneMinuteAgo = now - 60000;
  requestStats.requestHistory = requestStats.requestHistory.filter(t => t > oneMinuteAgo);
  
  // 计算每秒请求数（基于最近1分钟）
  requestStats.requestsPerSecond = requestStats.requestHistory.length / 60;
}

/**
 * 健康检查接口
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    updateRequestStats(false);
    
    const dbStatus = await checkConnection();
    const pool = getPool();
    const poolStats = pool ? {
      totalCount: pool.totalCount || 0,
      idleCount: pool.idleCount || 0,
      waitingCount: pool.waitingCount || 0,
    } : null;
    
    const cacheStats = cache.getStats();
    
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      database: {
        connected: dbStatus.connected,
        timestamp: dbStatus.timestamp || null,
      },
      pool: poolStats,
      cache: cacheStats,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    });
  } catch (error) {
    updateRequestStats(true);
    logger.error('health', '健康检查失败', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: Date.now(),
    });
  }
});

/**
 * 详细监控接口
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
  try {
    updateRequestStats(false);
    
    const dbStatus = await checkConnection();
    const pool = getPool();
    
    // 获取数据库慢查询统计（如果启用了 pg_stat_statements）
    let slowQueries = [];
    try {
      const { query } = require('../db/config');
      const result = await query(`
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);
      slowQueries = result.rows;
    } catch (error) {
      // pg_stat_statements 可能未启用，忽略错误
      logger.debug('health', 'pg_stat_statements 未启用或不可用');
    }
    
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      database: {
        connected: dbStatus.connected,
        timestamp: dbStatus.timestamp || null,
      },
      pool: pool ? {
        totalCount: pool.totalCount || 0,
        idleCount: pool.idleCount || 0,
        waitingCount: pool.waitingCount || 0,
      } : null,
      cache: cache.getStats(),
      requests: {
        total: requestStats.totalRequests,
        errors: requestStats.totalErrors,
        perSecond: requestStats.requestsPerSecond.toFixed(2),
        errorRate: requestStats.totalRequests > 0 
          ? ((requestStats.totalErrors / requestStats.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
      },
      slowQueries: slowQueries.map(q => ({
        query: q.query.substring(0, 100), // 只显示前100个字符
        calls: q.calls,
        avgTime: Math.round(q.mean_exec_time) + 'ms',
        maxTime: Math.round(q.max_exec_time) + 'ms',
      })),
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        },
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    updateRequestStats(true);
    logger.error('health', '详细监控失败', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: Date.now(),
    });
  }
});

module.exports = router;

