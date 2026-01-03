#!/bin/bash

# 宝塔面板 PostgreSQL 重启脚本
# 使用方法：bash scripts/restart-postgresql-bt.sh

echo "🔄 尝试重启 PostgreSQL..."
echo ""

# 方法 1: 使用宝塔面板的服务管理
if [ -f "/etc/init.d/pgsql" ]; then
    echo "✅ 找到服务脚本: /etc/init.d/pgsql"
    /etc/init.d/pgsql restart
    exit $?
fi

# 方法 2: 使用 systemctl
if systemctl list-units | grep -q "postgresql"; then
    echo "✅ 使用 systemctl 重启 postgresql"
    sudo systemctl restart postgresql
    exit $?
fi

if systemctl list-units | grep -q "pgsql"; then
    echo "✅ 使用 systemctl 重启 pgsql"
    sudo systemctl restart pgsql
    exit $?
fi

# 方法 3: 使用宝塔面板的 bt 命令
if command -v bt >/dev/null 2>&1; then
    echo "✅ 使用宝塔面板 bt 命令重启"
    bt restart pgsql
    exit $?
fi

# 方法 4: 使用 pg_ctl（如果知道数据目录）
PGSQL_DATA_DIR="/www/server/pgsql/data"
PGSQL_BIN="/www/server/pgsql/bin/pg_ctl"

if [ -f "$PGSQL_BIN" ] && [ -d "$PGSQL_DATA_DIR" ]; then
    echo "✅ 使用 pg_ctl 重启"
    $PGSQL_BIN restart -D "$PGSQL_DATA_DIR" -l /www/server/pgsql/logs/postgresql.log
    exit $?
fi

# 如果都失败了
echo "❌ 无法找到 PostgreSQL 服务"
echo ""
echo "请手动在宝塔面板中重启："
echo "   1. 打开宝塔面板"
echo "   2. 点击左侧菜单「数据库」"
echo "   3. 找到 PostgreSQL，点击「重启」按钮"
echo ""
echo "或者尝试以下命令："
echo "   /etc/init.d/pgsql restart"
echo "   systemctl restart postgresql"
echo "   systemctl restart pgsql"
echo "   bt restart pgsql"

exit 1


