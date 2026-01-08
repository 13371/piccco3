#!/bin/bash
# 部署验证脚本

echo "=========================================="
echo "piccco 部署验证"
echo "=========================================="

# 1. 检查 PM2 服务状态
echo "1. 检查 PM2 服务状态..."
pm2 status

echo ""

# 2. 检查服务日志（最近20行）
echo "2. 检查服务日志（最近20行）..."
pm2 logs piccco-backend --lines 20 --nostream

echo ""

# 3. 检查端口监听
echo "3. 检查端口 4000 监听状态..."
if netstat -tlnp 2>/dev/null | grep -q ":4000"; then
    echo "✅ 端口 4000 正在监听"
    netstat -tlnp | grep ":4000"
else
    echo "❌ 端口 4000 未监听"
fi

echo ""

# 4. 检查健康状态
echo "4. 检查 API 健康状态..."
HEALTH_RESPONSE=$(curl -s http://localhost:4000/api/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ API 健康检查成功"
    echo "$HEALTH_RESPONSE" | head -20
else
    echo "❌ API 健康检查失败"
fi

echo ""

# 5. 检查存储模式
echo "5. 检查存储模式配置..."
if [ -f ".env" ]; then
    STORAGE_MODE=$(grep "^STORAGE_MODE=" .env | cut -d'=' -f2)
    if [ "$STORAGE_MODE" = "db" ]; then
        echo "✅ 存储模式: 数据库 (db)"
    else
        echo "⚠️  存储模式: $STORAGE_MODE (建议使用 db)"
    fi
else
    echo "❌ .env 文件不存在"
fi

echo ""

# 6. 检查数据库连接
echo "6. 检查数据库连接..."
DB_STATUS=$(curl -s http://localhost:4000/api/health 2>/dev/null | grep -o '"database":{[^}]*}' | grep -o '"connected":[^,]*' | cut -d':' -f2)
if [ "$DB_STATUS" = "true" ]; then
    echo "✅ 数据库连接正常"
else
    echo "⚠️  数据库连接状态: $DB_STATUS"
fi

echo ""

# 7. 检查环境变量
echo "7. 检查关键环境变量..."
if [ -f ".env" ]; then
    echo "   STORAGE_MODE: $(grep "^STORAGE_MODE=" .env | cut -d'=' -f2 || echo '未设置')"
    echo "   DB_HOST: $(grep "^DB_HOST=" .env | cut -d'=' -f2 || echo '未设置')"
    echo "   DB_NAME: $(grep "^DB_NAME=" .env | cut -d'=' -f2 || echo '未设置')"
    echo "   NODE_ENV: $(grep "^NODE_ENV=" .env | cut -d'=' -f2 || echo '未设置')"
else
    echo "   ❌ .env 文件不存在"
fi

echo ""

echo "=========================================="
echo "验证完成"
echo "=========================================="


























