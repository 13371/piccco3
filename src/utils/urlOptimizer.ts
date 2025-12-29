/**
 * URL优化函数
 * 自动添加协议、清理多余空格、转换为标准格式
 */
export function optimizeUrl(url: string): string {
  if (!url || !url.trim()) {
    return '';
  }

  // 移除首尾空格
  let optimized = url.trim();

  // 移除多余的空格
  optimized = optimized.replace(/\s+/g, '');

  // 如果已经包含协议，直接返回
  if (optimized.match(/^https?:\/\//i)) {
    return optimized;
  }

  // 如果以 // 开头，添加 https:
  if (optimized.startsWith('//')) {
    return `https:${optimized}`;
  }

  // 如果包含点号，假设是域名，添加 https://
  if (optimized.includes('.')) {
    // 检查是否像域名格式（包含点号且不是文件路径）
    if (!optimized.includes('/') || optimized.split('/')[0].includes('.')) {
      return `https://${optimized}`;
    }
  }

  // 如果看起来像IP地址
  if (optimized.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
    return `https://${optimized}`;
  }

  // 默认添加 https://
  return `https://${optimized}`;
}

/**
 * 从URL中提取标题（域名部分）
 */
export function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(optimizeUrl(url));
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}










