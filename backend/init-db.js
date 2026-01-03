// 初始化数据库表结构
const { createSchema, isInitialized } = require('./src/db/migrations');
const logger = require('./src/utils/logger');

async function init() {
  try {
    console.log('🔧 开始初始化数据库...\n');

    // 检查是否已初始化
    const initialized = await isInitialized();
    if (initialized) {
      console.log('⚠️  数据库表已存在，跳过初始化');
      console.log('   如果需要重新创建，请先执行回滚脚本\n');
      return;
    }

    // 创建表结构
    await createSchema();
    
    console.log('\n✅ 数据库初始化成功！');
    console.log('📋 已创建以下表：');
    console.log('   - users (用户表)');
    console.log('   - folders (文件夹表)');
    console.log('   - notes (笔记表)');
    console.log('   - urls (URL表)');
    console.log('   - messages (消息表)');
    console.log('   - message_history (消息历史表)');
    console.log('   - user_settings (用户设置表)');
    console.log('\n🎉 可以开始使用数据库了！\n');
  } catch (error) {
    console.error('\n❌ 数据库初始化失败：');
    console.error(error.message);
    if (error.stack) {
      console.error('\n详细错误：');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // 关闭数据库连接池
    const { closePool } = require('./src/db/config');
    await closePool();
  }
}

// 运行初始化
init();

