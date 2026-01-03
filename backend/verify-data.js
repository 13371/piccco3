// 数据一致性验证脚本
const { userStoreAdapter } = require('./src/store/storageAdapter');
const { userDataStoreAdapter } = require('./src/store/storageAdapter');
const { query } = require('./src/db/config');

(async () => {
  try {
    console.log('🔍 开始验证数据一致性...\n');
    
    // 获取所有用户
    const users = await userStoreAdapter.getAllUsers();
    console.log(`📊 应用层用户数量: ${users.length}`);
    
    // 从数据库直接查询
    const dbResult = await query('SELECT COUNT(*) as count FROM users');
    const dbUserCount = parseInt(dbResult.rows[0].count, 10);
    console.log(`📊 数据库用户数量: ${dbUserCount}`);
    
    if (users.length !== dbUserCount) {
      console.warn(`⚠️  用户数量不一致！应用: ${users.length}, 数据库: ${dbUserCount}`);
    } else {
      console.log('✅ 用户数量一致\n');
    }
    
    // 验证每个用户的数据
    console.log('📋 用户数据详情：\n');
    for (const user of users) {
      try {
        const userData = await userDataStoreAdapter.getUserData(user.id);
        
        // 从数据库查询
        const folderCount = await query('SELECT COUNT(*) as count FROM folders WHERE user_id = $1', [user.id]);
        const noteCount = await query('SELECT COUNT(*) as count FROM notes WHERE user_id = $1', [user.id]);
        const urlCount = await query('SELECT COUNT(*) as count FROM urls WHERE user_id = $1', [user.id]);
        
        console.log(`👤 用户: ${user.username} (${user.id})`);
        console.log(`   - 文件夹: 应用=${userData.folders.length}, 数据库=${folderCount.rows[0].count}`);
        console.log(`   - 笔记: 应用=${userData.notes.length}, 数据库=${noteCount.rows[0].count}`);
        console.log(`   - URL: 应用=${userData.urls.length}, 数据库=${urlCount.rows[0].count}`);
        
        // 检查一致性
        const foldersMatch = userData.folders.length === parseInt(folderCount.rows[0].count, 10);
        const notesMatch = userData.notes.length === parseInt(noteCount.rows[0].count, 10);
        const urlsMatch = userData.urls.length === parseInt(urlCount.rows[0].count, 10);
        
        if (foldersMatch && notesMatch && urlsMatch) {
          console.log(`   ✅ 数据一致\n`);
        } else {
          console.log(`   ⚠️  数据不一致！\n`);
        }
      } catch (error) {
        console.error(`   ❌ 验证用户 ${user.id} 数据时出错:`, error.message);
      }
    }
    
    console.log('✅ 数据验证完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  }
})();





