// 统一的API请求工具函数

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 30000; // 30秒

/**
 * 带超时的fetch请求
 */
import logger from './logger';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    throw error;
  }
}

/**
 * 安全的JSON解析
 */
async function safeJsonParse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error('服务器返回空响应');
  }
  
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    logger.error('[api] JSON解析失败:', e);
    logger.error('[api] 响应内容:', text.substring(0, 200));
    throw new Error('服务器响应格式错误');
  }
}

/**
 * 统一的API请求函数
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<{ ok: boolean; data?: T; message?: string; status?: number }> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetchWithTimeout(url, options, timeout);
    
    let data: T;
    try {
      data = await safeJsonParse<T>(response);
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : '服务器响应格式错误',
        status: response.status,
      };
    }
    
    if (!response.ok) {
      return {
        ok: false,
        data,
        message: (data as { message?: string } | undefined)?.message || `请求失败 (${response.status})`,
        status: response.status,
      };
    }
    
    return {
      ok: true,
      data,
      status: response.status,
    };
  } catch (error) {
    logger.error('[api] 请求失败:', error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : '网络错误，请稍后重试',
    };
  }
}

export { API_BASE_URL };


