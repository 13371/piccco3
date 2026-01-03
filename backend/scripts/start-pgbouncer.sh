#!/bin/bash

# 启动和配置 PgBouncer 脚本
# 使用方法：bash scripts/start-pgbouncer.sh

set -e

echo "🚀 启动和配置 PgBouncer..."
echo ""

# 检查 PgBouncer 是否已安装
if ! command -v pgbouncer >/dev/null 2>&1 && [ ! -f "/usr/bin/pgbouncer" ] && [ ! -f "/usr/local/bin/pgbouncer" ]; then
    echo "❌ PgBouncer 未安装，请先运行："
    echo "   bash scripts/install-pgbouncer.sh"
    exit 1
fi

# 检查配置文件
if [ ! -f "/etc/pgbouncer/pgbouncer.ini" ]; then
    echo "❌ PgBouncer 配置文件不存在：/etc/pgbouncer/pgbouncer.ini"
    echo "   请先运行：bash scripts/install-pgbouncer.sh"
    exit 1
fi

# 启动 PgBouncer
echo "1. 启动 PgBouncer 服务..."

if command -v systemctl >/dev/null 2>&1; then
    # 使用 systemd
    if systemctl is-active --quiet pgbouncer; then
        echo "✅ PgBouncer 已在运行"
    else
        echo "启动 PgBouncer..."
        sudo systemctl start pgbouncer
        sleep 2
        
        if systemctl is-active --quiet pgbouncer; then
            echo "✅ PgBouncer 启动成功"
        else
            echo "❌ PgBouncer 启动失败"
            echo "查看日志：sudo journalctl -u pgbouncer -n 20"
            exit 1
        fi
    fi
    
    # 设置开机自启
    echo ""
    echo "2. 设置开机自启..."
    sudo systemctl enable pgbouncer
    echo "✅ 已设置开机自启"
    
    # 检查状态
    echo ""
    echo "3. 检查服务状态..."
    sudo systemctl status pgbouncer --no-pager | head -10
else
    # 手动启动
    echo "⚠️  systemctl 不可用，尝试手动启动..."
    
    # 检查是否已在运行
    if pgrep -f "pgbouncer" >/dev/null; then
        echo "✅ PgBouncer 进程已在运行"
    else
        echo "启动 PgBouncer（后台运行）..."
        sudo pgbouncer -d /etc/pgbouncer/pgbouncer.ini
        sleep 2
        
        if pgrep -f "pgbouncer" >/dev/null; then
            echo "✅ PgBouncer 启动成功"
        else
            echo "❌ PgBouncer 启动失败"
            echo "查看日志：sudo tail -f /var/log/pgbouncer/pgbouncer.log"
            exit 1
        fi
    fi
fi

# 测试连接
echo ""
echo "4. 测试 PgBouncer 连接..."

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"
if [ -f .env ]; then
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
else
    DB_NAME="piccco"
    DB_USER="piccco_user"
fi

DB_NAME=${DB_NAME:-piccco}
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

# 测试连接
if $PSQL -h 127.0.0.1 -p 6432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ PgBouncer 连接测试成功"
else
    echo "⚠️  PgBouncer 连接测试失败，可能需要密码"
    echo "   手动测试：$PSQL -h 127.0.0.1 -p 6432 -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
fi

# 查看连接池状态
echo ""
echo "5. 查看连接池状态..."
if $PSQL -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;" 2>/dev/null; then
    echo "✅ 连接池状态正常"
else
    echo "⚠️  无法查看连接池状态（可能需要 postgres 用户权限）"
fi

echo ""
echo "✅ PgBouncer 配置完成！"
echo ""
echo "📝 下一步："
echo "   1. 更新应用配置 (.env)："
echo "      USE_PGBOUNCER=true"
echo "      DB_PORT=6432"
echo ""
echo "   2. 重启应用："
echo "      pm2 restart piccco-backend --update-env"
echo ""



