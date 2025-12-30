// 简单的前端日志工具，支持按环境控制日志输出
const mode = import.meta.env.MODE || 'development';
const isProd = mode === 'production';

function formatArgs(level: string, args: unknown[]) {
  return [`[${level}]`, ...args];
}

export const logger = {
  log: (...args: unknown[]) => {
    if (!isProd) {
      console.log(...formatArgs('log', args));
    }
  },
  info: (...args: unknown[]) => {
    if (!isProd) {
      console.info(...formatArgs('info', args));
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...formatArgs('warn', args));
  },
  error: (...args: unknown[]) => {
    console.error(...formatArgs('error', args));
  },
};

export default logger;


