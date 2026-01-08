#!/bin/bash
# 清理孤立数据脚本：清理已注销用户但数据未完全删除的情况

set -e

PROJECT_DIR="/www/wwwroot/piccco3/backend"
EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  echo "用法: $0 <邮箱地址>"
  echo "示例: $0 zq13371@gmail.com"
  exit 1
fi

# 从 .env 文件读取数据库配置
if [ -f "$PROJECT_DIR/.env" ]; then
  export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

# 默认值
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-piccco}
DB_USER=${DB_USER:-piccco_user}
DB_PASSWORD=${DB_PASSWORD:-}

if [ -z "$DB_PASSWORD" ]; then
  echo "错误：未设置 DB_PASSWORD 环境变量"
  echo "请设置：export DB_PASSWORD='your_password'"
  exit 1
fi

# 规范化邮箱（转小写）
NORMALIZED_EMAIL=$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | tr -d ' ')

echo "=========================================="
echo "清理孤立数据"
echo "邮箱: $EMAIL"
echo "规范化后: $NORMALIZED_EMAIL"
echo "=========================================="
echo ""

# 查找用户
echo "1. 查找用户..."
USER_ID=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM users WHERE email = '$NORMALIZED_EMAIL';" 2>/dev/null | tr -d ' ' || echo "")

if [ -n "$USER_ID" ]; then
  echo "   ✅ 找到用户: ID=$USER_ID"
  echo ""
  echo "   警告：用户仍然存在，这不是孤立数据！"
  echo "   如果要删除用户，请使用账户注销功能，而不是此脚本。"
  exit 1
else
  echo "   ⚠️  用户不存在，继续检查是否有孤立数据..."
fi

echo ""
echo "2. 检查孤立数据..."

# 检查是否有数据关联到该邮箱（通过邮箱查找可能的 userId）
# 注意：如果用户已删除，我们无法通过邮箱找到 userId
# 所以我们需要通过其他方式查找，或者让用户提供 userId

# 先尝试通过邮箱的哈希或其他方式查找
# 但更简单的方法是：让用户提供 userId，或者清理所有可能的孤立数据

echo ""
echo "   由于用户已删除，无法直接通过邮箱查找 userId。"
echo "   请选择清理方式："
echo ""
echo "   选项 1: 清理所有可能的孤立数据（危险，会清理所有没有对应用户的数据）"
echo "   选项 2: 提供 userId 来清理特定用户的数据"
echo ""
read -p "   请选择 (1/2): " CHOICE

if [ "$CHOICE" = "1" ]; then
  echo ""
  echo "   ⚠️  警告：这将清理所有孤立数据！"
  read -p "   确认继续？(yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "   已取消"
    exit 0
  fi
  
  echo ""
  echo "3. 清理所有孤立数据..."
  
  # 查找所有没有对应用户的 folders
  ORPHANED_FOLDERS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM folders f WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id);" 2>/dev/null | tr -d ' ' || echo "0")
  echo "   找到 $ORPHANED_FOLDERS 个孤立文件夹"
  
  # 查找所有没有对应用户的 notes
  ORPHANED_NOTES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM notes n WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = n.user_id);" 2>/dev/null | tr -d ' ' || echo "0")
  echo "   找到 $ORPHANED_NOTES 个孤立笔记"
  
  # 查找所有没有对应用户的 urls
  ORPHANED_URLS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM urls u WHERE NOT EXISTS (SELECT 1 FROM users us WHERE us.id = u.user_id);" 2>/dev/null | tr -d ' ' || echo "0")
  echo "   找到 $ORPHANED_URLS 个孤立网址"
  
  # 查找所有没有对应用户的 settings
  ORPHANED_SETTINGS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM user_settings us WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = us.user_id);" 2>/dev/null | tr -d ' ' || echo "0")
  echo "   找到 $ORPHANED_SETTINGS 个孤立设置"
  
  if [ "$ORPHANED_FOLDERS" = "0" ] && [ "$ORPHANED_NOTES" = "0" ] && [ "$ORPHANED_URLS" = "0" ] && [ "$ORPHANED_SETTINGS" = "0" ]; then
    echo ""
    echo "   ✅ 没有找到孤立数据"
    exit 0
  fi
  
  echo ""
  read -p "   确认删除这些孤立数据？(yes/no): " CONFIRM_DELETE
  if [ "$CONFIRM_DELETE" != "yes" ]; then
    echo "   已取消"
    exit 0
  fi
  
  # 删除孤立数据（按顺序删除，避免外键约束问题）
  echo ""
  echo "4. 删除孤立数据..."
  
  # 删除孤立的 notes
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM notes WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = notes.user_id);" 2>/dev/null
  echo "   ✅ 已删除孤立笔记"
  
  # 删除孤立的 urls
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM urls WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = urls.user_id);" 2>/dev/null
  echo "   ✅ 已删除孤立网址"
  
  # 删除孤立的 folders
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM folders WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = folders.user_id);" 2>/dev/null
  echo "   ✅ 已删除孤立文件夹"
  
  # 删除孤立的 settings
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM user_settings WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = user_settings.user_id);" 2>/dev/null
  echo "   ✅ 已删除孤立设置"
  
  echo ""
  echo "=========================================="
  echo "✅ 清理完成"
  echo "=========================================="
  
