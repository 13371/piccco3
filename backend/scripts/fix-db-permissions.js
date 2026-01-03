/**
 * 修复数据库权限脚本
 * 授予应用用户访问所有表的权限
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'piccco',
  user: 'postgres', // 使用 postgres 超级用户来授予权限
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '',
};

// 应用使用的数据库用户（从环境变量读取，默认为 postgres）
const appUser = process.env.DB_USER || 'postgres';

async function fixPermissions() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log(`\n🔧 开始修复数据库权限...`);
    console.log(`📋 应用用户: ${appUser}`);
    console.log(`📋 数据库: ${dbConfig.database}\n`);

    // 需要授予权限的表列表
    const tables = [
      'users',
      'folders',
      'notes',
      'urls',
      'user_settings',
      'messages',
      'message_history',
      'verification_codes',
      'logs',
      'migration_status'
    ];

    // 授予表权限
    for (const table of tables) {
      try {
        // 授予 SELECT, INSERT, UPDATE, DELETE 权限
        await pool.query(`
          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${table} TO ${appUser};
        `);
        console.log(`✅ 已授予 ${appUser} 对表 ${table} 的权限`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log(`⚠️  表 ${table} 不存在，跳过`);
        } else {
          console.error(`❌ 授予表 ${table} 权限失败:`, error.message);
        }
      }
    }

    // 授予序列权限（用于自增ID）
    const sequences = [
      'users_id_seq',
      'folders_id_seq',
      'notes_id_seq',
      'urls_id_seq',
      'user_settings_id_seq',
      'messages_id_seq',
      'message_history_id_seq',
      'verification_codes_id_seq',
      'logs_id_seq',
      'migration_status_id_seq'
    ];

    for (const sequence of sequences) {
      try {
        await pool.query(`
          GRANT USAGE, SELECT ON SEQUENCE ${sequence} TO ${appUser};
        `);
        console.log(`✅ 已授予 ${appUser} 对序列 ${sequence} 的权限`);
      } catch (error) {
        if (error.code === '42P01') {
          // 序列不存在，可能表使用了不同的序列名，忽略
        } else {
          console.log(`⚠️  序列 ${sequence} 权限设置失败（可能不存在）:`, error.message);
        }
      }
    }

    // 授予 schema 权限（如果需要）
    try {
      await pool.query(`
        GRANT USAGE ON SCHEMA public TO ${appUser};
      `);
      console.log(`✅ 已授予 ${appUser} 对 public schema 的权限`);
    } catch (error) {
      console.log(`⚠️  Schema 权限设置失败:`, error.message);
    }

    console.log(`\n✨ 权限修复完成！\n`);

    // 验证权限
    console.log(`🔍 验证权限...`);
    const testPool = new Pool({
      ...dbConfig,
      user: appUser,
    });

    try {
      const result = await testPool.query('SELECT COUNT(*) FROM users');
      console.log(`✅ 权限验证成功！可以访问 users 表（记录数: ${result.rows[0].count}）`);
    } catch (error) {
      console.error(`❌ 权限验证失败:`, error.message);
      console.error(`   请检查环境变量 DB_USER 和 DB_PASSWORD 是否正确`);
    } finally {
      await testPool.end();
    }

  } catch (error) {
    console.error('❌ 修复权限时出错:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行
fixPermissions();



