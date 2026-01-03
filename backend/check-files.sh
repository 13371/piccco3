#!/bin/bash
# 快速检查文件脚本

cd /www/wwwroot/piccco3/backend

echo "=========================================="
echo "检查数据库迁移相关文件"
echo "=========================================="
echo ""

echo "=== 1. 检查目录结构 ==="
echo "src/ 目录:"
ls -la src/ 2>&1 | head -10
echo ""

echo "src/db/ 目录:"
ls -la src/db/ 2>&1 | head -10
echo ""

echo "=== 2. 检查关键文件 ==="
files=(
  "src/db/config.js"
  "src/db/migrations.js"
  "src/db/dao/userDao.js"
  "src/db/dao/userDataDao.js"
  "src/db/dao/messageDao.js"
  "src/db/dao/messageHistoryDao.js"
  "src/store/storageAdapter.js"
  "migrations/001_create_schema.sql"
  "package.json"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file 存在"
  else
    echo "❌ $file 不存在"
  fi
done
echo ""

echo "=== 3. 检查依赖 ==="
if [ -d "node_modules/pg" ]; then
  echo "✅ pg 包已安装"
  npm list pg 2>&1 | head -3
else
  echo "❌ pg 包未安装"
  echo "   请运行: npm install"
fi
echo ""

echo "=== 4. 检查 .env 配置 ==="
if [ -f ".env" ]; then
  echo "✅ .env 文件存在"
  if grep -q "DB_HOST" .env; then
    echo "✅ 数据库配置已设置"
  else
    echo "❌ 数据库配置未设置"
  fi
else
  echo "❌ .env 文件不存在"
fi
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="






