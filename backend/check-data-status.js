// 检查数据状态脚本
const fs = require('fs');
const path = require('path');
const { query } = require('./src/db/config');

async function checkDataStatus() {
  console.log('📊 正在检查数据状态...\n');
  
  // 1. 检查文件数据
  console.log('=== 1. 检查文件数据 ===');
  const dataDir = path.join(__dirname, 'data', 'users');
  let fileUserCount = 0;
  let fileDataExists = false;
  
  if (fs.existsSync(dataDir)) {
    const userDirs = fs.readdirSync(dataDir).filter(item => {
      const itemPath = path.join(dataDir, item);
      return fs.statSync(itemPath).isDirectory();
    });
    fileUserCount = userDirs.length;
    fileDataExists = fileUserCount > 0;
    
    console.log(`📁 数据目录: ${dataDir}`);
    console.log(`   存在: ${fileDataExists ? '✅ 是' : '❌ 否'}`);
    console.log(`   用户目录数: ${fileUserCount}`);
    
    if (fileDataExists) {
      // 检查每个用户的数据文件
      let totalFolders = 0;
      let totalNotes = 0;
      let totalUrls = 0;
      
      for (const userId of userDirs.slice(0, 5)) { // 只检查前5个用户
        const userPath = path.join(dataDir, userId);
        const dataFile = path.join(userPath, 'data.json');
        
        if (fs.existsSync(dataFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            totalFolders += (data.folders || []).length;
            totalNotes += (data.notes || []).length;
            totalUrls += (data.urls || []).length;
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      if (userDirs.length > 5) {
        console.log(`   (仅检查了前5个用户的数据)`);
      }
      console.log(`   示例数据: ${totalFolders} 个文件夹, ${totalNotes} 个笔记, ${totalUrls} 个URL`);
    }
  } else {
    console.log(`📁 数据目录: ${dataDir}`);
    console.log(`   存在: ❌ 否`);
  }
  
  console.log('');
  
  // 2. 检查数据库数据
  console.log('=== 2. 检查数据库数据 ===');
  try {
    // 初始化连接池
    const { initPool } = require('./src/db/config');
    initPool();
    
    // 检查用户数
    const userResult = await query('SELECT COUNT(*) as count FROM users');
    const dbUserCount = parseInt(userResult.rows[0].count);
    
    // 检查文件夹数
    const folderResult = await query('SELECT COUNT(*) as count FROM folders');
    const dbFolderCount = parseInt(folderResult.rows[0].count);
    
    // 检查笔记数
    const noteResult = await query('SELECT COUNT(*) as count FROM notes');
    const dbNoteCount = parseInt(noteResult.rows[0].count);
    
    // 检查URL数
    const urlResult = await query('SELECT COUNT(*) as count FROM urls');
    const dbUrlCount = parseInt(urlResult.rows[0].count);
    
    // 检查消息数
    const messageResult = await query('SELECT COUNT(*) as count FROM messages');
    const dbMessageCount = parseInt(messageResult.rows[0].count);
    
    console.log(`💾 数据库: PostgreSQL`);
    console.log(`   用户数: ${dbUserCount}`);
    console.log(`   文件夹数: ${dbFolderCount}`);
    console.log(`   笔记数: ${dbNoteCount}`);
    console.log(`   URL数: ${dbUrlCount}`);
    console.log(`   消息数: ${dbMessageCount}`);
    
    const dbDataExists = dbUserCount > 0 || dbFolderCount > 0 || dbNoteCount > 0;
    console.log(`   有数据: ${dbDataExists ? '✅ 是' : '❌ 否'}`);
    
    console.log('');
    
    // 3. 总结和建议
    console.log('=== 3. 数据状态总结 ===');
    
    if (!fileDataExists && !dbDataExists) {
      console.log('✅ 这是一个全新的应用，没有现有数据需要迁移。');
      console.log('   可以直接开始使用，新数据会自动写入数据库。');
    } else if (fileDataExists && !dbDataExists) {
      console.log('⚠️  检测到文件中有数据，但数据库中还没有数据。');
      console.log('   建议执行数据迁移：');
      console.log('   node scripts/migrate-to-db.js');
    } else if (!fileDataExists && dbDataExists) {
      console.log('✅ 数据库中已有数据，文件数据已清空或不存在。');
      console.log('   数据迁移已完成，可以考虑切换到纯数据库模式。');
    } else if (fileDataExists && dbDataExists) {
      console.log('⚠️  文件和数据库中都有数据。');
      console.log('   当前为双写模式，新数据会同时写入文件和数据库。');
      console.log('   建议：');
      console.log('   1. 验证数据一致性: node verify-data.js');
      console.log('   2. 如果数据一致，可以考虑切换到纯数据库模式');
    }
    
    // 关闭连接
    const { closePool } = require('./src/db/config');
    await closePool();
    
  } catch (error) {
    console.error('❌ 检查数据库时出错:', error.message);
    console.log('');
    console.log('可能的原因:');
    console.log('1. 数据库连接失败');
    console.log('2. 数据库表未创建（运行: node init-db.js）');
    console.log('3. 数据库配置错误');
  }
  
  console.log('');
}

// 运行检查
checkDataStatus().catch(error => {
  console.error('❌ 检查失败:', error);
  process.exit(1);
});

