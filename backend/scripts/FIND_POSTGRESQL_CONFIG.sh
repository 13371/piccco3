#!/bin/bash
# 快速查找 PostgreSQL 配置文件的脚本

echo "🔍 正在查找 PostgreSQL 配置文件..."
echo ""

# 方法1: 通过 systemctl 查找
echo "方法1: 通过 systemctl 查找..."
if command -v systemctl >/dev/null 2>&1; then
    PG_SERVICE=$(systemctl list-units --type=service 2>/dev/null | grep -i postgresql | head -1 | awk '{print $1}')
    if [ -n "$PG_SERVICE" ]; then
        echo "  找到服务: $PG_SERVICE"
        PG_VERSION=$(echo "$PG_SERVICE" | grep -oE '[0-9]+' | head -1)
        if [ -n "$PG_VERSION" ]; then
            PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
            if [ -f "$PG_CONF" ]; then
                echo "  ✅ 找到配置文件: $PG_CONF"
                echo "$PG_CONF"
                exit 0
            fi
        fi
    fi
fi

# 方法2: 搜索常见位置
echo ""
echo "方法2: 搜索常见位置..."
for possible_conf in \
    /etc/postgresql/*/main/postgresql.conf \
    /var/lib/pgsql/*/data/postgresql.conf \
    /usr/local/pgsql/data/postgresql.conf \
    /www/server/pgsql/data/postgresql.conf; do
    if [ -f "$possible_conf" ]; then
        echo "  ✅ 找到配置文件: $possible_conf"
        echo "$possible_conf"
        exit 0
    fi
done

# 方法3: 使用 find 命令
echo ""
echo "方法3: 使用 find 命令搜索..."
PG_CONF=$(sudo find /etc /var /www -name postgresql.conf 2>/dev/null | head -1)
if [ -n "$PG_CONF" ] && [ -f "$PG_CONF" ]; then
    echo "  ✅ 找到配置文件: $PG_CONF"
    echo "$PG_CONF"
    exit 0
fi

# 方法4: 检查宝塔面板位置
echo ""
echo "方法4: 检查宝塔面板位置..."
if [ -d "/www/server/pgsql" ]; then
    PG_CONF=$(find /www/server/pgsql -name postgresql.conf 2>/dev/null | head -1)
    if [ -n "$PG_CONF" ] && [ -f "$PG_CONF" ]; then
        echo "  ✅ 找到配置文件: $PG_CONF"
        echo "$PG_CONF"
        exit 0
    fi
fi

echo ""
echo "❌ 未找到 PostgreSQL 配置文件"
echo ""
echo "请尝试以下命令手动查找："
echo "  sudo find /etc -name postgresql.conf"
echo "  sudo find /var -name postgresql.conf"
echo "  sudo find /www -name postgresql.conf"
echo ""
echo "或者检查 PostgreSQL 服务："
echo "  sudo systemctl status postgresql"
echo "  sudo systemctl list-units --type=service | grep postgresql"

exit 1

