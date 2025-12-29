const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const { sendVerificationCodeEmail } = require('../config/mailer');
const { generateCode, saveCode, verifyCode, codes, normalizeEmail } = require('../store/verificationStore');
const { createUser, findUserByEmail, verifyPassword, updatePassword, deleteUser, findUserById } = require('../store/userStore');

const router = express.Router();

// 速率限制配置
const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次请求
  message: '发送验证码次数过多，请15分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 最多10次注册尝试
  message: '注册尝试次数过多，请1小时后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次登录尝试
  message: '登录尝试次数过多，请15分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 使用统一的验证函数
const {
  validateEmail,
  validateUsername,
  validatePassword,
  validateCode,
} = require('../utils/validators');

const JWT_SECRET = process.env.JWT_SECRET;

// 检查 JWT_SECRET 是否设置
if (!JWT_SECRET) {
  console.error('[auth] 错误：未设置 JWT_SECRET 环境变量！');
  console.error('[auth] 请在 .env 文件中设置 JWT_SECRET=your-random-secret-string');
  if (process.env.NODE_ENV === 'production') {
    console.error('[auth] 生产环境必须设置 JWT_SECRET，退出启动');
    process.exit(1);
  } else {
    console.warn('[auth] 开发环境：使用默认值（不安全，仅用于开发）');
  }
}

const FINAL_JWT_SECRET = JWT_SECRET || 'dev-secret-change-me-in-production';

// JWT 验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: '未授权，请先登录' });
  }

  jwt.verify(token, FINAL_JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token无效或已过期' });
    }
    req.user = user;
    next();
  });
};

// 发送邮箱验证码（需要速率限制）
router.post('/send-code', sendCodeLimiter, async (req, res) => {
  const { email } = req.body || {};
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: '邮箱不能为空' });
  }

  // 验证邮箱格式和长度
  if (!validateEmail(email)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }
  
  const emailKey = normalizeEmail(email);

  try {
    const code = generateCode();
    saveCode(emailKey, code);
    await sendVerificationCodeEmail(email, code);
    console.log(`[auth] 验证码已发送到 ${email}，key=${emailKey}`);
    res.json({ message: '验证码已发送到您的邮箱，请查收' });
  } catch (e) {
    console.error('[auth] send-code error:', e);
    const errorMessage = e.message || '发送验证码失败，请稍后重试';
    res.status(500).json({ 
      message: errorMessage.includes('SMTP') 
        ? '邮件服务未配置，请联系管理员' 
        : errorMessage 
    });
  }
});

// 注册（需要速率限制）
router.post('/register', registerLimiter, async (req, res) => {
  const { email, username, password, code } = req.body || {};

  // 输入验证
  if (!email || !username || !password || !code) {
    return res.status(400).json({ message: '邮箱、用户名、密码和验证码不能为空' });
  }

  // 验证邮箱格式
  if (!validateEmail(email)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }

  // 验证用户名
  if (!validateUsername(username)) {
    return res.status(400).json({ message: '用户名格式不正确（2-50个字符，只能包含字母、数字、下划线和中文）' });
  }

  // 验证密码
  if (!validatePassword(password)) {
    return res.status(400).json({ message: '密码长度必须在6-100个字符之间' });
  }

  // 验证验证码格式
  if (!validateCode(code)) {
    return res.status(400).json({ message: '验证码格式不正确（应为6位数字）' });
  }

  const emailKey = normalizeEmail(email);
  console.log('[auth] register request:', { email, username, codeProvided: !!code });

  // 先验证验证码，但不删除（如果注册失败，验证码仍然有效）
  const record = codes.get(emailKey);
  if (!record) {
    console.log(`[auth] 邮箱 ${email} (key=${emailKey}) 没有验证码记录`);
    return res.status(400).json({ message: '验证码错误或已过期' });
  }
  if (Date.now() > record.expiresAt) {
    codes.delete(emailKey);
    console.log(`[auth] 邮箱 ${email} 的验证码已过期`);
    return res.status(400).json({ message: '验证码错误或已过期' });
  }
  if (record.code !== code) {
    // 不记录验证码内容，只记录错误
    console.log(`[auth] 邮箱 ${email} 验证码错误`);
    return res.status(400).json({ message: '验证码错误或已过期' });
  }

  // 验证码正确，尝试创建用户
  try {
    const user = await createUser({ email: emailKey, username, password });
    // 只有注册成功后才删除验证码
    codes.delete(emailKey);
    console.log(`[auth] 用户注册成功: ${email} (key=${emailKey}), 验证码已删除`);
    
    const token = jwt.sign({ id: user.id, email: user.email }, FINAL_JWT_SECRET, {
      expiresIn: '7d',
    });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.error('[auth] register error:', e);
    // 注册失败时不删除验证码，允许用户重试
    res.status(400).json({ message: e.message || '注册失败' });
  }
});

