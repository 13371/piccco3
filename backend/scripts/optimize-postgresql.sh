#!/bin/bash
# PostgreSQL 性能优化脚本
# 适用于 Ubuntu/Debian 系统

set -e

echo "🚀 开始优化 PostgreSQL 配置..."

# 检测 PostgreSQL 版本
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_MAJOR_VERSION=$(echo $PG_VERSION | cut -d. -f1)

echo "📋 检测到 PostgreSQL 版本: $PG_VERSION"

# 配置文件路径
PG_CONF="/etc/postgresql/${PG_MAJOR_VERSION}/main/postgresql.conf"

if [ ! -f "$PG_CONF" ]; then
    echo "❌ 未找到 PostgreSQL 配置文件: $PG_CONF"
    exit 1
fi

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
psql -U postgres -c "SHOW shared_buffers;" || echo "⚠️  无法验证配置，请手动检查"

echo "✅ PostgreSQL 优化完成！"
echo ""
echo "📋 下一步："
echo "1. 安装并配置 PgBouncer（参考 PERFORMANCE_OPTIMIZATION.md）"
echo "2. 更新应用环境变量（USE_PGBOUNCER=true）"
echo "3. 重启应用服务"

