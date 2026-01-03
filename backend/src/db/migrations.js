// 数据库迁移工具
const fs = require('fs');
const path = require('path');
const { query } = require('./config');
const logger = require('../utils/logger');

/**
 * 执行SQL文件
 * @param {string} filePath - SQL文件路径
 */
async function executeSqlFile(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await query(sql);
    logger.info('migration', `已执行SQL文件: ${filePath}`);
  } catch (error) {
    logger.error('migration', `执行SQL文件失败: ${filePath}`, error);
    throw error;
  }
}

/**
 * 创建数据库schema
 */
async function createSchema() {
  try {
    logger.info('migration', '开始创建数据库schema...');
    const schemaPath = path.join(__dirname, '..', '..', 'migrations', '001_create_schema.sql');
    await executeSqlFile(schemaPath);
    logger.info('migration', '数据库schema创建成功');
  } catch (error) {
    logger.error('migration', '创建数据库schema失败', error);
    throw error;
  }
}

/**
 * 回滚数据库schema
 */
async function rollbackSchema() {
  try {
    logger.warn('migration', '开始回滚数据库schema（将删除所有数据）...');
    const rollbackPath = path.join(__dirname, '..', '..', 'migrations', '002_rollback_schema.sql');
    await executeSqlFile(rollbackPath);
    logger.info('migration', '数据库schema回滚成功');
  } catch (error) {
    logger.error('migration', '回滚数据库schema失败', error);
    throw error;
  }
}

/**
 * 检查表是否存在
 * @param {string} tableName - 表名
 */
async function tableExists(tableName) {
  try {
    const result = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    logger.error('migration', `检查表是否存在失败: ${tableName}`, error);
    return false;
  }
}

/**
 * 检查数据库是否已初始化
 */
async function isInitialized() {
  try {
    const usersExists = await tableExists('users');
    const foldersExists = await tableExists('folders');
    return usersExists && foldersExists;
  } catch (error) {
    return false;
  }
}

module.exports = {
  createSchema,
  rollbackSchema,
  tableExists,
  isInitialized,
  executeSqlFile,
};





