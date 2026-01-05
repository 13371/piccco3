// 加载 .env 文件
require('dotenv').config({ path: '/www/wwwroot/piccco3/backend/.env' });

module.exports = {
  apps: [{
    name: 'piccco-backend',
    script: 'src/server.js',
    cwd: '/www/wwwroot/piccco3/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: process.env.PORT || 4000,
      JWT_SECRET: process.env.JWT_SECRET,
      SESSION_SECRET: process.env.SESSION_SECRET,
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      // 数据库配置
      STORAGE_MODE: process.env.STORAGE_MODE || 'db',
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      USE_PGBOUNCER: process.env.USE_PGBOUNCER,
      DB_POOL_MAX: process.env.DB_POOL_MAX,
      DB_IDLE_TIMEOUT: process.env.DB_IDLE_TIMEOUT,
      DB_CONNECTION_TIMEOUT: process.env.DB_CONNECTION_TIMEOUT
    },
    error_file: '/www/wwwroot/piccco3/backend/logs/error.log',
    out_file: '/www/wwwroot/piccco3/backend/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false
  }]
};






