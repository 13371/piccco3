const express = require('express');
const jwt = require('jsonwebtoken');
const { getUserMessages, markMessageAsRead } = require('../store/messageStore');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// JWT 验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: '未授权，请先登录' });
  }

  if (!JWT_SECRET) {
    console.error('[message] JWT_SECRET 未配置');
    return res.status(500).json({ message: '服务器配置错误' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token无效或已过期' });
    }
    req.user = user;
    next();
  });
};

// 获取当前用户的消息（需要认证）
router.get('/messages', authenticateToken, (req, res) => {
  try {
    // 从 JWT token 中获取用户ID，而不是从 query 参数
    const userId = req.user.id;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: '用户ID无效' });
    }
    
    const messages = getUserMessages(userId);
    // 确保时间戳是数字格式
    const formattedMessages = messages.map(msg => ({
      ...msg,
      createdAt: typeof msg.createdAt === 'string' ? new Date(msg.createdAt).getTime() : msg.createdAt
    }));
    res.json({ messages: formattedMessages });
  } catch (e) {
    console.error('[message] get messages error:', e);
    res.status(500).json({ message: '获取消息失败' });
  }
});

// 标记消息为已读（需要认证，且只能标记自己的消息）
router.post('/messages/:messageId/read', authenticateToken, (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    // 验证 messageId 格式
    if (!messageId || typeof messageId !== 'string' || !messageId.startsWith('msg_')) {
      return res.status(400).json({ message: '消息ID格式无效' });
    }
    
    // 先获取消息，检查是否属于当前用户
    const userMessages = getUserMessages(userId);
    const message = userMessages.find(m => m.id === messageId);
    
    if (!message) {
      return res.status(404).json({ message: '消息不存在或无权访问' });
    }
    
    // 标记为已读
    const updatedMessage = markMessageAsRead(messageId);
    if (!updatedMessage) {
      return res.status(500).json({ message: '标记失败' });
    }
    
    res.json({ message: '消息已标记为已读' });
  } catch (e) {
    console.error('[message] mark read error:', e);
    res.status(500).json({ message: '标记失败' });
  }
});

module.exports = router;

