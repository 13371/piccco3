// 检查用户数据与数据库同步状态
const fs = require('fs');
const path = require('path');
const { query } = require('./src/db/config');

async function checkSyncStatus() {
  console.log('🔄 正在检查用户数据与数据库同步状态...\n');
  
  try {
    // 初始化连接池
    const { initPool } = require('./src/db/config');
    initPool();
    
    const dataDir = path.join(__dirname, 'data', 'users');
    const fileUsers = [];
    const dbUsers = [];
    
    // 1. 读取文件中的用户数据
    console.log('=== 1. 检查文件数据 ===');
    if (fs.existsSync(dataDir)) {
      const userDirs = fs.readdirSync(dataDir).filter(item => {
        const itemPath = path.join(dataDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      console.log(`📁 找到 ${userDirs.length} 个用户目录`);
      
      for (const userId of userDirs) {
        const userPath = path.join(dataDir, userId);
        const dataFile = path.join(userPath, 'data.json');
        
        if (fs.existsSync(dataFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            const userInfo = {
              id: userId,
              folders: (data.folders || []).length,
              notes: (data.notes || []).length,
              urls: (data.urls || []).length,
              hasData: true
            };
            fileUsers.push(userInfo);
          } catch (e) {
            console.log(`   ⚠️  用户 ${userId} 数据文件解析失败: ${e.message}`);
          }
        }
      }
      
      console.log(`✅ 成功读取 ${fileUsers.length} 个用户的数据文件\n`);
    } else {
      console.log('📁 数据目录不存在，没有文件数据\n');
    }
    
    // 2. 读取数据库中的用户数据
    console.log('=== 2. 检查数据库数据 ===');
    const dbUserResult = await query('SELECT id, email, username, created_at FROM users ORDER BY created_at');
    const dbUserIds = dbUserResult.rows.map(row => row.id);
    
    console.log(`💾 数据库中找到 ${dbUserIds.length} 个用户`);
    
    for (const userId of dbUserIds) {
      try {
        // 统计各表数据
        const folderResult = await query('SELECT COUNT(*) as count FROM folders WHERE user_id = $1', [userId]);
        const noteResult = await query('SELECT COUNT(*) as count FROM notes WHERE user_id = $1', [userId]);
        const urlResult = await query('SELECT COUNT(*) as count FROM urls WHERE user_id = $1', [userId]);
        
        const userInfo = {
          id: userId,
          folders: parseInt(folderResult.rows[0].count),
          notes: parseInt(noteResult.rows[0].count),
          urls: parseInt(urlResult.rows[0].count),
          hasData: true
        };
        dbUsers.push(userInfo);
      } catch (e) {
        console.log(`   ⚠️  用户 ${userId} 数据库查询失败: ${e.message}`);
      }
    }
    
    console.log(`✅ 成功读取 ${dbUsers.length} 个用户的数据库数据\n`);
    
    // 3. 对比同步状态
    console.log('=== 3. 同步状态对比 ===');
    
    const fileUserIds = new Set(fileUsers.map(u => u.id));
    const dbUserIdsSet = new Set(dbUsers.map(u => u.id));
    
    // 只在文件中的用户
    const onlyInFile = fileUsers.filter(u => !dbUserIdsSet.has(u.id));
    // 只在数据库中的用户
    const onlyInDb = dbUsers.filter(u => !fileUserIds.has(u.id));
    // 两者都有的用户
    const inBoth = fileUsers.filter(u => dbUserIdsSet.has(u.id));
    
    console.log(`📊 统计信息:`);
    console.log(`   文件中的用户: ${fileUsers.length}`);
    console.log(`   数据库中的用户: ${dbUsers.length}`);
    console.log(`   两者都有的用户: ${inBoth.length}`);
    console.log(`   只在文件中的用户: ${onlyInFile.length}`);
    console.log(`   只在数据库中的用户: ${onlyInDb.length}`);
    console.log('');
    
    // 4. 详细对比数据
    if (inBoth.length > 0) {
      console.log('=== 4. 数据一致性检查 ===');
      let syncCount = 0;
      let unsyncCount = 0;
      
      for (const fileUser of inBoth) {
        const dbUser = dbUsers.find(u => u.id === fileUser.id);
        
        if (dbUser) {
          const foldersMatch = fileUser.folders === dbUser.folders;
          const notesMatch = fileUser.notes === dbUser.notes;
          const urlsMatch = fileUser.urls === dbUser.urls;
          
          const isSync = foldersMatch && notesMatch && urlsMatch;
          
          if (isSync) {
            syncCount++;
          } else {
            unsyncCount++;
            console.log(`\n⚠️  用户 ${fileUser.id} 数据不一致:`);
            console.log(`   文件: ${fileUser.folders} 文件夹, ${fileUser.notes} 笔记, ${fileUser.urls} URL`);
            console.log(`   数据库: ${dbUser.folders} 文件夹, ${dbUser.notes} 笔记, ${dbUser.urls} URL`);
            
            if (!foldersMatch) console.log(`   ❌ 文件夹数量不匹配`);
            if (!notesMatch) console.log(`   ❌ 笔记数量不匹配`);
            if (!urlsMatch) console.log(`   ❌ URL数量不匹配`);
          }
        }
      }
      
      console.log(`\n✅ 同步用户: ${syncCount}`);
      console.log(`⚠️  不同步用户: ${unsyncCount}`);
      console.log('');
    }
    
    // 5. 总结和建议
    console.log('=== 5. 同步状态总结 ===');
    
    if (fileUsers.length === 0 && dbUsers.length === 0) {
      console.log('✅ 当前没有用户数据，这是正常的新应用状态。');
      console.log('   新创建的用户数据会自动同步到文件和数据库。');
    } else if (onlyInFile.length > 0) {
      console.log('⚠️  发现只在文件中的用户数据，需要迁移到数据库：');
      console.log(`   用户ID: ${onlyInFile.map(u => u.id).join(', ')}`);
      console.log('   建议执行: node scripts/migrate-to-db.js');
    } else if (onlyInDb.length > 0) {
      console.log('ℹ️  发现只在数据库中的用户（可能是新创建的用户）：');
      console.log(`   用户ID: ${onlyInDb.map(u => u.id).join(', ')}`);
      console.log('   这是正常的，因为当前是双写模式，新数据会写入数据库。');
    } else if (unsyncCount > 0) {
      console.log('⚠️  发现数据不一致的用户，可能需要重新同步：');
      console.log('   建议检查应用日志，确认双写模式是否正常工作。');
    } else {
      console.log('✅ 所有用户数据已同步！');
      console.log('   文件和数据库中的数据完全一致。');
    }
    
    // 6. 检查存储模式
    console.log('\n=== 6. 存储模式检查 ===');
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const storageModeMatch = envContent.match(/STORAGE_MODE=(file|db|dual)/);
      if (storageModeMatch) {
        const mode = storageModeMatch[1];
        console.log(`📋 当前存储模式: ${mode}`);
        if (mode === 'dual') {
          console.log('   ✅ 双写模式已启用，新数据会同时写入文件和数据库');
        } else if (mode === 'db') {
          console.log('   ✅ 纯数据库模式，数据只写入数据库');
        } else {
          console.log('   ✅ 文件模式，数据只写入文件');
        }
      } else {
        console.log('⚠️  未找到 STORAGE_MODE 配置，使用默认模式');
      }
    } else {
      console.log('⚠️  .env 文件不存在');
    }
    
    // 关闭连接
    const { closePool } = require('./src/db/config');
    await closePool();
    
    console.log('\n✅ 检查完成！');
    
  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行检查
checkSyncStatus().catch(error => {
  console.error('❌ 检查失败:', error);
  process.exit(1);
});




