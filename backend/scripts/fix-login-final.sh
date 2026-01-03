#!/bin/bash

# 最终修复登录问题
# 使用方法：bash scripts/fix-login-final.sh [email]

EMAIL="${1:-zq13371@gmail.com}"

echo "🔧 开始修复登录问题..."
echo "=========================================="
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 检查并设置 STORAGE_MODE
echo "1️⃣  检查 STORAGE_MODE..."
if [ -f .env ]; then
    if grep -q "^STORAGE_MODE=" .env; then
        CURRENT_MODE=$(grep "^STORAGE_MODE=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
        echo "   当前 STORAGE_MODE: $CURRENT_MODE"
        if [ "$CURRENT_MODE" != "db" ]; then
            echo "   ⚠️  STORAGE_MODE 不是 db，正在更新..."
            sed -i 's/^STORAGE_MODE=.*/STORAGE_MODE=db/' .env
            echo "   ✅ 已更新为 STORAGE_MODE=db"
        else
            echo "   ✅ STORAGE_MODE 已正确设置为 db"
        fi
    else
        echo "   ⚠️  STORAGE_MODE 未设置，正在添加..."
        echo "" >> .env
        echo "# 存储模式" >> .env
        echo "STORAGE_MODE=db" >> .env
        echo "   ✅ 已添加 STORAGE_MODE=db"
    fi
else
    echo "   ❌ .env 文件不存在"
    exit 1
fi
echo ""

# 2. 检查密码格式
echo "2️⃣  检查密码格式..."
export PGPASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
DB_HOST=$(grep "^DB_HOST=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'" || echo "127.0.0.1")
DB_PORT=$(grep "^DB_PORT=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'" || echo "5432")

PASSWORD_INFO=$(PGPASSWORD="$PGPASSWORD" /www/server/pgsql/bin/psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d piccco -t -c "
SELECT 
    CASE 
        WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' OR password LIKE '\$2y\$%' THEN 'bcrypt'
        ELSE 'raw'
    END as format,
    LENGTH(password) as length
FROM users 
WHERE email = '$EMAIL';
" 2>/dev/null)

if [ -z "$PASSWORD_INFO" ]; then
    echo "   ❌ 用户不存在: $EMAIL"
    exit 1
fi

PASSWORD_FORMAT=$(echo "$PASSWORD_INFO" | awk '{print $1}')
PASSWORD_LENGTH=$(echo "$PASSWORD_INFO" | awk '{print $2}')

echo "   密码格式: $PASSWORD_FORMAT"
echo "   密码长度: $PASSWORD_LENGTH"

if [ "$PASSWORD_FORMAT" != "bcrypt" ] || [ "$PASSWORD_LENGTH" != "60" ]; then
    echo "   ⚠️  密码格式不正确，需要重置密码"
    echo ""
    echo "   请运行以下命令重置密码："
    echo "   bash scripts/reset-password-simple.sh $EMAIL"
    echo ""
    read -p "   是否现在重置密码？(y/n): " RESET_PASSWORD
    if [ "$RESET_PASSWORD" = "y" ] || [ "$RESET_PASSWORD" = "Y" ]; then
        if [ -f "scripts/reset-password-simple.sh" ]; then
            bash scripts/reset-password-simple.sh "$EMAIL"
        else
            echo "   ❌ 重置密码脚本不存在，请手动运行："
            echo "   bash scripts/reset-password-simple.sh $EMAIL"
            exit 1
        fi
    else
        echo "   ⚠️  请手动重置密码后再运行此脚本"
        exit 1
    fi
else
    echo "   ✅ 密码格式正确（bcrypt，长度 60）"
fi
echo ""

# 3. 清除缓存并重启应用
echo "3️⃣  清除缓存并重启应用..."
if command -v pm2 >/dev/null 2>&1; then
    echo "   正在重启应用..."
    pm2 restart piccco-backend --update-env
    sleep 5
    echo "   ✅ 应用已重启"
    
    # 检查应用状态
    PM2_STATUS=$(pm2 list | grep piccco-backend | awk '{print $10}')
    if [ "$PM2_STATUS" = "online" ]; then
        echo "   ✅ 应用状态: online"
    else
        echo "   ⚠️  应用状态: $PM2_STATUS"
    fi
else
    echo "   ⚠️  未找到 PM2"
fi
echo ""

# 4. 验证配置
echo "4️⃣  验证配置..."
echo "   STORAGE_MODE: $(grep "^STORAGE_MODE=" .env | cut -d'=' -f2 | tr -d ' ')"
echo "   密码格式: $PASSWORD_FORMAT"
echo "   密码长度: $PASSWORD_LENGTH"
echo ""

# 5. 测试连接
echo "5️⃣  测试数据库连接..."
if PGPASSWORD="$PGPASSWORD" /www/server/pgsql/bin/psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d piccco -c "SELECT 1;" >/dev/null 2>&1; then
    echo "   ✅ 数据库连接正常"
else
    echo "   ❌ 数据库连接失败"
fi
echo ""

echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "📝 下一步："
echo "1. 使用重置时设置的密码尝试登录"
echo "2. 如果仍然失败，查看日志："
echo "   pm2 logs piccco-backend | grep -i login"
echo "3. 确认输入的密码与重置时设置的密码一致"
echo ""

