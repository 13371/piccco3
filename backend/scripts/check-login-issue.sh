#!/bin/bash
# 检查登录问题：查看邮箱格式和用户是否存在

set -e

PROJECT_DIR="/www/wwwroot/piccco3/backend"
EMAIL="${1:-zq13371@gmail.com}"

echo "=========================================="
echo "检查登录问题"
echo "邮箱: $EMAIL"
echo "=========================================="

cd "$PROJECT_DIR"

# 规范化邮箱（与代码逻辑一致）
NORMALIZED_EMAIL=$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | tr -d ' ')

echo ""
echo "1. 邮箱规范化结果:"
echo "   原始: $EMAIL"
echo "   规范化后: $NORMALIZED_EMAIL"

echo ""
echo "2. 检查数据库中是否存在用户（使用原始邮箱）:"
PGPASSWORD="${DB_PASSWORD:-}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-piccco_user}" -d "${DB_NAME:-piccco}" -c "SELECT id, email, username, created_at FROM users WHERE email = '$EMAIL';" 2>/dev/null || echo "   查询失败（可能需要设置数据库环境变量）"

echo ""
echo "3. 检查数据库中是否存在用户（使用规范化邮箱）:"
PGPASSWORD="${DB_PASSWORD:-}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-piccco_user}" -d "${DB_NAME:-piccco}" -c "SELECT id, email, username, created_at FROM users WHERE email = '$NORMALIZED_EMAIL';" 2>/dev/null || echo "   查询失败（可能需要设置数据库环境变量）"

echo ""
echo "4. 检查后端代码是否包含 normalizeEmail:"
if grep -q "normalizeEmail(email)" src/routes/auth.js; then
    echo "   ✅ 登录代码已包含邮箱规范化"
else
    echo "   ❌ 登录代码未包含邮箱规范化（需要部署）"
fi

echo ""
echo "=========================================="
echo "提示："
echo "1. 如果代码未包含 normalizeEmail，请执行: bash scripts/deploy-backend.sh"
echo "2. 如果邮箱格式不一致，可能需要统一数据库中的邮箱格式"
echo "=========================================="
