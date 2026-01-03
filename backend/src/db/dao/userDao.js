// 用户数据访问层（DAO）
const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../config');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');
const bcrypt = require('bcrypt');

/**
 * 创建用户
 */
async function createUser({ id, email, username, password, createdAt }) {
  try {
    await query(
      `INSERT INTO users (id, email, username, password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (id) DO NOTHING`,
      [id, email, username, password, createdAt || new Date().toISOString()]
    );
    
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? formatUser(result.rows[0]) : null;
  } catch (error) {
    logger.error('userDao', '创建用户失败', error);
    throw error;
  }
}

/**
 * 根据邮箱查找用户（带缓存）
 */
async function findUserByEmail(email) {
  try {
    // 先检查缓存
    const cacheKey = `user:email:${email}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0] ? formatUser(result.rows[0]) : null;
    
    // 缓存用户信息（5分钟）
    if (user) {
      cache.set(cacheKey, user);
    }
    
    return user;
  } catch (error) {
    logger.error('userDao', '查找用户失败', error);
    throw error;
  }
}

/**
 * 根据ID查找用户（带缓存）
 */
async function findUserById(id) {
  try {
    // 先检查缓存
    const cacheKey = `user:id:${id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    const user = result.rows[0] ? formatUser(result.rows[0]) : null;
    
    // 缓存用户信息（5分钟）
    if (user) {
      cache.set(cacheKey, user);
    }
    
    return user;
  } catch (error) {
    logger.error('userDao', '查找用户失败', error);
    throw error;
  }
}

/**
 * 获取所有用户（不包含密码）
 */
async function getAllUsers() {
  try {
    const result = await query('SELECT id, email, username, avatar, is_banned, banned_at, ban_reason, created_at, updated_at FROM users');
    return result.rows.map(formatUser);
  } catch (error) {
    logger.error('userDao', '获取所有用户失败', error);
    throw error;
  }
}

/**
 * 根据条件筛选用户
 */
async function filterUsers({ keyword, isBanned, sortBy = 'created_at', order = 'desc' }) {
  try {
    let sql = 'SELECT id, email, username, avatar, is_banned, banned_at, ban_reason, created_at, updated_at FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // 关键词搜索
    if (keyword) {
      sql += ` AND (LOWER(username) LIKE $${paramIndex} OR LOWER(email) LIKE $${paramIndex})`;
      params.push(`%${keyword.toLowerCase()}%`);
      paramIndex++;
    }

    // 封禁状态筛选
    if (isBanned !== undefined) {
      sql += ` AND is_banned = $${paramIndex}`;
      params.push(isBanned);
      paramIndex++;
    }

    // 排序
    const validSortBy = ['created_at', 'updated_at', 'banned_at', 'username', 'email'];
    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const result = await query(sql, params);
    return result.rows.map(formatUser);
  } catch (error) {
    logger.error('userDao', '筛选用户失败', error);
    throw error;
  }
}

/**
 * 封禁用户
 */
async function banUser(userId, reason = '') {
  try {
    await query(
      `UPDATE users 
       SET is_banned = TRUE, banned_at = CURRENT_TIMESTAMP, ban_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason, userId]
    );
    
    // 清除缓存
    cache.del(`user:id:${userId}`);
    
    return await findUserById(userId);
  } catch (error) {
    logger.error('userDao', '封禁用户失败', error);
    throw error;
  }
}

/**
 * 解封用户
 */
async function unbanUser(userId) {
  try {
    await query(
      `UPDATE users 
       SET is_banned = FALSE, banned_at = NULL, ban_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );
    
    // 清除缓存
    cache.del(`user:id:${userId}`);
    
    return await findUserById(userId);
  } catch (error) {
    logger.error('userDao', '解封用户失败', error);
    throw error;
  }
}

/**
 * 删除用户
 */
async function deleteUser(userId) {
  try {
    // 由于外键约束，删除用户会自动删除相关数据
    await query('DELETE FROM users WHERE id = $1', [userId]);
    return true;
  } catch (error) {
    logger.error('userDao', '删除用户失败', error);
    throw error;
  }
}

/**
 * 更新用户密码
 */
async function updatePassword(email, newPassword) {
  try {
    await query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP
       WHERE email = $2`,
      [newPassword, email]
    );
    
    // 清除缓存
    cache.del(`user:email:${email}`);
    
    return await findUserByEmail(email);
  } catch (error) {
    logger.error('userDao', '更新密码失败', error);
    throw error;
  }
}

/**
 * 更新用户信息
 */
async function updateUser(userId, updates) {
  try {
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (updates.username !== undefined) {
      setClauses.push(`username = $${paramIndex}`);
      params.push(updates.username);
      paramIndex++;
    }

    if (updates.avatar !== undefined) {
      setClauses.push(`avatar = $${paramIndex}`);
      params.push(updates.avatar);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return await findUserById(userId);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(userId);

    await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    // 清除缓存
    cache.del(`user:id:${userId}`);
    
    // 如果更新了邮箱，也需要清除邮箱缓存（需要先查询旧邮箱）
    const oldUser = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (oldUser.rows[0] && oldUser.rows[0].email) {
      cache.del(`user:email:${oldUser.rows[0].email}`);
    }

    return await findUserById(userId);
  } catch (error) {
    logger.error('userDao', '更新用户信息失败', error);
    throw error;
  }
}

/**
 * 验证密码
 */
async function verifyPassword(user, password) {
  if (!user || !user.password || !password) {
    return false;
  }
  
  try {
    return await bcrypt.compare(password, user.password);
  } catch (error) {
    logger.error('userDao', '密码验证失败', error);
    return false;
  }
}

/**
 * 格式化用户数据（数据库字段 -> 应用字段）
 */
function formatUser(row) {
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    password: row.password,
    avatar: row.avatar,
    isBanned: row.is_banned || false,
    bannedAt: row.banned_at ? new Date(row.banned_at).toISOString() : null,
    banReason: row.ban_reason,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  getAllUsers,
  filterUsers,
  banUser,
  unbanUser,
  deleteUser,
  updatePassword,
  updateUser,
  verifyPassword,
};



