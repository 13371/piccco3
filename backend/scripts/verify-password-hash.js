#!/usr/bin/env node

// 验证密码哈希
// 使用方法：node scripts/verify-password-hash.js [email] [password]

const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
    console.error('使用方法: node scripts/verify-password-hash.js [email] [password]');
    process.exit(1);
}

// 数据库配置
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (process.env.USE_PGBOUNCER === 'true' ? '6432' : '5432'), 10),
    database: process.env.DB_NAME || 'piccco',
    user: 'postgres', // 使用 postgres 用户进行管理操作
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
});

async function verifyPassword() {
    try {
        // 查询用户
        const result = await pool.query(
            'SELECT email, password FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            console.error(`❌ 用户不存在: ${email}`);
            process.exit(1);
        }

        const user = result.rows[0];
        const storedHash = user.password;

        console.log('📋 用户信息:');
        console.log(`   邮箱: ${user.email}`);
        console.log(`   密码哈希: ${storedHash.substring(0, 20)}...`);
        console.log(`   密码长度: ${storedHash.length}`);
        console.log('');

        // 检查密码格式
        if (!storedHash.startsWith('$2a$') && !storedHash.startsWith('$2b$') && !storedHash.startsWith('$2y$')) {
            console.error('❌ 密码格式不正确，不是 bcrypt 哈希');
            process.exit(1);
        }

        console.log('✅ 密码格式正确（bcrypt）');
        console.log('');

        // 验证密码
        console.log('🔐 验证密码...');
        const match = await bcrypt.compare(password, storedHash);

        if (match) {
            console.log('✅ 密码匹配！');
            console.log('');
            console.log('💡 如果登录仍然失败，可能是：');
            console.log('   1. 应用缓存了旧数据，需要重启应用');
            console.log('   2. 密码在传输过程中被修改');
        } else {
            console.log('❌ 密码不匹配！');
            console.log('');
            console.log('💡 请确认：');
            console.log('   1. 输入的密码与重置时设置的密码完全一致');
            console.log('   2. 密码区分大小写');
            console.log('   3. 如果忘记密码，重新设置：');
            console.log('      bash scripts/reset-password-simple.sh ' + email);
        }

        await pool.end();
        process.exit(match ? 0 : 1);
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

verifyPassword();

