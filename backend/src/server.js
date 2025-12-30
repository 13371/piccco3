const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { CONFIG } = require('./utils/config');
const { errorHandler, notFoundHandler } = require('./utils/errorHandler');
const logger = require('./utils/logger');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Swagger配置
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Piccco API',
      version: '1.0.0',
      description: 'Piccco 后端API文档',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${CONFIG.PORT}`,
        description: '开发服务器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // 扫描路由文件中的注释
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const adminUIRoutes = require('./routes/admin-ui');
const messageRoutes = require('./routes/message');
const dataRoutes = require('./routes/data');

const app = express();

const PORT = CONFIG.PORT;
const FRONTEND_ORIGIN = CONFIG.FRONTEND_ORIGIN;
const FINAL_SESSION_SECRET = CONFIG.SESSION_SECRET || 'piccco-admin-secret-change-me-in-production';

// 安全HTTP头（Helmet）
// 允许内联脚本和内联事件处理器（管理员界面需要）
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // 允许内联脚本（管理员界面需要）
      scriptSrcAttr: ["'unsafe-inline'"], // 允许内联事件处理器（onclick等）
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // 允许嵌入资源
}));

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

// 请求日志中间件（morgan）
// 开发环境：显示详细信息，生产环境：只显示错误和重要信息
if (CONFIG.NODE_ENV === 'production') {
  // 生产环境：只记录错误请求（4xx, 5xx）
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
    stream: {
      write: (message) => logger.warn('http', message.trim())
    }
  }));
} else {
  // 开发环境：显示所有请求
  app.use(morgan('dev', {
    stream: {
      write: (message) => logger.debug('http', message.trim())
    }
  }));
}

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
    apiVersion: 'v1',
    endpoints: {
      health: '/api/health',
      v1: {
        auth: '/api/v1/auth',
        admin: '/api/v1/admin',
        message: '/api/v1/message',
        data: '/api/v1/data',
      },
      legacy: {
        auth: '/api/auth (已弃用，请使用 /api/v1/auth)',
        admin: '/api/admin (已弃用，请使用 /api/v1/admin)',
        message: '/api/message (已弃用，请使用 /api/v1/message)',
        data: '/api/data (已弃用，请使用 /api/v1/data)',
      },
      adminUI: '/admin',
      docs: '/api-docs (Swagger文档)'
    },
    note: '推荐使用 /api/v1/* 版本化API端点'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API版本控制 - v1版本（推荐使用）
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/message', messageRoutes);
app.use('/api/v1/data', dataRoutes);

// 向后兼容 - 保留旧版本路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/data', dataRoutes);

app.use('/admin', adminUIRoutes);

// Swagger API文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Piccco API 文档',
}));

// 404处理（必须在所有路由之后）
app.use(notFoundHandler);

// 全局错误处理（必须在最后）
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info('server', `piccco backend listening on http://localhost:${PORT}`);
  logger.info('server', `环境: ${CONFIG.NODE_ENV}`);
  logger.info('server', `前端地址: ${FRONTEND_ORIGIN}`);
  logger.info('server', `日志级别: ${process.env.LOG_LEVEL || (CONFIG.NODE_ENV === 'production' ? 'INFO' : 'DEBUG')}`);
});


