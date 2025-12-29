// 配置验证和统一管理

/**
 * 验证必需的环境变量
 * @param {string[]} requiredVars - 必需的环境变量列表
 * @param {boolean} exitOnMissing - 缺少时是否退出进程
 */
function validateEnvVars(requiredVars, exitOnMissing = false) {
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
      console.error(`[config] 错误：未设置环境变量 ${varName}`);
    }
  }
  
  if (missing.length > 0) {
    const message = `缺少必需的环境变量: ${missing.join(', ')}`;
    if (exitOnMissing && process.env.NODE_ENV === 'production') {
      console.error(`[config] ${message}，退出启动`);
      process.exit(1);
    } else {
      console.warn(`[config] ${message}`);
    }
  }
  
  return missing.length === 0;
}

/**
 * 获取配置值，带默认值和验证
 */
function getConfig(key, defaultValue, validator = null) {
  const value = process.env[key] || defaultValue;
  
  if (validator && !validator(value)) {
    console.warn(`[config] 环境变量 ${key} 的值无效，使用默认值`);
    return defaultValue;
  }
  
  return value;
}

// 配置常量
const CONFIG = {
  // 服务器配置
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  
  // 安全配置
  JWT_SECRET: process.env.JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  
  // SMTP配置
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  
  // 业务配置
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24小时
  VERIFICATION_CODE_EXPIRE: 10 * 60 * 1000, // 10分钟
};

// 验证生产环境必需的配置
if (CONFIG.NODE_ENV === 'production') {
  validateEnvVars(['JWT_SECRET', 'SESSION_SECRET'], true);
  
  if (!CONFIG.ADMIN_PASSWORD_HASH && !CONFIG.ADMIN_PASSWORD) {
    console.warn('[config] 警告：未设置管理员密码（ADMIN_PASSWORD_HASH 或 ADMIN_PASSWORD）');
  }
}

module.exports = {
  CONFIG,
  validateEnvVars,
  getConfig,
};



