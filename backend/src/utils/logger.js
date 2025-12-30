// 日志工具模块 - 支持环境变量控制日志级别

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
};

// 从环境变量获取日志级别，默认：开发环境=DEBUG，生产环境=INFO
const getLogLevel = () => {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }
  // 根据环境自动设置
  return process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

const currentLogLevel = getLogLevel();

// 格式化日志消息
function formatMessage(level, tag, message, ...args) {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level];
  const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ') : '';
  return `[${timestamp}] [${levelName}] [${tag}] ${message}${formattedArgs}`;
}

// 日志函数
const logger = {
  error: (tag, message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(formatMessage(LOG_LEVELS.ERROR, tag, message, ...args));
    }
  },
  
  warn: (tag, message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(formatMessage(LOG_LEVELS.WARN, tag, message, ...args));
    }
  },
  
  info: (tag, message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(formatMessage(LOG_LEVELS.INFO, tag, message, ...args));
    }
  },
  
  debug: (tag, message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log(formatMessage(LOG_LEVELS.DEBUG, tag, message, ...args));
    }
  },
};

module.exports = logger;




