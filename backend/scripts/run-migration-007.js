#!/usr/bin/env node
/**
 * 运行数据库迁移 007：添加 home_content 列
 * 用法: node scripts/run-migration-007.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 从环境变量读取数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'piccco',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
};

console.log('========================================');
console.log('数据库迁移 007：添加 home_content 列');
console.log('========================================');
console.log('数据库配置:');
console.log(`  Host: ${dbConfig.host}`);
console.log(`  Port: ${dbConfig.port}`);
console.log(`  Database: ${dbConfig.database}`);
console.log(`  User: ${dbConfig.user}`);
console.log('========================================\n');

async function runMigration() {
  const { Client } = require('pg');
  const client = new Client(dbConfig);

  try {
    console.log('连接数据库...');
    await client.connect();
    console.log('✓ 数据库连接成功\n');

    // 读取迁移SQL文件
    const sqlFile = path.join(__dirname, '../migrations/007_add_home_content_column.sql');
    console.log(`读取迁移文件: ${sqlFile}`);
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('✓ 迁移文件读取成功\n');

    console.log('执行迁移SQL...');
    console.log('---');
    console.log(sql);
    console.log('---\n');

    await client.query(sql);
    console.log('✓ 迁移执行成功\n');

    // 验证列是否存在
    const checkResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'home_content'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✓ 验证成功：home_content 列已存在');
      console.log('列信息:', checkResult.rows[0]);
    } else {
      console.log('⚠ 警告：无法验证 home_content 列是否存在');
    }

    console.log('\n========================================');
    console.log('✅ 迁移 007 完成');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ 迁移失败:');
    console.error('错误信息:', error.message);
    console.error('错误代码:', error.code);
    console.error('详细信息:', error);
    console.error('\n可能的解决方案:');
    console.error('1. 检查数据库连接配置是否正确');
    console.error('2. 确认用户有 ALTER TABLE 权限');
    console.error('3. 如果权限不足，联系数据库管理员或使用 postgres 超级用户执行');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

