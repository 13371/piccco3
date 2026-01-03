// 消息数据访问层（DAO）
const { query } = require('../config');
const logger = require('../../utils/logger');

/**
 * 生成唯一消息ID
 */
function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const counter = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `msg_${timestamp}_${random}_${counter}`;
}

/**
 * 发送消息到用户
 */
async function sendMessageToUser(userId, title, content) {
  try {
    const id = generateMessageId();
    const createdAt = Date.now();
    
    await query(
      `INSERT INTO messages (id, user_id, title, content, is_read, created_at)
       VALUES ($1, $2, $3, $4, FALSE, $5)`,
      [id, userId, title, content, createdAt]
    );

    return {
      id,
      userId,
      title,
      content,
      isRead: false,
      createdAt,
    };
  } catch (error) {
    logger.error('messageDao', '发送消息失败', error);
    throw error;
  }
}

/**
 * 获取用户的所有消息
 */
async function getUserMessages(userId) {
  try {
    const result = await query(
      `SELECT * FROM messages 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(formatMessage);
  } catch (error) {
    logger.error('messageDao', '获取用户消息失败', error);
    throw error;
  }
}

/**
 * 标记消息为已读
 */
async function markMessageAsRead(messageId) {
  try {
    await query(
      `UPDATE messages SET is_read = TRUE WHERE id = $1`,
      [messageId]
    );

    const result = await query('SELECT * FROM messages WHERE id = $1', [messageId]);
    return result.rows[0] ? formatMessage(result.rows[0]) : null;
  } catch (error) {
    logger.error('messageDao', '标记消息已读失败', error);
    throw error;
  }
}

/**
 * 删除消息
 */
async function deleteMessage(messageId) {
  try {
    const result = await query('DELETE FROM messages WHERE id = $1', [messageId]);
    return result.rowCount > 0;
  } catch (error) {
    logger.error('messageDao', '删除消息失败', error);
    throw error;
  }
}

/**
 * 删除用户的所有消息
 */
async function deleteUserMessages(userId) {
  try {
    const result = await query('DELETE FROM messages WHERE user_id = $1', [userId]);
    return result.rowCount;
  } catch (error) {
    logger.error('messageDao', '删除用户消息失败', error);
    throw error;
  }
}

/**
 * 向所有用户发送消息
 */
async function sendMessageToAllUsers(title, content, userIds) {
  try {
    const baseTimestamp = Date.now();
    const messages = [];

    for (let i = 0; i < userIds.length; i++) {
      const id = `msg_${baseTimestamp}_${i}_${Math.random().toString(36).slice(2, 8)}_${userIds[i]}`;
      const createdAt = baseTimestamp + i;

      await query(
        `INSERT INTO messages (id, user_id, title, content, is_read, created_at)
         VALUES ($1, $2, $3, $4, FALSE, $5)`,
        [id, userIds[i], title, content, createdAt]
      );

      messages.push({
        id,
        userId: userIds[i],
        title,
        content,
        isRead: false,
        createdAt,
      });
    }

    return messages;
  } catch (error) {
    logger.error('messageDao', '群发消息失败', error);
    throw error;
  }
}

/**
 * 格式化消息数据
 */
function formatMessage(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    isRead: row.is_read || false,
    createdAt: typeof row.created_at === 'number' ? row.created_at : parseInt(row.created_at, 10),
  };
}

module.exports = {
  sendMessageToUser,
  getUserMessages,
  markMessageAsRead,
  deleteMessage,
  sendMessageToAllUsers,
  deleteUserMessages,
};





