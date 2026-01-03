// 简单的数据库连接测试
const path = require('path');

// 确保从正确的目录运行
process.chdir(__dirname);

console.log('当前工作目录:', process.cwd());
console.log('测试文件路径:', __filename);
console.log('');

// 检查文件是否存在
const fs = require('fs');
const configPath = path.join(__dirname, 'src', 'db', 'config.js');
console.log('配置文件路径:', configPath);
console.log('文件是否存在:', fs.existsSync(configPath));
console.log('');

if (!fs.existsSync(configPath)) {
  console.error('❌ 配置文件不存在！');
  process.exit(1);
}

// 尝试加载配置
try {
  console.log('正在加载配置...');
  const { initPool, checkConnection, closePool, dbConfig } = require('./src/db/config');
  
  console.log('✅ 配置加载成功！');
  console.log('数据库配置:');
  console.log(`  主机: ${dbConfig.host}`);
  console.log(`  端口: ${dbConfig.port}`);
  console.log(`  数据库: ${dbConfig.database}`);
  console.log(`  用户: ${dbConfig.user}`);
  console.log(`  密码: ${dbConfig.password ? '***已设置***' : '❌ 未设置'}`);
  console.log('');
  
  // 测试连接
  (async () => {
    try {
      console.log('正在初始化连接池...');
      initPool();
      
      console.log('正在测试连接...');
      const result = await checkConnection();
      
      if (result.connected) {
        console.log('✅ 数据库连接成功！');
        console.log(`📅 数据库时间: ${result.timestamp}`);
        console.log('');
        console.log('🎉 数据库运行正常！');
      } else {
        console.error('❌ 数据库连接失败！');
        console.error(`错误: ${result.error}`);
      }
      
      await closePool();
      process.exit(0);
    } catch (error) {
      console.error('❌ 连接测试失败:', error.message);
      console.error(error);
      process.exit(1);
    }
  })();
  
} catch (error) {
  console.error('❌ 加载配置失败:', error.message);
  console.error('错误详情:', error);
  console.log('');
  console.log('可能的原因:');
  console.log('1. 缺少依赖包 (pg) - 运行: npm install');
  console.log('2. .env 文件配置错误');
  console.log('3. 模块路径问题');
  process.exit(1);
}




