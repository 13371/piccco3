// 动态获取API地址（每次调用时检测，而不是模块加载时）
function getApiBaseUrl(): string {
  // 如果设置了环境变量，优先使用
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('[API配置] 使用环境变量:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 开发环境：自动检测当前访问的IP地址
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    console.log('[API配置] 开发环境检测:', { 
      hostname, 
      protocol, 
      href: window.location.href,
      origin: window.location.origin
    });
    
    // 如果不是localhost或127.0.0.1，使用当前hostname（包括IP地址）
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // 确保协议正确（移动端可能是http或https）
      const apiProtocol = protocol === 'https:' ? 'https:' : 'http:';
      const apiUrl = `${apiProtocol}//${hostname}:4000/api`;
      console.log('[API配置] 使用IP地址:', apiUrl);
      console.log('[API配置] 调试信息:', {
        hostname,
        protocol,
        fullUrl: apiUrl,
        location: window.location.href
      });
      return apiUrl;
    }
    
    // 如果是localhost，但在移动端访问，尝试使用当前页面的origin
    // 这种情况可能发生在某些代理或转发场景
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('[API配置] 检测到localhost，使用默认地址');
    }
  }
  
  // 默认使用localhost（本地开发）
  const defaultUrl = 'http://localhost:4000/api';
  console.log('[API配置] 使用默认地址:', defaultUrl);
  return defaultUrl;
}

// 导出一个函数，每次调用时动态获取API地址
export function getApiBaseUrlDynamic(): string {
  return getApiBaseUrl();
}

// 为了兼容性，也导出一个常量（但会在首次访问时确定）
// 注意：这个值在模块加载时确定，可能不是最新的
export const API_BASE_URL = getApiBaseUrl();

// 在控制台输出API配置信息（方便调试）
console.log('[API配置] 初始API地址:', API_BASE_URL);
console.log('[API配置] 提示：如果移动端访问，请确保使用IP地址而非localhost');






