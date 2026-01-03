// PostgreSQL 数据库配置
const { Pool } = require('pg');
const logger = require('../utils/logger');

// 从环境变量读取数据库配置
// 注意：如果使用 PgBouncer，端口应该是 6432，而不是 PostgreSQL 的 5432
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || (process.env.USE_PGBOUNCER === 'true' ? '6432' : '5432'), 10),
  database: process.env.DB_NAME || 'piccco',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // 连接池最大连接数（单实例最大20）
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  // 如果使用 PgBouncer，需要设置 application_name
  application_name: process.env.USE_PGBOUNCER === 'true' ? 'piccco-app' : undefined,
};

// 创建连接池
let pool = null;

/**
 * 初始化数据库连接池
 */
function initPool() {
  if (pool) {
    return pool;
  }

  try {
    pool = new Pool(dbConfig);
    
    // 连接池错误处理
    pool.on('error', (err) => {
      logger.error('db', '数据库连接池错误:', err);
    });

    // 测试连接
    pool.query('SELECT NOW()', (err) => {
      if (err) {
        logger.error('db', '数据库连接测试失败:', err);
      } else {
        logger.info('db', '数据库连接池初始化成功');
      }
    });

    return pool;
  } catch (error) {
    logger.error('db', '初始化数据库连接池失败:', error);
    throw error;
  }
}

/**
 * 获取数据库连接池
 */
function getPool() {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * 执行查询
 * @param {string} text - SQL查询文本
 * @param {Array} params - 查询参数
 * @returns {Promise} 查询结果
 */
async function query(text, params = []) {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('db', `查询执行时间: ${duration}ms`, { text: text.substring(0, 100), params });
    }
    
    return result;
  } catch (error) {
    logger.error('db', '数据库查询错误:', { text: text.substring(0, 100), params, error: error.message });
    throw error;
  }
}

/**
 * 开始事务
 * @returns {Promise<Object>} 客户端对象
 */
async function beginTransaction() {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * 提交事务
 * @param {Object} client - 客户端对象
 */
async function commitTransaction(client) {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

/**
 * 回滚事务
 * @param {Object} client - 客户端对象
 */
async function rollbackTransaction(client) {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

/**
 * 关闭连接池
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('db', '数据库连接池已关闭');
  }
}

/**
 * 检查数据库连接
 */
async function checkConnection() {
  try {
    const result = await query('SELECT NOW()');
    return { connected: true, timestamp: result.rows[0].now };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

module.exports = {
  initPool,
  getPool,
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  closePool,
  checkConnection,
  dbConfig,
};



