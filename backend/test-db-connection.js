// 数据库连接测试脚本
const { initPool, checkConnection, closePool } = require('./src/db/config');

(async () => {
  try {
    console.log('🔌 正在测试数据库连接...\n');
    
    // 显示配置信息（不显示密码）
    const { dbConfig } = require('./src/db/config');
    console.log('📋 数据库配置:');
    console.log(`   - 主机: ${dbConfig.host}`);
    console.log(`   - 端口: ${dbConfig.port}`);
    console.log(`   - 数据库: ${dbConfig.database}`);
    console.log(`   - 用户: ${dbConfig.user}`);
    console.log(`   - 密码: ${dbConfig.password ? '***已设置***' : '❌ 未设置'}\n`);
    
    // 初始化连接池
    initPool();
    
    // 测试连接
    const result = await checkConnection();
    
    if (result.connected) {
      console.log('✅ 数据库连接成功！');
      console.log(`📅 数据库时间: ${result.timestamp}\n`);
      console.log('🎉 可以继续下一步操作了！');
    } else {
      console.error('❌ 数据库连接失败！');
      console.error(`错误信息: ${result.error}\n`);
      console.log('💡 请检查：');
      console.log('   1. PostgreSQL 服务是否运行');
      console.log('   2. .env 文件中的数据库配置是否正确');
      console.log('   3. 数据库用户密码是否正确');
      console.log('   4. 防火墙是否阻止了连接');
      process.exit(1);
    }
    
    // 关闭连接
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('❌ 连接测试失败:', error.message);
    console.error('\n详细错误:');
    console.error(error);
    process.exit(1);
  }
})();





