#!/usr/bin/env node
/**
 * 数据库初始化脚本
 * 用于创建数据库表结构
 */

const { initPool, checkConnection } = require('../src/db/config');
const { isInitialized, createSchema } = require('../src/db/migrations');
const logger = require('../src/utils/logger');

async function main() {
  try {
    console.log('==========================================');
    console.log('piccco 数据库初始化脚本');
    console.log('==========================================\n');

    // 初始化连接池
    console.log('1. 初始化数据库连接池...');
    initPool();

    // 检查连接
    console.log('2. 检查数据库连接...');
    const connectionStatus = await checkConnection();
    if (!connectionStatus.connected) {
      console.error('❌ 数据库连接失败:', connectionStatus.error);
      process.exit(1);
    }
    console.log('✅ 数据库连接成功\n');

    // 检查是否已初始化
    console.log('3. 检查数据库是否已初始化...');
    const initialized = await isInitialized();
    if (initialized) {
      console.log('✅ 数据库已初始化，表结构已存在');
      console.log('   如果需要重新初始化，请先删除现有表');
      process.exit(0);
    }

    // 创建表结构
    console.log('4. 创建数据库表结构...');
    await createSchema();
    console.log('✅ 数据库表结构创建成功\n');

    console.log('==========================================');
    console.log('数据库初始化完成！');
    console.log('==========================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 数据库初始化失败:');
    console.error(error.message);
    if (error.stack) {
      console.error('\n详细错误信息:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 运行主函数
main();



















