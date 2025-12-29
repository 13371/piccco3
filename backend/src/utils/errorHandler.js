// 统一错误处理中间件

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class AuthenticationError extends AppError {
  constructor(message = '未授权，请先登录') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = '无权访问') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  // 如果是自定义错误，使用其状态码和消息
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token无效',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token已过期',
      },
    });
  }

  // 默认错误
  console.error('[errorHandler] 未处理的错误:', err);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

/**
 * 404处理中间件
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路由 ${req.method} ${req.path} 不存在`,
    },
  });
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  errorHandler,
  notFoundHandler,
};


