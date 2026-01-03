// 消息历史数据访问层（DAO）
const { query } = require('../config');
const logger = require('../../utils/logger');

/**
 * 生成唯一历史记录ID
 */
function generateHistoryId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const counter = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `hist_${timestamp}_${random}_${counter}`;
}

/**
 * 记录发送消息历史
 */
async function addMessageHistory({ userId, title, content, type = 'single' }) {
  try {
    const id = generateHistoryId();
    const createdAt = Date.now();

    await query(
      `INSERT INTO message_history (id, user_id, title, content, type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, userId || null, title, content, type, createdAt]
    );

    return {
      id,
      userId: userId || null,
      title,
      content,
      type,
      createdAt,
    };
  } catch (error) {
    logger.error('messageHistoryDao', '记录消息历史失败', error);
    throw error;
  }
}

/**
 * 记录群发消息历史
 */
async function addBroadcastHistory({ title, content, userCount }) {
  try {
    const id = generateHistoryId();
    const createdAt = Date.now();

    await query(
      `INSERT INTO message_history (id, user_id, title, content, type, user_count, created_at)
       VALUES ($1, NULL, $2, $3, 'broadcast', $4, $5)`,
      [id, title, content, userCount, createdAt]
    );

    return {
      id,
      userId: null,
      title,
      content,
      type: 'broadcast',
      userCount,
      createdAt,
    };
  } catch (error) {
    logger.error('messageHistoryDao', '记录群发历史失败', error);
    throw error;
  }
}

/**
 * 获取所有发送历史（支持分页和过滤）
 */
async function getMessageHistory({ page = 1, limit = 20, type, userId } = {}) {
  try {
    let sql = 'SELECT * FROM message_history WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // 按类型过滤
    if (type) {
      sql += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // 按用户ID过滤
    if (userId) {
      sql += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // 排序
    sql += ' ORDER BY created_at DESC';

    // 分页
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    const result = await query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM message_history WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (type) {
      countSql += ` AND type = $${countParamIndex}`;
      countParams.push(type);
      countParamIndex++;
    }

    if (userId) {
      countSql += ` AND user_id = $${countParamIndex}`;
      countParams.push(userId);
      countParamIndex++;
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      history: result.rows.map(formatHistory),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  } catch (error) {
    logger.error('messageHistoryDao', '获取消息历史失败', error);
    throw error;
  }
}

/**
 * 删除历史记录
 */
async function deleteHistory(historyId) {
  try {
    const result = await query('DELETE FROM message_history WHERE id = $1', [historyId]);
    return result.rowCount > 0;
  } catch (error) {
    logger.error('messageHistoryDao', '删除历史记录失败', error);
    throw error;
  }
}

/**
 * 删除用户相关的历史记录
 */
async function deleteUserHistory(userId) {
  try {
    const result = await query('DELETE FROM message_history WHERE user_id = $1', [userId]);
    return result.rowCount;
  } catch (error) {
    logger.error('messageHistoryDao', '删除用户历史记录失败', error);
    throw error;
  }
}

/**
 * 格式化历史记录数据
 */
function formatHistory(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    type: row.type || 'single',
    userCount: row.user_count || null,
    createdAt: typeof row.created_at === 'number' ? row.created_at : parseInt(row.created_at, 10),
  };
}

module.exports = {
  addMessageHistory,
  addBroadcastHistory,
  getMessageHistory,
  deleteHistory,
  deleteUserHistory,
};


