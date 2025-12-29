const express = require('express');
const rateLimit = require('express-rate-limit');
const { getAllUsers, filterUsers, findUserById, banUser, unbanUser, deleteUser } = require('../store/userStore');
const { sendMessageToUser, sendMessageToAllUsers } = require('../store/messageStore');
const { addMessageHistory, addBroadcastHistory, getMessageHistory, deleteHistory } = require('../store/messageHistoryStore');
const { requireAdminAuth, checkAdminPassword } = require('../middleware/adminAuth');

const router = express.Router();

// 登录速率限制：5分钟内最多5次尝试
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 5, // 最多5次请求
  message: '登录尝试次数过多，请5分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin登录端点（不需要认证，但需要速率限制）
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body || {};
    
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: '密码不能为空' });
    }
    
    // 限制密码长度
    if (password.length > 200) {
      return res.status(400).json({ message: '密码长度无效' });
    }
    
    const isValid = await checkAdminPassword(password);
    if (isValid) {
      // 设置session
      req.session.isAdmin = true;
      req.session.loginTime = Date.now();
      
      console.log('[admin] 管理员登录成功');
      res.json({ message: '登录成功', success: true });
    } else {
      console.log('[admin] 管理员登录失败：密码错误');
      // 延迟响应以防止暴力破解（可选）
      await new Promise(resolve => setTimeout(resolve, 500));
      res.status(401).json({ message: '密码错误' });
    }
  } catch (e) {
    console.error('[admin] login error:', e);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
});

// Admin登出端点
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[admin] logout error:', err);
      return res.status(500).json({ message: '登出失败' });
    }
    res.json({ message: '已登出', success: true });
  });
});

// 检查登录状态
router.get('/check-auth', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// 以下所有路由都需要admin认证
router.use(requireAdminAuth);

// 获取所有用户（支持分页、过滤、排序）
router.get('/users', (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', isBanned, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    // 使用 filterUsers 进行搜索和排序
    let users = filterUsers({
      keyword: search,
      isBanned: isBanned !== undefined ? isBanned === 'true' : undefined,
      sortBy,
      order,
    });
    
    // 分页
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const paginatedUsers = users.slice(start, end);
    
    res.json({
      users: paginatedUsers,
      total: users.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(users.length / limitNum),
    });
  } catch (e) {
    console.error('[admin] get users error:', e);
    res.status(500).json({ message: '获取用户列表失败' });
  }
});

// 获取用户详情
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const { password, ...userInfo } = user;
    res.json({ user: userInfo });
  } catch (e) {
    console.error('[admin] get user error:', e);
    res.status(500).json({ message: '获取用户详情失败' });
  }
});

// 封禁用户
router.post('/users/:userId/ban', (req, res) => {
  try {
    const { userId } = req.params;
    let { reason = '' } = req.body || {};
    
    // 验证userId
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    // 限制reason长度
    if (typeof reason !== 'string') {
      reason = '';
    }
    if (reason.length > 500) {
      return res.status(400).json({ message: '封禁原因过长（最大500字符）' });
    }
    
    const user = banUser(userId, reason.trim());
    const { password, ...userInfo } = user;
    res.json({ message: '用户已封禁', user: userInfo });
  } catch (e) {
    console.error('[admin] ban user error:', e);
    res.status(400).json({ message: e.message || '封禁用户失败' });
  }
});

// 解封用户
router.post('/users/:userId/unban', (req, res) => {
  try {
    const { userId } = req.params;
    const user = unbanUser(userId);
    const { password, ...userInfo } = user;
    res.json({ message: '用户已解封', user: userInfo });
  } catch (e) {
    console.error('[admin] unban user error:', e);
    res.status(400).json({ message: e.message || '解封用户失败' });
  }
});

// 删除用户
router.delete('/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    deleteUser(userId);
    res.json({ message: '用户已删除' });
  } catch (e) {
    console.error('[admin] delete user error:', e);
    res.status(400).json({ message: e.message || '删除用户失败' });
  }
});

// 发送消息到用户
router.post('/users/:userId/message', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, content } = req.body || {};
    
    // 输入验证
    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' });
    }
    
    // 限制长度
    if (typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ message: '标题长度无效（最大200字符）' });
    }
    if (typeof content !== 'string' || content.length > 5000) {
      return res.status(400).json({ message: '内容长度无效（最大5000字符）' });
    }
    
    // 验证userId格式
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    // 检查用户是否存在
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    const message = sendMessageToUser(userId, title.trim(), content.trim());
    // 记录发送历史
    addMessageHistory({ userId, title: title.trim(), content: content.trim(), type: 'single' });
    res.json({ message: '消息已发送', data: message });
  } catch (e) {
    console.error('[admin] send message error:', e);
    res.status(500).json({ message: e.message || '发送消息失败' });
  }
});

// 向所有用户发送消息
router.post('/users/message/all', (req, res) => {
  try {
    const { title, content, onlyActive = false } = req.body || {};
    
    // 输入验证
    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' });
    }
    
    // 限制长度
    if (typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ message: '标题长度无效（最大200字符）' });
    }
    if (typeof content !== 'string' || content.length > 5000) {
      return res.status(400).json({ message: '内容长度无效（最大5000字符）' });
    }
    
    // 获取所有用户
    let users = getAllUsers();
    
    // 如果 onlyActive 为 true，只发送给未封禁的用户
    if (onlyActive === true || onlyActive === 'true') {
      users = users.filter(u => !u.isBanned);
    }
    
    if (users.length === 0) {
      return res.status(400).json({ message: '没有可发送的用户' });
    }
    
    const userIds = users.map(u => u.id);
    const messages = sendMessageToAllUsers(title.trim(), content.trim(), userIds);
    // 记录群发历史
    addBroadcastHistory({ title: title.trim(), content: content.trim(), userCount: messages.length });
    
    res.json({ 
      message: `消息已发送给 ${messages.length} 个用户`, 
      count: messages.length,
      data: messages 
    });
  } catch (e) {
    console.error('[admin] send message to all users error:', e);
    res.status(500).json({ message: e.message || '发送消息失败' });
  }
});

// 获取发送消息历史
router.get('/message-history', (req, res) => {
  try {
    const { page = 1, limit = 20, type, userId } = req.query;
    const result = getMessageHistory({ page, limit, type, userId });
    res.json(result);
  } catch (e) {
    console.error('[admin] get message history error:', e);
    res.status(500).json({ message: '获取发送历史失败' });
  }
});

// 删除发送历史记录
router.delete('/message-history/:historyId', (req, res) => {
  try {
    const { historyId } = req.params;
    const deleted = deleteHistory(historyId);
    if (deleted) {
      res.json({ message: '历史记录已删除' });
    } else {
      res.status(404).json({ message: '历史记录不存在' });
    }
  } catch (e) {
    console.error('[admin] delete message history error:', e);
    res.status(500).json({ message: '删除历史记录失败' });
  }
});

module.exports = router;
