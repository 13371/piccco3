#!/bin/bash

# 从 PostgreSQL 获取用户密码哈希
# 使用方法：bash scripts/get-postgres-password-hash.sh

set -e

echo "🔍 从 PostgreSQL 获取用户密码哈希..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 读取数据库配置
cd "$PROJECT_DIR"
if [ -f .env ]; then
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
else
    echo "❌ 未找到 .env 文件"
    exit 1
fi

DB_USER=${DB_USER:-piccco_user}

# 检查 psql
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL="/www/server/pgsql/bin/psql"
elif command -v psql >/dev/null 2>&1; then
    PSQL="psql"
else
    echo "❌ 错误: 未找到 psql 命令"
    exit 1
fi

# 设置密码环境变量
if [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

echo "配置信息："
echo "  DB_USER: $DB_USER"
echo ""

# 方法 1: 从 pg_authid 获取密码哈希
echo "1. 从 pg_authid 获取密码哈希..."
USER_HASH=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -t -c "SELECT rolpassword FROM pg_authid WHERE rolname = '$DB_USER';" 2>/dev/null | tr -d ' ')

if [ -n "$USER_HASH" ] && [ "$USER_HASH" != "" ] && [ "$USER_HASH" != "(0" ]; then
    echo "✅ 从 PostgreSQL 获取到密码哈希："
    echo "   $USER_HASH"
    echo ""
    echo "2. 更新用户认证文件..."
    
    # 获取 postgres 用户的哈希
    POSTGRES_HASH=$($PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -t -c "SELECT rolpassword FROM pg_authid WHERE rolname = 'postgres';" 2>/dev/null | tr -d ' ')
    
    if [ -z "$POSTGRES_HASH" ] || [ "$POSTGRES_HASH" = "" ] || [ "$POSTGRES_HASH" = "(0" ]; then
        POSTGRES_HASH="md5e8a48653851e28c69d0506508fb27fc5"
    fi
    
    # 备份现有文件
    if [ -f "/etc/pgbouncer/userlist.txt" ]; then
        sudo cp /etc/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # 创建新的用户认证文件
    sudo bash -c "printf '\"%s\" \"%s\"\n' '$DB_USER' '$USER_HASH' > /etc/pgbouncer/userlist.txt"
    sudo bash -c "printf '\"%s\" \"%s\"\n' 'postgres' '$POSTGRES_HASH' >> /etc/pgbouncer/userlist.txt"
    
    echo "✅ 用户认证文件已更新"
    echo ""
    echo "文件内容："
    sudo cat /etc/pgbouncer/userlist.txt
    echo ""
    
    # 重启 PgBouncer
    echo "3. 重启 PgBouncer..."
    sudo systemctl restart pgbouncer
    sleep 2
    
    if systemctl is-active --quiet pgbouncer; then
        echo "✅ PgBouncer 重启成功"
    else
        echo "❌ PgBouncer 重启失败"
        sudo journalctl -u pgbouncer -n 10 --no-pager
        exit 1
    fi
    
    # 测试连接
    echo ""
    echo "4. 测试连接..."
    if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d piccco -c "SELECT version();" >/dev/null 2>&1; then
        echo "✅ 连接测试成功！"
        $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d piccco -c "SELECT version();" 2>&1 | head -3
    else
        echo "❌ 连接测试失败"
        echo ""
        echo "可能的原因："
        echo "  1. 密码哈希仍然不匹配"
        echo "  2. 需要重置 PostgreSQL 用户密码"
        echo ""
        echo "可以尝试重置密码："
        echo "  $PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -c \"ALTER USER $DB_USER WITH PASSWORD 'your_password';\""
    fi
else
    echo "❌ 无法从 PostgreSQL 获取密码哈希"
    echo ""
    echo "可能的原因："
    echo "  1. 用户不存在"
    echo "  2. 用户没有密码（使用 peer 或 trust 认证）"
    echo ""
    echo "可以尝试："
    echo "  1. 检查用户是否存在："
    echo "     $PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -c \"SELECT rolname FROM pg_roles WHERE rolname = '$DB_USER';\""
    echo ""
    echo "  2. 重置用户密码："
    echo "     $PSQL -h 127.0.0.1 -p 5432 -U postgres -d postgres -c \"ALTER USER $DB_USER WITH PASSWORD 'your_password';\""
fi

