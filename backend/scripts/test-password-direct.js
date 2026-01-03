#!/usr/bin/env node

// 直接测试密码验证（绕过应用层）
// 使用方法：node scripts/test-password-direct.js [email] [password]

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
    console.error('使用方法: node scripts/test-password-direct.js [email] [password]');
    process.exit(1);
}

// 数据库配置（使用 postgres 用户直接连接）
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'piccco',
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
});

async function testPassword() {
    try {
        console.log('🔐 直接测试密码验证...');
        console.log('==========================================');
        console.log('');

        // 1. 查询用户
        console.log('1️⃣  查询用户...');
        const userResult = await pool.query(
            'SELECT id, email, username, password FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            console.error(`❌ 用户不存在: ${email}`);
            await pool.end();
            process.exit(1);
        }

        const user = userResult.rows[0];
        const storedHash = user.password;

        console.log(`   ✅ 用户存在: ${user.email}`);
        console.log(`   用户名: ${user.username}`);
        console.log(`   密码哈希: ${storedHash.substring(0, 20)}...`);
        console.log(`   密码长度: ${storedHash.length}`);
        console.log('');

        // 2. 检查密码格式
        console.log('2️⃣  检查密码格式...');
        if (!storedHash.startsWith('$2a$') && !storedHash.startsWith('$2b$') && !storedHash.startsWith('$2y$')) {
            console.error('❌ 密码格式不正确，不是 bcrypt 哈希');
            await pool.end();
            process.exit(1);
        }
        console.log('   ✅ 密码格式正确（bcrypt）');
        console.log('');

        // 3. 测试密码验证
        console.log('3️⃣  测试密码验证...');
        console.log(`   输入的密码: ${password.substring(0, 1)}*** (已隐藏)`);
        console.log(`   存储的哈希: ${storedHash.substring(0, 20)}...`);
        console.log('');

        const startTime = Date.now();
        const match = await bcrypt.compare(password, storedHash);
        const duration = Date.now() - startTime;

        console.log(`   验证耗时: ${duration}ms`);
        console.log('');

        if (match) {
            console.log('✅ 密码匹配！');
            console.log('');
            console.log('💡 如果应用登录仍然失败，可能的原因：');
            console.log('   1. 应用缓存了旧数据，需要重启应用');
            console.log('   2. 密码在传输过程中被修改');
            console.log('   3. 应用代码中的密码验证逻辑有问题');
            console.log('');
            console.log('   建议：');
            console.log('   - 清除缓存并重启应用: bash scripts/clear-cache-and-restart.sh');
            console.log('   - 查看应用日志: pm2 logs piccco-backend | grep -i login');
        } else {
            console.log('❌ 密码不匹配！');
            console.log('');
            console.log('💡 请确认：');
            console.log('   1. 输入的密码与重置时设置的密码完全一致');
            console.log('   2. 密码区分大小写');
            console.log('   3. 如果忘记密码，重新设置：');
            console.log(`      bash scripts/reset-password-simple.sh ${email}`);
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

testPassword();

