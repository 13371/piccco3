#!/bin/bash

# 完整数据库优化脚本
# 功能：
# 1. 应用数据库索引
# 2. 运行 VACUUM ANALYZE
# 3. 验证查询计划
# 4. 安装和配置 PgBouncer（可选）
# 使用方法：bash scripts/complete-optimization.sh [--with-pgbouncer]

set -e

echo "🚀 开始完整数据库优化..."
echo ""

# 获取项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 检查参数
INSTALL_PGBOUNCER=false
if [ "$1" = "--with-pgbouncer" ]; then
    INSTALL_PGBOUNCER=true
fi

# 1. 应用索引优化
echo "1️⃣ 应用数据库索引优化..."
if [ -f "$PROJECT_DIR/scripts/apply-indexes.sh" ]; then
    bash "$PROJECT_DIR/scripts/apply-indexes.sh"
else
    echo "⚠️  未找到 apply-indexes.sh 脚本"
fi
echo ""

# 2. 运行 VACUUM ANALYZE
echo "2️⃣ 运行 VACUUM ANALYZE（更新统计信息）..."
if [ -f "$PROJECT_DIR/scripts/vacuum-analyze.sh" ]; then
    bash "$PROJECT_DIR/scripts/vacuum-analyze.sh"
else
    echo "⚠️  未找到 vacuum-analyze.sh 脚本"
fi
echo ""

# 3. 验证查询计划
echo "3️⃣ 验证查询计划（确保使用索引）..."
if [ -f "$PROJECT_DIR/scripts/verify-query-plans-simple.sh" ]; then
    bash "$PROJECT_DIR/scripts/verify-query-plans-simple.sh"
else
    echo "⚠️  未找到 verify-query-plans-simple.sh 脚本"
fi
echo ""

# 4. 安装 PgBouncer（可选）
if [ "$INSTALL_PGBOUNCER" = true ]; then
    echo "4️⃣ 安装和配置 PgBouncer..."
    if [ -f "$PROJECT_DIR/scripts/install-pgbouncer.sh" ]; then
        bash "$PROJECT_DIR/scripts/install-pgbouncer.sh"
        echo ""
        echo "⚠️  重要：安装 PgBouncer 后，请："
        echo "   1. 更新 .env 文件：添加 USE_PGBOUNCER=true 和 DB_PORT=6432"
        echo "   2. 重启应用：pm2 restart piccco-backend --update-env"
    else
        echo "⚠️  未找到 install-pgbouncer.sh 脚本"
    fi
else
    echo "4️⃣ 跳过 PgBouncer 安装（使用 --with-pgbouncer 参数可安装）"
fi
echo ""

echo "✅ 数据库优化完成！"
echo ""
echo "📊 优化总结："
echo "   ✅ 数据库索引已创建"
echo "   ✅ 统计信息已更新"
echo "   ✅ 查询计划已验证"
if [ "$INSTALL_PGBOUNCER" = true ]; then
    echo "   ✅ PgBouncer 已安装（需要手动配置应用）"
else
    echo "   ⏭️  PgBouncer 未安装（可选）"
fi
echo ""
echo "📝 下一步："
echo "   1. 检查应用健康状态：curl http://localhost:3000/api/health"
echo "   2. 监控数据库性能：查看慢查询日志"
echo "   3. 如需安装 PgBouncer：bash scripts/complete-optimization.sh --with-pgbouncer"
echo ""

