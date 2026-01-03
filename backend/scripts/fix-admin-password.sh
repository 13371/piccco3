#!/bin/bash

# 修复管理员密码
# 使用方法：bash scripts/fix-admin-password.sh

echo "🔧 修复管理员密码..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ .env 文件不存在"
    exit 1
fi

# 检查是否已有 ADMIN_PASSWORD 或 ADMIN_PASSWORD_HASH
HAS_ADMIN_PASSWORD=$(grep -q "^ADMIN_PASSWORD=" .env && echo "yes" || echo "no")
HAS_ADMIN_PASSWORD_HASH=$(grep -q "^ADMIN_PASSWORD_HASH=" .env && echo "yes" || echo "no")

if [ "$HAS_ADMIN_PASSWORD_HASH" = "yes" ]; then
    echo "✅ ADMIN_PASSWORD_HASH 已存在"
    echo ""
    echo "   如果忘记密码，可以："
    echo "   1. 设置新的 ADMIN_PASSWORD（明文），应用会自动生成哈希"
    echo "   2. 或者直接设置新的 ADMIN_PASSWORD_HASH"
    echo ""
    read -p "   是否要设置新的管理员密码？(y/n): " SET_NEW
    if [ "$SET_NEW" != "y" ] && [ "$SET_NEW" != "Y" ]; then
        echo "   取消操作"
        exit 0
    fi
fi

# 提示输入新密码
echo "请输入新的管理员密码："
read -s NEW_PASSWORD
echo ""

if [ -z "$NEW_PASSWORD" ]; then
    echo "❌ 密码不能为空"
    exit 1
fi

echo "请再次输入密码确认："
read -s CONFIRM_PASSWORD
echo ""

if [ "$NEW_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
    echo "❌ 两次输入的密码不一致"
    exit 1
fi

# 生成 bcrypt 哈希
echo "正在生成 bcrypt 哈希..."
TMP_HASH_SCRIPT=$(mktemp)
cat > "$TMP_HASH_SCRIPT" << 'NODE_EOF'
const bcrypt = require('bcrypt');
const password = process.argv[1];
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
  console.log(hash);
});
NODE_EOF

BCRYPT_HASH=$(cd "$PROJECT_DIR" && node "$TMP_HASH_SCRIPT" "$NEW_PASSWORD" 2>&1)
rm -f "$TMP_HASH_SCRIPT"

# 检查哈希是否有效
if echo "$BCRYPT_HASH" | grep -q "ERROR"; then
    echo "❌ 生成哈希失败："
    echo "$BCRYPT_HASH"
    echo ""
    echo "请尝试手动安装 bcrypt:"
    echo "  cd $PROJECT_DIR && npm install bcrypt"
    exit 1
fi

if [ -z "$BCRYPT_HASH" ] || ([ "${BCRYPT_HASH:0:4}" != "\$2a\$" ] && [ "${BCRYPT_HASH:0:4}" != "\$2b\$" ]); then
    echo "❌ 生成的哈希格式不正确：$BCRYPT_HASH"
    exit 1
fi

echo "✅ 已生成 bcrypt 哈希"
echo ""

# 更新 .env 文件
echo "更新 .env 文件..."

# 删除旧的 ADMIN_PASSWORD 和 ADMIN_PASSWORD_HASH
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' '/^ADMIN_PASSWORD=/d' .env
    sed -i '' '/^ADMIN_PASSWORD_HASH=/d' .env
else
    # Linux
    sed -i '/^ADMIN_PASSWORD=/d' .env
    sed -i '/^ADMIN_PASSWORD_HASH=/d' .env
fi

# 添加新的 ADMIN_PASSWORD_HASH
echo "" >> .env
echo "# 管理员密码（bcrypt 哈希）" >> .env
echo "ADMIN_PASSWORD_HASH=$BCRYPT_HASH" >> .env

echo "✅ 已更新 .env 文件"
echo ""

# 重启应用
echo "🔄 重启应用..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart piccco-backend --update-env
    sleep 3
    
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}' || echo "unknown")
    if [ "$PM2_STATUS" = "online" ]; then
        echo "✅ 应用已重启"
    else
        echo "⚠️  应用状态: $PM2_STATUS"
    fi
else
    echo "⚠️  未找到 PM2，请手动重启应用"
fi
echo ""

echo "=========================================="
echo "✅ 管理员密码已设置！"
echo "=========================================="
echo ""
echo "📝 现在可以使用以下密码登录后台管理："
echo "   密码: (你刚才输入的密码)"
echo ""
echo "💡 提示："
echo "   - 后台管理地址: http://你的IP:4000/admin"
echo "   - 如果登录仍然失败，请清除浏览器缓存和 Cookie"
echo ""

