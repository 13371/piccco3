// 用户数据访问层（DAO）
const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../config');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');
const bcrypt = require('bcryptjs');

/**
 * 创建用户
 */
async function createUser({ id, email, username, password, createdAt }) {
  try {
    // 对密码进行 bcrypt 哈希处理
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await query(
      `INSERT INTO users (id, email, username, password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (id) DO NOTHING`,
      [id, email, username, hashedPassword, createdAt || new Date().toISOString()]
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
    // 先查找用户信息（用于清除缓存）
    const user = await findUserById(userId);
    
    // 清除用户相关的缓存
    if (user) {
      cache.del(`user:id:${userId}`);
      if (user.email) {
        cache.del(`user:email:${user.email}`);
      }
    }
    
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
    // 对密码进行 bcrypt 哈希处理
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP
       WHERE email = $2`,
      [hashedPassword, email]
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
    let needsEmailCacheClear = false;

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

    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex}`);
      params.push(updates.email);
      paramIndex++;
      needsEmailCacheClear = true;
    }

    if (setClauses.length === 0) {
      return await findUserById(userId);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(userId);

    // 如果更新了邮箱，需要先获取旧邮箱以清除缓存
    let oldEmail = null;
    if (needsEmailCacheClear) {
      const oldUserResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (oldUserResult.rows[0] && oldUserResult.rows[0].email) {
        oldEmail = oldUserResult.rows[0].email;
      }
    }

    // 使用 RETURNING 子句直接返回更新后的数据，避免额外的查询
    const result = await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (!result.rows[0]) {
      throw new Error('用户不存在');
    }

    const updatedUser = formatUser(result.rows[0]);

    // 清除缓存
    cache.del(`user:id:${userId}`);
    if (oldEmail) {
      cache.del(`user:email:${oldEmail}`);
    }
    // 如果更新了邮箱，也清除新邮箱的缓存
    if (needsEmailCacheClear && updatedUser.email) {
      cache.del(`user:email:${updatedUser.email}`);
    }

    return updatedUser;
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
    logger.warn('userDao', 'verifyPassword: 缺少必要参数', {
      hasUser: !!user,
      hasPassword: !!user?.password,
      hasInputPassword: !!password,
    });
    return false;
  }
  
  // 检查密码格式是否为 bcrypt
  const passwordHash = user.password;
  if (!passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2b$') && !passwordHash.startsWith('$2y$')) {
    logger.error('userDao', '密码格式不正确，不是 bcrypt 哈希', {
      email: user.email,
      passwordPrefix: passwordHash.substring(0, 10),
      passwordLength: passwordHash.length,
    });
    return false;
  }
  
  try {
    const result = await bcrypt.compare(password, passwordHash);
    if (!result) {
      logger.debug('userDao', '密码验证失败（密码不匹配）', {
        email: user.email,
      });
    }
    return result;
  } catch (error) {
    logger.error('userDao', '密码验证异常', {
      error: error.message,
      stack: error.stack,
      email: user.email,
      passwordHashPrefix: passwordHash.substring(0, 10),
    });
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



