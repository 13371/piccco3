#!/usr/bin/env node

// 测试管理员密码验证
// 使用方法：node scripts/test-admin-password.js [password]

const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const password = process.argv[2];

if (!password) {
    console.error('使用方法: node scripts/test-admin-password.js [password]');
    process.exit(1);
}

function getAdminPasswordHash() {
    // 优先使用 ADMIN_PASSWORD_HASH
    if (process.env.ADMIN_PASSWORD_HASH) {
        return process.env.ADMIN_PASSWORD_HASH.trim();
    }
    
    // 如果没有设置哈希，返回 null（将使用明文比较）
    return null;
}

async function testAdminPassword() {
    try {
        console.log('🔐 测试管理员密码验证...');
        console.log('==========================================');
        console.log('');

        // 1. 检查环境变量
        console.log('1️⃣  检查环境变量...');
        const hashFromEnv = getAdminPasswordHash();
        
        if (!hashFromEnv) {
            console.log('   ❌ ADMIN_PASSWORD_HASH 未设置');
            console.log('');
            console.log('💡 请运行以下命令设置管理员密码：');
            console.log('   bash scripts/fix-admin-password.sh');
            process.exit(1);
        }

        console.log(`   ✅ ADMIN_PASSWORD_HASH 已设置`);
        console.log(`   哈希前缀: ${hashFromEnv.substring(0, 20)}...`);
        console.log(`   哈希长度: ${hashFromEnv.length}`);
        console.log('');

        // 2. 检查哈希格式
        console.log('2️⃣  检查哈希格式...');
        if (!hashFromEnv.startsWith('$2a$') && !hashFromEnv.startsWith('$2b$') && !hashFromEnv.startsWith('$2y$')) {
            console.error('   ❌ 密码格式不正确，不是 bcrypt 哈希');
            console.log(`   当前格式: ${hashFromEnv.substring(0, 10)}...`);
            process.exit(1);
        }
        console.log('   ✅ 密码格式正确（bcrypt）');
        console.log('');

        // 3. 测试密码验证
        console.log('3️⃣  测试密码验证...');
        console.log(`   输入的密码: ${password.substring(0, 1)}*** (已隐藏)`);
        console.log(`   存储的哈希: ${hashFromEnv.substring(0, 20)}...`);
        console.log('');

        const startTime = Date.now();
        const match = await bcrypt.compare(password, hashFromEnv);
        const duration = Date.now() - startTime;

        console.log(`   验证耗时: ${duration}ms`);
        console.log('');

        if (match) {
            console.log('✅ 密码匹配！');
            console.log('');
            console.log('💡 如果应用登录仍然失败，可能的原因：');
            console.log('   1. 应用缓存了旧的环境变量，需要重启应用');
            console.log('   2. 密码在传输过程中被修改');
            console.log('   3. 应用代码中的密码验证逻辑有问题');
            console.log('');
            console.log('   建议：');
            console.log('   - 重启应用: pm2 restart piccco-backend --update-env');
            console.log('   - 查看应用日志: pm2 logs piccco-backend | grep -i admin');
        } else {
            console.log('❌ 密码不匹配！');
            console.log('');
            console.log('💡 请确认：');
            console.log('   1. 输入的密码与重置时设置的密码完全一致');
            console.log('   2. 密码区分大小写');
            console.log('   3. 如果忘记密码，重新设置：');
            console.log('      bash scripts/fix-admin-password.sh');
        }

        process.exit(match ? 0 : 1);
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testAdminPassword();

