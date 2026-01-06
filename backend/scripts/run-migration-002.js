#!/usr/bin/env node
/**
 * 执行数据库迁移：添加永久删除的笔记和网址ID字段
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function runMigration() {
  let adminPool = null;
  try {
    console.log('==========================================');
    console.log('执行数据库迁移：添加永久删除字段');
    console.log('==========================================\n');

    // 使用 postgres 超级用户连接（需要修改表结构）
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'piccco',
      user: 'postgres', // 使用 postgres 超级用户
      password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
    };

    console.log('使用 postgres 用户连接数据库...');
    adminPool = new Pool(dbConfig);
    
    // 测试连接
    await adminPool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功\n');

    // 检查字段是否已存在
    console.log('1. 检查字段是否已存在...');
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' 
      AND column_name IN ('permanently_deleted_note_ids', 'permanently_deleted_url_ids');
    `;
    const existingColumns = await adminPool.query(checkQuery);
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    
    if (existingColumnNames.includes('permanently_deleted_note_ids') && 
        existingColumnNames.includes('permanently_deleted_url_ids')) {
      console.log('✅ 字段已存在，跳过迁移');
      process.exit(0);
    }

    // 添加字段
    console.log('2. 添加永久删除字段...');
    
    if (!existingColumnNames.includes('permanently_deleted_note_ids')) {
      console.log('   添加 permanently_deleted_note_ids 字段...');
      await adminPool.query(`
        ALTER TABLE user_settings 
        ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];
      `);
      console.log('   ✅ permanently_deleted_note_ids 字段已添加');
    } else {
      console.log('   ⏭️  permanently_deleted_note_ids 字段已存在');
    }

    if (!existingColumnNames.includes('permanently_deleted_url_ids')) {
      console.log('   添加 permanently_deleted_url_ids 字段...');
      await adminPool.query(`
        ALTER TABLE user_settings 
        ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];
      `);
      console.log('   ✅ permanently_deleted_url_ids 字段已添加');
    } else {
      console.log('   ⏭️  permanently_deleted_url_ids 字段已存在');
    }

    // 添加注释
    console.log('3. 添加字段注释...');
    await adminPool.query(`
      COMMENT ON COLUMN user_settings.permanently_deleted_note_ids IS '永久删除的笔记ID列表';
    `);
    await adminPool.query(`
      COMMENT ON COLUMN user_settings.permanently_deleted_url_ids IS '永久删除的网址ID列表';
    `);
    console.log('   ✅ 字段注释已添加');

    console.log('\n==========================================');
    console.log('✅ 数据库迁移完成！');
    console.log('==========================================');
    
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
    
    // 关闭连接池
    if (adminPool) {
      await adminPool.end();
    }
    process.exit(1);
  }
}

// 运行迁移
runMigration();

