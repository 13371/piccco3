// 通用文件存储工具函数
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * 读取JSON文件（异步）
 * @param {string} filePath - 文件路径
 * @param {Array|Object} defaultValue - 默认值
 * @returns {Promise<Array|Object>} 解析后的JSON数据，失败返回默认值
 */
async function readJsonFile(filePath, defaultValue = []) {
  try {
    await fs.access(filePath);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return defaultValue;
    }
    logger.error('fileStore', `读取文件失败 ${filePath}:`, e.message);
    return defaultValue;
  }
}

/**
 * 读取JSON文件（同步，用于向后兼容）
 * @param {string} filePath - 文件路径
 * @param {Array|Object} defaultValue - 默认值
 * @returns {Array|Object} 解析后的JSON数据，失败返回默认值
 */
function readJsonFileSync(filePath, defaultValue = []) {
  if (!fsSync.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const raw = fsSync.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    logger.error('fileStore', `读取文件失败 ${filePath}:`, e.message);
    return defaultValue;
  }
}

/**
 * 写入JSON文件（异步，带错误处理和原子性保证）
 * @param {string} filePath - 文件路径
 * @param {Array|Object} data - 要写入的数据
 * @param {boolean} createDir - 是否自动创建目录
 * @returns {Promise<boolean>} 是否成功
 */
async function writeJsonFile(filePath, data, createDir = true) {
  try {
    if (createDir) {
      const dir = path.dirname(filePath);
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
    
    // 使用临时文件+重命名实现原子写入，避免数据损坏
    const tempFilePath = `${filePath}.tmp`;
    const jsonString = JSON.stringify(data, null, 2);
    
    // 先写入临时文件
    await fs.writeFile(tempFilePath, jsonString, 'utf8');
    
    // 验证临时文件内容（可选，但更安全）
    try {
      const verifyData = JSON.parse(await fs.readFile(tempFilePath, 'utf8'));
      // 验证通过后重命名
      await fs.rename(tempFilePath, filePath);
      // 设置文件权限（仅所有者可读写）
      try {
        await fs.chmod(filePath, 0o600);
      } catch (e) {
        // 忽略权限设置失败（Windows可能不支持）
        logger.warn('fileStore', `无法设置文件权限 ${filePath}:`, e.message);
      }
      return true;
    } catch (verifyError) {
      // 验证失败，删除临时文件
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // 忽略删除失败
      }
      throw new Error(`数据验证失败: ${verifyError.message}`);
    }
  } catch (e) {
    logger.error('fileStore', `写入文件失败 ${filePath}:`, e.message);
    return false;
  }
}

/**
 * 写入JSON文件（同步，用于向后兼容）
 * @param {string} filePath - 文件路径
 * @param {Array|Object} data - 要写入的数据
 * @param {boolean} createDir - 是否自动创建目录
 * @returns {boolean} 是否成功
 */
function writeJsonFileSync(filePath, data, createDir = true) {
  try {
    if (createDir) {
      const dir = path.dirname(filePath);
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
      }
    }
    
    // 使用临时文件+重命名实现原子写入，避免数据损坏
    const tempFilePath = `${filePath}.tmp`;
    const jsonString = JSON.stringify(data, null, 2);
    
    // 先写入临时文件
    fsSync.writeFileSync(tempFilePath, jsonString, 'utf8');
    
    // 验证临时文件内容（可选，但更安全）
    try {
      const verifyData = JSON.parse(fsSync.readFileSync(tempFilePath, 'utf8'));
      // 验证通过后重命名
      fsSync.renameSync(tempFilePath, filePath);
      // 设置文件权限（仅所有者可读写）
      try {
        fsSync.chmodSync(filePath, 0o600);
      } catch (e) {
        // 忽略权限设置失败（Windows可能不支持）
        logger.warn('fileStore', `无法设置文件权限 ${filePath}:`, e.message);
      }
      return true;
    } catch (verifyError) {
      // 验证失败，删除临时文件
      if (fsSync.existsSync(tempFilePath)) {
        fsSync.unlinkSync(tempFilePath);
      }
      throw new Error(`数据验证失败: ${verifyError.message}`);
    }
  } catch (e) {
    logger.error('fileStore', `写入文件失败 ${filePath}:`, e.message);
    return false;
  }
}

/**
 * 确保目录存在（异步）
 * @param {string} dirPath - 目录路径
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * 确保目录存在（同步，用于向后兼容）
 * @param {string} dirPath - 目录路径
 */
function ensureDirSync(dirPath) {
  if (!fsSync.existsSync(dirPath)) {
    fsSync.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  readJsonFile,
  readJsonFileSync,
  writeJsonFile,
  writeJsonFileSync,
  ensureDir,
  ensureDirSync,
};


