#!/usr/bin/env node
/**
 * 执行数据库迁移：005 和 006
 * 005: 添加文件夹密码字段
 * 006: 添加首页内容字段
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function runMigration() {
  let adminPool = null;
  try {
    console.log('==========================================');
    console.log('执行数据库迁移：005 和 006');
    console.log('005: 添加文件夹密码字段');
    console.log('006: 添加首页内容字段');
    console.log('==========================================\n');

    // 使用 postgres 超级用户连接（需要修改表结构）
    // 优先使用 POSTGRES_USER 和 POSTGRES_PASSWORD（超级用户）
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'piccco',
      user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
    };
    
    // 如果使用普通用户，提示需要超级用户权限
    if (dbConfig.user !== 'postgres' && !process.env.POSTGRES_USER) {
      console.log('⚠️  警告：当前使用的是普通数据库用户，可能需要超级用户权限');
      console.log('   如果迁移失败，请设置 POSTGRES_USER 和 POSTGRES_PASSWORD 环境变量');
      console.log('   或者使用 postgres 超级用户执行迁移\n');
    }

    console.log('连接到数据库...');
    console.log(`  主机: ${dbConfig.host}`);
    console.log(`  端口: ${dbConfig.port}`);
    console.log(`  数据库: ${dbConfig.database}`);
    console.log(`  用户: ${dbConfig.user}\n`);

    adminPool = new Pool(dbConfig);
    
    // 测试连接
    await adminPool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功\n');

    // ========== 迁移 005: 添加文件夹密码字段 ==========
    console.log('==========================================');
    console.log('迁移 005: 添加文件夹密码字段');
    console.log('==========================================\n');

    // 检查 folders 表的 password 字段是否已存在
    console.log('1. 检查 folders 表的 password 字段...');
    const checkFolderPasswordQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'folders' 
      AND column_name = 'password';
    `;
    const folderPasswordExists = await adminPool.query(checkFolderPasswordQuery);
    
    if (folderPasswordExists.rows.length > 0) {
      console.log('   ⏭️  password 字段已存在，跳过添加');
    } else {
      console.log('2. 添加 password 字段到 folders 表...');
      await adminPool.query(`
        ALTER TABLE folders 
        ADD COLUMN IF NOT EXISTS password TEXT;
      `);
      console.log('   ✅ password 字段已添加');

      // 添加注释
      console.log('3. 添加字段注释...');
      await adminPool.query(`
        COMMENT ON COLUMN folders.password IS '隐私文件夹密码（加密存储）';
      `);
      console.log('   ✅ 字段注释已添加');
    }

    // ========== 迁移 006: 添加首页内容字段 ==========
    console.log('\n==========================================');
    console.log('迁移 006: 添加首页内容字段');
    console.log('==========================================\n');

    // 检查 user_settings 表的 home_content 字段是否已存在
    console.log('1. 检查 user_settings 表的 home_content 字段...');
    const checkHomeContentQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' 
      AND column_name = 'home_content';
    `;
    const homeContentExists = await adminPool.query(checkHomeContentQuery);
    
    if (homeContentExists.rows.length > 0) {
      console.log('   ⏭️  home_content 字段已存在，跳过添加');
    } else {
      console.log('2. 添加 home_content 字段到 user_settings 表...');
      await adminPool.query(`
        ALTER TABLE user_settings 
        ADD COLUMN IF NOT EXISTS home_content TEXT DEFAULT '';
      `);
      console.log('   ✅ home_content 字段已添加');

      // 添加注释
      console.log('3. 添加字段注释...');
      await adminPool.query(`
        COMMENT ON COLUMN user_settings.home_content IS '首页大白框内容';
      `);
      console.log('   ✅ 字段注释已添加');
    }

    // 验证迁移结果
    console.log('\n==========================================');
    console.log('验证迁移结果...');
    console.log('==========================================\n');

    // 验证 folders.password
    const verifyFolderPassword = await adminPool.query(checkFolderPasswordQuery);
    if (verifyFolderPassword.rows.length > 0) {
      console.log('✅ folders.password 字段存在');
    } else {
      console.log('❌ folders.password 字段不存在');
    }

    // 验证 user_settings.home_content
    const verifyHomeContent = await adminPool.query(checkHomeContentQuery);
    if (verifyHomeContent.rows.length > 0) {
      console.log('✅ user_settings.home_content 字段存在');
    } else {
      console.log('❌ user_settings.home_content 字段不存在');
    }

    console.log('\n==========================================');
    console.log('✅ 数据库迁移完成！');
    console.log('==========================================');
    console.log('\n迁移内容：');
    console.log('  ✅ 005: folders 表添加 password 字段');
    console.log('  ✅ 006: user_settings 表添加 home_content 字段');
    console.log('\n现在可以重启后端服务以应用更改。');
    console.log('==========================================\n');
    
    // 关闭连接池
    if (adminPool) {
      await adminPool.end();
    }
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 数据库迁移失败:');
    console.error(error.message);
    if (error.stack) {
      console.error('\n详细错误信息:');
      console.error(error.stack);
    }
    
    // 提供故障排除建议
    console.error('\n故障排除建议:');
    console.error('1. 检查 .env 文件中的数据库配置是否正确');
    console.error('2. 确认数据库用户有 ALTER TABLE 权限');
    console.error('3. 确认数据库连接信息正确');
    console.error('4. 检查数据库服务是否运行');
    
    // 关闭连接池
    if (adminPool) {
      await adminPool.end();
    }
    process.exit(1);
  }
}

// 运行迁移
runMigration();

