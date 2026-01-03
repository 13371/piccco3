#!/bin/bash

# 修复用户密码（将原始密码转换为 bcrypt 哈希）
# 使用方法：bash scripts/fix-user-password.sh [email] [new_password]

echo "🔧 修复用户密码..."
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
    echo "请输入新密码（将使用 bcrypt 加密）："
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

# 检查 Node.js 和 bcrypt
if ! command -v node >/dev/null 2>&1; then
    echo "❌ 未找到 Node.js"
    exit 1
fi

echo "正在生成 bcrypt 哈希..."
# 使用项目中的 Node.js 脚本生成 bcrypt 哈希
cd "$PROJECT_DIR"

# 检查并安装 bcrypt（如果需要）
if [ ! -d "node_modules/bcrypt" ]; then
    echo "正在安装 bcrypt 模块..."
    npm install bcrypt 2>&1 | tail -5
fi

# 尝试多种方法生成哈希
BCRYPT_HASH=""

# 方法1: 使用独立脚本
if [ -f "scripts/generate-bcrypt-hash.js" ]; then
    BCRYPT_HASH=$(cd "$PROJECT_DIR" && node scripts/generate-bcrypt-hash.js "$NEW_PASSWORD" 2>&1)
    if [ -n "$BCRYPT_HASH" ] && [ "${BCRYPT_HASH:0:4}" = "\$2a\$" ] || [ "${BCRYPT_HASH:0:4}" = "\$2b\$" ]; then
        echo "✅ 使用方法1生成成功"
    else
        BCRYPT_HASH=""
    fi
fi

# 方法2: 直接使用 node -e（如果方法1失败）
if [ -z "$BCRYPT_HASH" ] && [ -d "node_modules/bcrypt" ]; then
    BCRYPT_HASH=$(cd "$PROJECT_DIR" && node -e "
const path = require('path');
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcrypt'));
const password = process.argv[1];
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
  console.log(hash);
});
" "$NEW_PASSWORD" 2>&1)
    
    if echo "$BCRYPT_HASH" | grep -q "ERROR"; then
        BCRYPT_HASH=""
    elif [ -n "$BCRYPT_HASH" ] && ([ "${BCRYPT_HASH:0:4}" = "\$2a\$" ] || [ "${BCRYPT_HASH:0:4}" = "\$2b\$" ]); then
        echo "✅ 使用方法2生成成功"
    else
        BCRYPT_HASH=""
    fi
fi

# 方法3: 使用 npx（如果前两种方法都失败）
if [ -z "$BCRYPT_HASH" ] && command -v npx >/dev/null 2>&1; then
    echo "尝试使用 npx..."
    BCRYPT_HASH=$(cd "$PROJECT_DIR" && npx -y bcrypt-cli hash "$NEW_PASSWORD" 2>&1 | tail -1)
    if [ -n "$BCRYPT_HASH" ] && ([ "${BCRYPT_HASH:0:4}" = "\$2a\$" ] || [ "${BCRYPT_HASH:0:4}" = "\$2b\$" ]); then
        echo "✅ 使用方法3生成成功"
    else
        BCRYPT_HASH=""
    fi
fi

if [ -z "$BCRYPT_HASH" ] || [ "${BCRYPT_HASH:0:4}" != "\$2a\$" ] && [ "${BCRYPT_HASH:0:4}" != "\$2b\$" ]; then
    echo "❌ 生成 bcrypt 哈希失败"
    exit 1
fi

echo "✅ 已生成 bcrypt 哈希"
echo ""

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
else
    PSQL="psql"
fi

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

# 显示当前密码信息
echo "当前密码信息："
CURRENT_PWD=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT 
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'bcrypt'
        WHEN password LIKE '\$2y\$%' THEN 'bcrypt (2y)'
        ELSE 'raw/unknown'
    END as format,
    LENGTH(password) as length
FROM users 
WHERE email = '$EMAIL';
" 2>/dev/null)

echo "$CURRENT_PWD"
echo ""

# 更新密码（使用单引号转义）
echo "更新密码..."
# 转义单引号
ESCAPED_HASH=$(echo "$BCRYPT_HASH" | sed "s/'/''/g")
ESCAPED_EMAIL=$(echo "$EMAIL" | sed "s/'/''/g")

UPDATE_RESULT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -c "
UPDATE users 
SET password = '$ESCAPED_HASH', updated_at = CURRENT_TIMESTAMP
WHERE email = '$ESCAPED_EMAIL';
" 2>&1)

if echo "$UPDATE_RESULT" | grep -q "UPDATE 1"; then
    echo "✅ 密码更新成功"
else
    echo "❌ 密码更新失败："
    echo "$UPDATE_RESULT"
    exit 1
fi

echo ""
echo "验证新密码格式..."
NEW_FORMAT=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d "$DB_NAME" -t -c "
SELECT 
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'bcrypt'
        WHEN password LIKE '\$2y\$%' THEN 'bcrypt (2y)'
        ELSE 'raw/unknown'
    END as format,
    LENGTH(password) as length
FROM users 
WHERE email = '$EMAIL';
" 2>/dev/null)

echo "新密码格式: $NEW_FORMAT"
echo ""

if echo "$NEW_FORMAT" | grep -q "bcrypt"; then
    echo "✅ 密码格式正确（bcrypt）"
    echo ""
    echo "现在可以使用新密码登录了！"
    echo "邮箱: $EMAIL"
    echo "密码: (你刚才输入的密码)"
else
    echo "⚠️  密码格式可能不正确"
fi

