const path = require('path');
const { readJsonFileSync, writeJsonFileSync, ensureDirSync } = require('../utils/fileStore');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

// 确保数据目录存在
ensureDirSync(DATA_DIR);

function readDevices() {
  return readJsonFileSync(DEVICES_FILE, []);
}

function writeDevices(devices) {
  const success = writeJsonFileSync(DEVICES_FILE, devices);
  if (!success) {
    throw new Error('写入设备数据失败');
  }
}

// 解析User-Agent，获取设备信息
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return { name: '未知设备', type: 'unknown' };
  }
  
  const ua = userAgent.toLowerCase();
  
  // 检测设备类型
  let type = 'desktop';
  let name = '桌面设备';
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
    type = 'mobile';
    if (ua.includes('iphone')) {
      name = 'iPhone';
    } else if (ua.includes('ipad')) {
      name = 'iPad';
    } else if (ua.includes('android')) {
      name = 'Android 设备';
    } else {
      name = '移动设备';
    }
  } else if (ua.includes('tablet')) {
    type = 'tablet';
    name = '平板设备';
  } else {
    // 检测操作系统
    if (ua.includes('windows')) {
      name = 'Windows 设备';
    } else if (ua.includes('mac')) {
      name = 'Mac 设备';
    } else if (ua.includes('linux')) {
      name = 'Linux 设备';
    } else {
      name = '桌面设备';
    }
  }
  
  // 检测浏览器
  let browser = '';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  }
  
  if (browser) {
    name = `${name} (${browser})`;
  }
  
  return { name, type, userAgent };
}

// 添加或更新设备会话
function addDeviceSession(userId, token, userAgent, ipAddress) {
  const devices = readDevices();
  const now = Date.now();
  
  // 解析设备信息
  const deviceInfo = parseUserAgent(userAgent);
  
  // 生成设备ID（基于token的前8位和时间戳，确保唯一性）
  const deviceId = token.substring(0, 8) + '_' + now.toString(36);
  
  // 使用token前缀来标识设备（前20位）
  const tokenPrefix = token.substring(0, 20);
  
  // 检查是否已存在相同token前缀的设备会话（同一设备使用相同token）
  const existingIndex = devices.findIndex(
    (d) => d.userId === userId && d.token.startsWith(tokenPrefix) && !d.isOffline
  );
  
  if (existingIndex >= 0) {
    // 更新现有设备会话（相同token的设备，更新登录时间和活动时间）
    devices[existingIndex] = {
      ...devices[existingIndex],
      token: tokenPrefix + '...', // 只存储token的前20位用于标识
      loginTime: now,
      lastActiveTime: now,
      ipAddress: ipAddress || devices[existingIndex].ipAddress,
      isOffline: false,
    };
  } else {
    // 添加新设备会话（新设备或新token）
    devices.push({
      id: deviceId,
      userId,
      token: tokenPrefix + '...', // 只存储token的前20位用于标识
      name: deviceInfo.name,
      type: deviceInfo.type,
      userAgent: userAgent || '',
      ipAddress: ipAddress || '',
      loginTime: now,
      lastActiveTime: now,
      isOffline: false,
    });
  }
  
  writeDevices(devices);
  return deviceId;
}

// 更新设备最后活动时间
function updateDeviceActivity(userId, token) {
  const devices = readDevices();
  const tokenPrefix = token.substring(0, 20);
  
  const device = devices.find(
    (d) => d.userId === userId && d.token.startsWith(tokenPrefix) && !d.isOffline
  );
  
  if (device) {
    device.lastActiveTime = Date.now();
    writeDevices(devices);
    return true;
  }
  
  return false;
}

// 获取用户的所有设备会话
function getUserDevices(userId) {
  const devices = readDevices();
  return devices
    .filter((d) => d.userId === userId && !d.isOffline)
    .sort((a, b) => b.lastActiveTime - a.lastActiveTime);
}

// 下线设备
function offlineDevice(userId, deviceId) {
  const devices = readDevices();
  const device = devices.find((d) => d.id === deviceId && d.userId === userId);
  
  if (!device) {
    throw new Error('设备不存在');
  }
  
  device.isOffline = true;
  device.offlineTime = Date.now();
  writeDevices(devices);
  return device;
}

// 下线所有设备（除了当前设备）
function offlineAllDevices(userId, currentDeviceId) {
  const devices = readDevices();
  let count = 0;
  
  devices.forEach((device) => {
    if (device.userId === userId && device.id !== currentDeviceId && !device.isOffline) {
      device.isOffline = true;
      device.offlineTime = Date.now();
      count++;
    }
  });
  
  if (count > 0) {
    writeDevices(devices);
  }
  
  return count;
}

// 清理过期的设备会话（超过30天未活动）
function cleanExpiredDevices() {
  const devices = readDevices();
  const now = Date.now();
  const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30天
  
  const beforeCount = devices.length;
  const cleanedDevices = devices.filter((d) => {
    // 保留未下线的设备，或者下线时间在30天内的设备
    if (!d.isOffline) {
      return now - d.lastActiveTime < EXPIRY_MS;
    } else {
      return now - (d.offlineTime || d.lastActiveTime) < EXPIRY_MS;
    }
  });
  
  if (cleanedDevices.length !== beforeCount) {
    writeDevices(cleanedDevices);
    logger.info('deviceStore', `清理过期设备会话: ${beforeCount} -> ${cleanedDevices.length}`);
  }
  
  return beforeCount - cleanedDevices.length;
}

// 定期清理过期设备（每小时执行一次）
setInterval(() => {
  try {
    cleanExpiredDevices();
  } catch (e) {
    logger.error('deviceStore', '清理过期设备失败:', e);
  }
}, 60 * 60 * 1000); // 1小时

module.exports = {
  addDeviceSession,
  updateDeviceActivity,
  getUserDevices,
  offlineDevice,
  offlineAllDevices,
  cleanExpiredDevices,
  parseUserAgent,
};