elif [ "$CHOICE" = "2" ]; then
  echo ""
  read -p "   请输入 userId: " USER_ID_INPUT
  
  if [ -z "$USER_ID_INPUT" ]; then
    echo "   错误：userId 不能为空"
    exit 1
  fi
  
  echo ""
  echo "3. 清理用户数据 (userId=$USER_ID_INPUT)..."
  
  # 检查用户是否存在
  USER_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE id = '$USER_ID_INPUT';" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ "$USER_EXISTS" != "0" ]; then
    echo "   ⚠️  警告：用户仍然存在！"
    echo "   如果要删除用户，请使用账户注销功能，而不是此脚本。"
    exit 1
  fi
  
  # 统计数据
  FOLDERS_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM folders WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null | tr -d ' ' || echo "0")
  NOTES_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM notes WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null | tr -d ' ' || echo "0")
  URLS_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM urls WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null | tr -d ' ' || echo "0")
  SETTINGS_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM user_settings WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null | tr -d ' ' || echo "0")
  
  echo "   找到数据："
  echo "   - 文件夹: $FOLDERS_COUNT"
  echo "   - 笔记: $NOTES_COUNT"
  echo "   - 网址: $URLS_COUNT"
  echo "   - 设置: $SETTINGS_COUNT"
  
  if [ "$FOLDERS_COUNT" = "0" ] && [ "$NOTES_COUNT" = "0" ] && [ "$URLS_COUNT" = "0" ] && [ "$SETTINGS_COUNT" = "0" ]; then
    echo ""
    echo "   ✅ 没有找到数据"
    exit 0
  fi
  
  echo ""
  read -p "   确认删除这些数据？(yes/no): " CONFIRM_DELETE
  if [ "$CONFIRM_DELETE" != "yes" ]; then
    echo "   已取消"
    exit 0
  fi
  
  # 删除数据（按顺序删除，避免外键约束问题）
  echo ""
  echo "4. 删除数据..."
  
  # 删除 notes
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM notes WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null
  echo "   ✅ 已删除笔记"
  
  # 删除 urls
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM urls WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null
  echo "   ✅ 已删除网址"
  
  # 删除 folders
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM folders WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null
  echo "   ✅ 已删除文件夹"
  
  # 删除 settings
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM user_settings WHERE user_id = '$USER_ID_INPUT';" 2>/dev/null
  echo "   ✅ 已删除设置"
  
  echo ""
  echo "=========================================="
  echo "✅ 清理完成"
  echo "=========================================="
else
  echo "   无效的选择"
  exit 1
fi

