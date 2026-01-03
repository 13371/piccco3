#!/bin/bash

# 简单的密码重置脚本（使用应用代码）
# 使用方法：bash scripts/reset-password-simple.sh [email] [new_password]

echo "🔧 重置用户密码（简单方法）..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 读取配置
if [ -f .env ]; then
    TMP_ENV=$(mktemp)
    sed 's/\r$//' .env > "$TMP_ENV"
    set -a
    source "$TMP_ENV"
    set +a
    rm -f "$TMP_ENV"
    
    DB_NAME=${DB_NAME:-piccco}
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

# 检查参数
EMAIL="${1:-zq13371@gmail.com}"
NEW_PASSWORD="${2:-}"

if [ -z "$NEW_PASSWORD" ]; then
    echo "请输入新密码："
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
fi

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

# 方法：使用 Node.js 应用代码生成哈希
echo "正在使用应用代码生成 bcrypt 哈希..."
cd "$PROJECT_DIR"

# 创建一个临时 Node.js 脚本，使用应用的 bcrypt
TMP_HASH_SCRIPT=$(mktemp)
cat > "$TMP_HASH_SCRIPT" << 'NODE_EOF'
const path = require('path');
const fs = require('fs');

// 尝试多种方式加载 bcrypt
let bcrypt;
const projectRoot = process.cwd();

// 方法1: 从 node_modules 加载
try {
  bcrypt = require(path.join(projectRoot, 'node_modules', 'bcrypt'));
} catch (e) {
  // 方法2: 直接 require
  try {
    bcrypt = require('bcrypt');
  } catch (e2) {
    console.error('ERROR: Cannot find bcrypt module');
    console.error('Please run: npm install bcrypt');
    process.exit(1);
  }
}

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

# 检查用户是否存在
echo "检查用户是否存在..."
USER_EXISTS=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT COUNT(*) FROM users WHERE email = '$EMAIL';
" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" != "1" ]; then
    echo "❌ 用户不存在: $EMAIL"
    exit 1
fi

echo "✅ 用户存在: $EMAIL"
echo ""

# 更新密码
echo "更新密码..."
ESCAPED_HASH=$(echo "$BCRYPT_HASH" | sed "s/'/''/g")
ESCAPED_EMAIL=$(echo "$EMAIL" | sed "s/'/''/g")

UPDATE_RESULT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
UPDATE users 
SET password = '$ESCAPED_HASH', updated_at = CURRENT_TIMESTAMP
WHERE email = '$ESCAPED_EMAIL';
" 2>&1)

if echo "$UPDATE_RESULT" | grep -q "UPDATE 1"; then
    echo "✅ 密码更新成功！"
    echo ""
    echo "现在可以使用新密码登录了："
    echo "  邮箱: $EMAIL"
    echo "  密码: (你刚才输入的密码)"
else
    echo "❌ 密码更新失败："
    echo "$UPDATE_RESULT"
    exit 1
fi

