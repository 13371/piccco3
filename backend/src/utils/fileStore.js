// 通用文件存储工具函数
const fs = require('fs');
const path = require('path');

/**
 * 读取JSON文件
 * @param {string} filePath - 文件路径
 * @returns {Array|Object} 解析后的JSON数据，失败返回默认值
 */
function readJsonFile(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[fileStore] 读取文件失败 ${filePath}:`, e.message);
    return defaultValue;
  }
}

/**
 * 写入JSON文件（带错误处理和原子性保证）
 * @param {string} filePath - 文件路径
 * @param {Array|Object} data - 要写入的数据
 * @param {boolean} createDir - 是否自动创建目录
 * @returns {boolean} 是否成功
 */
function writeJsonFile(filePath, data, createDir = true) {
  try {
    if (createDir) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    // 使用临时文件+重命名实现原子写入，避免数据损坏
    const tempFilePath = `${filePath}.tmp`;
    const jsonString = JSON.stringify(data, null, 2);
    
    // 先写入临时文件
    fs.writeFileSync(tempFilePath, jsonString, 'utf8');
    
    // 验证临时文件内容（可选，但更安全）
    try {
      const verifyData = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
    // 验证通过后重命名
    fs.renameSync(tempFilePath, filePath);
    // 设置文件权限（仅所有者可读写）
    try {
      fs.chmodSync(filePath, 0o600);
    } catch (e) {
      // 忽略权限设置失败（Windows可能不支持）
      console.warn(`[fileStore] 无法设置文件权限 ${filePath}:`, e.message);
    }
    return true;
    } catch (verifyError) {
      // 验证失败，删除临时文件
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw new Error(`数据验证失败: ${verifyError.message}`);
    }
  } catch (e) {
    console.error(`[fileStore] 写入文件失败 ${filePath}:`, e.message);
    return false;
  }
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  ensureDir,
};