// 登录（需要速率限制）
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  
  // 输入验证
  if (!email || !password) {
    return res.status(400).json({ message: '邮箱和密码不能为空' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ message: '密码格式不正确' });
  }
  
  // 减少敏感信息日志（生产环境不记录邮箱）
  if (process.env.NODE_ENV !== 'production') {
    console.log('[auth] login request:', { email: email.substring(0, 3) + '***', passwordProvided: !!password });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      // 不泄露用户是否存在的信息，统一错误消息
      console.log(`[auth] 登录失败: ${email.substring(0, 3)}***`);
      return res.status(400).json({ message: '邮箱或密码错误' });
    }

    // 检查用户是否被封禁
    if (user.isBanned) {
      console.log(`[auth] 用户已被封禁: ${email.substring(0, 3)}***`);
      return res.status(403).json({ 
        message: `您的账号已被封禁${user.banReason ? '，原因：' + user.banReason : ''}` 
      });
    }

    const ok = await verifyPassword(user, password);
    if (!ok) {
      // 不泄露密码错误信息，统一错误消息
      console.log(`[auth] 登录失败: ${email.substring(0, 3)}***`);
      return res.status(400).json({ message: '邮箱或密码错误' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, FINAL_JWT_SECRET, {
      expiresIn: '7d',
    });

    console.log(`[auth] 登录成功: ${email}`);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
      },
    });
  } catch (e) {
    console.error('[auth] login error:', e);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
});

// 修改密码（需要邮箱验证码）
router.post('/change-password', sendCodeLimiter, async (req, res) => {
  const { email, newPassword, code } = req.body || {};

  // 输入验证
  if (!email || !newPassword || !code) {
    return res.status(400).json({ message: '邮箱、新密码和验证码不能为空' });
  }

  // 验证邮箱格式
  if (!validateEmail(email)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }

  // 验证密码
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ message: '密码长度必须在6-100个字符之间' });
  }

  // 验证验证码格式
  if (!validateCode(code)) {
    return res.status(400).json({ message: '验证码格式不正确（应为6位数字）' });
  }

  const emailKey = normalizeEmail(email);
  if (!verifyCode(emailKey, code)) {
    return res.status(400).json({ message: '验证码错误或已过期' });
  }

  try {
    await updatePassword(emailKey, newPassword);
    res.json({ message: '密码修改成功' });
  } catch (e) {
    console.error('[auth] change-password error:', e);
    res.status(400).json({ message: e.message || '修改密码失败' });
  }
});

// 注销账户（需要JWT验证）
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 验证用户是否存在
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 检查用户是否被封禁
    if (user.isBanned) {
      console.log(`[auth] 被封禁用户尝试注销账户: ${user.email} (ID: ${userId})`);
      return res.status(403).json({ 
        message: `您的账号已被封禁，无法注销账户${user.banReason ? '，原因：' + user.banReason : ''}` 
      });
    }

    // 删除用户账户
    await deleteUser(userId);
    console.log(`[auth] 用户账户已注销: ${user.email} (ID: ${userId})`);
    
    res.json({ message: '账户注销成功' });
  } catch (e) {
    console.error('[auth] delete account error:', e);
    res.status(500).json({ message: e.message || '注销账户失败' });
  }
});

module.exports = router;


