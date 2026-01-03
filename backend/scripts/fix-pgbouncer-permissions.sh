#!/bin/bash

# 修复 PgBouncer 权限问题
# 使用方法：bash scripts/fix-pgbouncer-permissions.sh

set -e

echo "🔧 修复 PgBouncer 权限..."
echo ""

# 检查 pgbouncer 用户是否存在
if id "pgbouncer" &>/dev/null; then
    PGBOUNCER_USER="pgbouncer"
    PGBOUNCER_GROUP="pgbouncer"
    echo "✅ 找到 pgbouncer 用户"
else
    PGBOUNCER_USER="postgres"
    PGBOUNCER_GROUP="postgres"
    echo "⚠️  pgbouncer 用户不存在，使用 postgres 用户"
fi

# 创建并设置日志目录权限
echo "1. 设置日志目录权限..."
sudo mkdir -p /var/log/pgbouncer
sudo chown -R "$PGBOUNCER_USER:$PGBOUNCER_GROUP" /var/log/pgbouncer
sudo chmod 755 /var/log/pgbouncer
echo "✅ 日志目录权限已设置"

# 创建并设置运行目录权限
echo ""
echo "2. 设置运行目录权限..."
sudo mkdir -p /var/run/pgbouncer
sudo chown -R "$PGBOUNCER_USER:$PGBOUNCER_GROUP" /var/run/pgbouncer
sudo chmod 755 /var/run/pgbouncer
echo "✅ 运行目录权限已设置"

# 设置配置文件权限
echo ""
echo "3. 设置配置文件权限..."
if [ -f "/etc/pgbouncer/pgbouncer.ini" ]; then
    sudo chown "$PGBOUNCER_USER:$PGBOUNCER_GROUP" /etc/pgbouncer/pgbouncer.ini
    sudo chmod 640 /etc/pgbouncer/pgbouncer.ini
    echo "✅ 配置文件权限已设置"
fi

# 设置用户认证文件权限
echo ""
echo "4. 设置用户认证文件权限..."
if [ -f "/etc/pgbouncer/userlist.txt" ]; then
    sudo chown "$PGBOUNCER_USER:$PGBOUNCER_GROUP" /etc/pgbouncer/userlist.txt
    sudo chmod 640 /etc/pgbouncer/userlist.txt
    echo "✅ 用户认证文件权限已设置"
fi

# 验证权限
echo ""
echo "5. 验证权限..."
echo "日志目录："
ls -ld /var/log/pgbouncer
echo ""
echo "运行目录："
ls -ld /var/run/pgbouncer
echo ""
echo "配置文件："
ls -l /etc/pgbouncer/pgbouncer.ini
echo ""
echo "用户认证文件："
ls -l /etc/pgbouncer/userlist.txt

# 重启 PgBouncer
echo ""
echo "6. 重启 PgBouncer..."
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl restart pgbouncer
    sleep 2
    
    if systemctl is-active --quiet pgbouncer; then
        echo "✅ PgBouncer 启动成功"
        echo ""
        sudo systemctl status pgbouncer --no-pager | head -10
    else
        echo "❌ PgBouncer 启动失败"
        echo ""
        echo "查看详细日志："
        sudo journalctl -u pgbouncer -n 20 --no-pager
        exit 1
    fi
else
    echo "⚠️  systemctl 不可用，请手动启动"
fi

echo ""
echo "✅ 权限修复完成！"



