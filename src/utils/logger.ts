/**
 * 统一的日志工具
 * 根据环境变量控制日志级别
 * 生产环境只记录错误和警告
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const logger = {
  /**
   * 开发环境日志
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  
  /**
   * 警告日志（始终记录）
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  
  /**
   * 错误日志（始终记录）
   */
  error: (...args: any[]) => {
    console.error(...args);
  },
  
  /**
   * 调试日志（仅开发环境）
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  
  /**
   * 信息日志（仅开发环境）
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};
