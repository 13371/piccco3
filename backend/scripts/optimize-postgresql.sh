#!/bin/bash
# PostgreSQL 性能优化脚本
# 适用于 Ubuntu/Debian 系统

# 不设置 set -e，允许某些命令失败
set +e

echo "🚀 开始优化 PostgreSQL 配置..."

# 检测 PostgreSQL 配置文件位置（多种方法）
PG_CONF=""

# 方法1: 尝试通过 systemctl 查找
if command -v systemctl >/dev/null 2>&1; then
    PG_SERVICE=$(systemctl list-units --type=service | grep -i postgresql | head -1 | awk '{print $1}')
    if [ -n "$PG_SERVICE" ]; then
        # 从服务名提取版本号（例如 postgresql@14-main）
        PG_VERSION=$(echo "$PG_SERVICE" | grep -oE '[0-9]+' | head -1)
        if [ -n "$PG_VERSION" ]; then
            PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
        fi
    fi
fi

# 方法2: 尝试通过 psql 查找
if [ -z "$PG_CONF" ] && command -v psql >/dev/null 2>&1; then
    PG_VERSION=$(psql --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
    PG_MAJOR_VERSION=$(echo $PG_VERSION | cut -d. -f1)
    if [ -n "$PG_MAJOR_VERSION" ]; then
        PG_CONF="/etc/postgresql/${PG_MAJOR_VERSION}/main/postgresql.conf"
    fi
fi

# 方法3: 直接搜索常见位置
if [ -z "$PG_CONF" ] || [ ! -f "$PG_CONF" ]; then
    # 搜索常见的配置文件位置
    for possible_conf in \
        /etc/postgresql/*/main/postgresql.conf \
        /var/lib/pgsql/*/data/postgresql.conf \
        /usr/local/pgsql/data/postgresql.conf; do
        if [ -f "$possible_conf" ]; then
            PG_CONF="$possible_conf"
            break
        fi
    done
fi

# 方法4: 使用 find 命令查找
if [ -z "$PG_CONF" ] || [ ! -f "$PG_CONF" ]; then
    PG_CONF=$(find /etc -name postgresql.conf 2>/dev/null | head -1)
fi

# 如果仍然找不到，提示用户
if [ -z "$PG_CONF" ] || [ ! -f "$PG_CONF" ]; then
    echo "❌ 未找到 PostgreSQL 配置文件"
    echo ""
    echo "请手动查找配置文件位置："
    echo "  sudo find /etc -name postgresql.conf"
    echo "  sudo find /var -name postgresql.conf"
    echo ""
    echo "找到后，请手动编辑配置文件，参考："
    echo "  backend/config/postgresql.conf.example"
    exit 1
fi

echo "✅ 找到 PostgreSQL 配置文件: $PG_CONF"

echo "📝 备份配置文件..."
sudo cp "$PG_CONF" "${PG_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

echo "⚙️  应用优化配置..."

# 检查并更新配置项
sudo sed -i "s/^#shared_buffers = .*/shared_buffers = 512MB/" "$PG_CONF" || \
sudo sed -i "s/^shared_buffers = .*/shared_buffers = 512MB/" "$PG_CONF" || \
echo "shared_buffers = 512MB" | sudo tee -a "$PG_CONF"

sudo sed -i "s/^#work_mem = .*/work_mem = 8MB/" "$PG_CONF" || \
sudo sed -i "s/^work_mem = .*/work_mem = 8MB/" "$PG_CONF" || \
echo "work_mem = 8MB" | sudo tee -a "$PG_CONF"

sudo sed -i "s/^#maintenance_work_mem = .*/maintenance_work_mem = 128MB/" "$PG_CONF" || \
sudo sed -i "s/^maintenance_work_mem = .*/maintenance_work_mem = 128MB/" "$PG_CONF" || \
echo "maintenance_work_mem = 128MB" | sudo tee -a "$PG_CONF"

sudo sed -i "s/^#effective_cache_size = .*/effective_cache_size = 1GB/" "$PG_CONF" || \
sudo sed -i "s/^effective_cache_size = .*/effective_cache_size = 1GB/" "$PG_CONF" || \
echo "effective_cache_size = 1GB" | sudo tee -a "$PG_CONF"

sudo sed -i "s/^#wal_level = .*/wal_level = replica/" "$PG_CONF" || \
sudo sed -i "s/^wal_level = .*/wal_level = replica/" "$PG_CONF" || \
echo "wal_level = replica" | sudo tee -a "$PG_CONF"

sudo sed -i "s/^#checkpoint_timeout = .*/checkpoint_timeout = 15min/" "$PG_CONF" || \
sudo sed -i "s/^checkpoint_timeout = .*/checkpoint_timeout = 15min/" "$PG_CONF" || \
echo "checkpoint_timeout = 15min" | sudo tee -a "$PG_CONF"

sudo sed -i "s/^#max_wal_size = .*/max_wal_size = 1GB/" "$PG_CONF" || \
sudo sed -i "s/^max_wal_size = .*/max_wal_size = 1GB/" "$PG_CONF" || \
echo "max_wal_size = 1GB" | sudo tee -a "$PG_CONF"

sudo sed -i "s/^#wal_compression = .*/wal_compression = on/" "$PG_CONF" || \
sudo sed -i "s/^wal_compression = .*/wal_compression = on/" "$PG_CONF" || \
echo "wal_compression = on" | sudo tee -a "$PG_CONF"

echo "✅ 配置已更新"
echo "🔄 重启 PostgreSQL..."
sudo systemctl restart postgresql

echo "⏳ 等待 PostgreSQL 启动..."
sleep 5

# 验证配置
echo "🔍 验证配置..."
if command -v psql >/dev/null 2>&1; then
    psql -U postgres -c "SHOW shared_buffers;" 2>/dev/null || echo "⚠️  无法验证配置，请手动检查"
else
    echo "⚠️  psql 命令未找到，请手动验证配置"
    echo "   可以使用: sudo systemctl status postgresql"
fi

echo "✅ PostgreSQL 优化完成！"
echo ""
echo "📋 下一步："
echo "1. 安装并配置 PgBouncer（参考 PERFORMANCE_OPTIMIZATION.md）"
echo "2. 更新应用环境变量（USE_PGBOUNCER=true）"
echo "3. 重启应用服务"

