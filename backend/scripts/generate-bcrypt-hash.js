// 生成 bcrypt 哈希的独立脚本
// 使用方法: node scripts/generate-bcrypt-hash.js <password>

const bcrypt = require('bcrypt');
const password = process.argv[2];

if (!password) {
  console.error('错误: 请提供密码作为参数');
  console.error('使用方法: node scripts/generate-bcrypt-hash.js <password>');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('生成哈希失败:', err);
    process.exit(1);
  }
  console.log(hash);
});

