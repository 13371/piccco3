#!/bin/bash

# PgBouncer 安装和配置脚本（适用于宝塔面板）
# 使用方法：bash scripts/install-pgbouncer.sh

set -e

echo "🚀 开始安装和配置 PgBouncer..."
echo ""

# 检查是否已安装
if command -v pgbouncer >/dev/null 2>&1; then
    echo "✅ PgBouncer 已安装"
    pgbouncer --version
else
    echo "📦 安装 PgBouncer..."
    
    # 检测系统类型
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo "❌ 无法检测操作系统类型"
        exit 1
    fi
    
    # 根据系统类型安装
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        echo "使用 apt-get 安装..."
        sudo apt-get update
        sudo apt-get install -y pgbouncer
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "almalinux" ]; then
        echo "使用 yum 安装..."
        # 检查是否有 EPEL 仓库
        if ! rpm -qa | grep -q epel-release; then
            echo "安装 EPEL 仓库..."
            sudo yum install -y epel-release
        fi
        sudo yum install -y pgbouncer
    else
        echo "❌ 不支持的操作系统: $OS"
        echo "   请手动安装 PgBouncer"
        echo "   Ubuntu/Debian: sudo apt-get install -y pgbouncer"
        echo "   CentOS/RHEL: sudo yum install -y pgbouncer"
        exit 1
    fi
    
    echo "✅ PgBouncer 安装完成"
fi

echo ""
echo "📝 配置 PgBouncer..."

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 检查配置文件是否存在
if [ ! -f "$PROJECT_DIR/config/pgbouncer.ini.example" ]; then
    echo "❌ 未找到配置文件: $PROJECT_DIR/config/pgbouncer.ini.example"
    exit 1
fi

# 复制配置文件
echo "复制配置文件..."
# 检查 /etc/pgbouncer 目录是否存在
if [ ! -d "/etc/pgbouncer" ]; then
    echo "创建 /etc/pgbouncer 目录..."
    sudo mkdir -p /etc/pgbouncer
fi

# 备份现有配置（如果存在）
if [ -f "/etc/pgbouncer/pgbouncer.ini" ]; then
    echo "备份现有配置文件..."
    sudo cp /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini.backup.$(date +%Y%m%d_%H%M%S)
fi

sudo cp "$PROJECT_DIR/config/pgbouncer.ini.example" /etc/pgbouncer/pgbouncer.ini

# 读取数据库配置
cd "$PROJECT_DIR"
if [ -f .env ]; then
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
else
    echo "⚠️  未找到 .env 文件，使用默认值"
    DB_NAME="piccco"
    DB_USER="piccco_user"
    DB_PASSWORD=""
fi

DB_NAME=${DB_NAME:-piccco}
DB_USER=${DB_USER:-piccco_user}

echo "数据库配置:"
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo ""

# 更新配置文件中的数据库名称
sudo sed -i "s/dbname=piccco/dbname=$DB_NAME/g" /etc/pgbouncer/pgbouncer.ini

# 创建用户认证文件
echo "创建用户认证文件..."

if [ -n "$DB_PASSWORD" ]; then
    # 生成 MD5 哈希
    MD5_HASH=$(echo -n "$DB_PASSWORD$DB_USER" | md5sum | awk '{print "md5"$1}')
    
    # 创建用户列表文件
    sudo tee /etc/pgbouncer/userlist.txt > /dev/null <<EOF
"$DB_USER" "$MD5_HASH"
"postgres" "md5$(echo -n 'postgres' | md5sum | awk '{print $1}')"
EOF
    
    echo "✅ 用户认证文件已创建"
else
    echo "⚠️  未设置 DB_PASSWORD，请手动创建 /etc/pgbouncer/userlist.txt"
    echo ""
    echo "生成 MD5 哈希的方法："
    echo "  echo -n 'your_password$DB_USER' | md5sum | awk '{print \"md5\"\$1}'"
fi

# 创建日志和运行目录
echo "创建日志和运行目录..."
sudo mkdir -p /var/log/pgbouncer
sudo mkdir -p /var/run/pgbouncer

# 设置权限
if id "pgbouncer" &>/dev/null; then
    sudo chown pgbouncer:pgbouncer /var/log/pgbouncer
    sudo chown pgbouncer:pgbouncer /var/run/pgbouncer
else
    echo "⚠️  pgbouncer 用户不存在，使用 root 权限"
    sudo chown root:root /var/log/pgbouncer
    sudo chown root:root /var/run/pgbouncer
fi

# 验证配置文件
echo "验证配置文件..."
if command -v pgbouncer >/dev/null 2>&1; then
    # 使用 -V 参数验证配置（不启动服务）
    if sudo pgbouncer -V /etc/pgbouncer/pgbouncer.ini >/dev/null 2>&1; then
        echo "✅ 配置文件验证通过"
    else
        echo "⚠️  配置文件验证失败，请检查配置"
        echo "   可以手动验证: sudo pgbouncer -V /etc/pgbouncer/pgbouncer.ini"
    fi
else
    echo "⚠️  pgbouncer 命令不可用，跳过验证"
fi

echo ""
echo "🎯 下一步操作："
echo ""

# 检查 systemctl 是否可用
if command -v systemctl >/dev/null 2>&1; then
    echo "1. 启动 PgBouncer:"
    echo "   sudo systemctl start pgbouncer"
    echo ""
    echo "2. 设置开机自启:"
    echo "   sudo systemctl enable pgbouncer"
    echo ""
    echo "3. 检查状态:"
    echo "   sudo systemctl status pgbouncer"
    echo ""
else
    echo "1. 启动 PgBouncer（手动方式）:"
    echo "   sudo pgbouncer -d /etc/pgbouncer/pgbouncer.ini"
    echo ""
    echo "   或者创建 systemd 服务文件（推荐）"
    echo ""
fi

echo "4. 测试连接:"
if [ -f "/www/server/pgsql/bin/psql" ]; then
    echo "   /www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
else
    echo "   psql -h 127.0.0.1 -p 6432 -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
fi
echo ""

echo "5. 更新应用配置 (.env):"
echo "   添加以下配置："
echo "   USE_PGBOUNCER=true"
echo "   DB_PORT=6432"
echo ""

echo "6. 重启应用:"
echo "   pm2 restart piccco-backend --update-env"
echo ""

echo "7. 验证连接池状态:"
echo "   连接到管理数据库查看统计信息："
if [ -f "/www/server/pgsql/bin/psql" ]; then
    echo "   /www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c 'SHOW POOLS;'"
else
    echo "   psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c 'SHOW POOLS;'"
fi
echo ""


