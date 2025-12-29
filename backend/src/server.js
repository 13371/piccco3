const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { CONFIG } = require('./utils/config');
const { errorHandler, notFoundHandler } = require('./utils/errorHandler');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const adminUIRoutes = require('./routes/admin-ui');
const messageRoutes = require('./routes/message');
const dataRoutes = require('./routes/data');

const app = express();

const PORT = CONFIG.PORT;
const FRONTEND_ORIGIN = CONFIG.FRONTEND_ORIGIN;
const FINAL_SESSION_SECRET = CONFIG.SESSION_SECRET || 'piccco-admin-secret-change-me-in-production';

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(cookieParser());
// 限制请求体大小，防止DoS攻击
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session配置
app.use(
  session({
    secret: FINAL_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'piccco.admin.sid', // 自定义session名称，避免与其他应用冲突
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS时设为true
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24小时
      sameSite: 'lax', // CSRF保护
    },
  })
);

// 根路径 - 显示 API 信息
app.get('/', (_req, res) => {
  res.json({ 
    message: 'piccco Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      admin: '/api/admin',
      adminUI: '/admin'
    },
    adminUI: '访问 /admin 查看管理界面'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/data', dataRoutes);
app.use('/admin', adminUIRoutes);

// 404处理（必须在所有路由之后）
app.use(notFoundHandler);

// 全局错误处理（必须在最后）
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[server] piccco backend listening on http://localhost:${PORT}`);
  console.log(`[server] 环境: ${CONFIG.NODE_ENV}`);
  console.log(`[server] 前端地址: ${FRONTEND_ORIGIN}`);
});


