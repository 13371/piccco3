#!/bin/bash
# 简单的数据库迁移脚本

cd /www/wwwroot/piccco3/backend

# 读取 .env 文件中的数据库配置
if [ -f .env ]; then
    DB_HOST=$(grep "^DB_HOST=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_PORT=$(grep "^DB_PORT=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
fi

# 设置默认值
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-piccco}
DB_USER=${DB_USER:-postgres}

echo "=========================================="
echo "执行数据库迁移：添加永久删除字段"
echo "=========================================="
echo ""
echo "数据库配置:"
echo "  DB_HOST: $DB_HOST"
echo "  DB_PORT: $DB_PORT"
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo ""

# 检查 psql 是否可用
if ! command -v psql &> /dev/null; then
    echo "❌ 错误: psql 命令未找到"
    echo "   请先安装 PostgreSQL 客户端: apt install postgresql-client"
    exit 1
fi

# 设置密码环境变量
if [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

# 检查字段是否已存在
echo "1. 检查字段是否已存在..."
EXISTING_COLUMNS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'user_settings' 
    AND column_name IN ('permanently_deleted_note_ids', 'permanently_deleted_url_ids');
" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ 数据库连接失败"
    echo "$EXISTING_COLUMNS"
    echo ""
    echo "提示："
    echo "  1. 检查数据库是否运行: systemctl status postgresql"
    echo "  2. 检查 .env 文件中的数据库配置"
    echo "  3. 如果使用 postgres 用户，可能需要密码"
    exit 1
fi

# 检查字段
HAS_NOTE_ID=$(echo "$EXISTING_COLUMNS" | grep -c "permanently_deleted_note_ids" || echo "0")
HAS_URL_ID=$(echo "$EXISTING_COLUMNS" | grep -c "permanently_deleted_url_ids" || echo "0")

if [ "$HAS_NOTE_ID" -gt 0 ] && [ "$HAS_URL_ID" -gt 0 ]; then
    echo "✅ 字段已存在，跳过迁移"
    exit 0
fi

# 添加字段
echo "2. 添加永久删除字段..."

if [ "$HAS_NOTE_ID" -eq 0 ]; then
    echo "   添加 permanently_deleted_note_ids 字段..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        ALTER TABLE user_settings 
        ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];
    " 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ permanently_deleted_note_ids 字段已添加"
    else
        echo "   ❌ 添加字段失败，可能需要 postgres 超级用户权限"
        echo "   请尝试使用 postgres 用户执行:"
        echo "   psql -h $DB_HOST -p $DB_PORT -U postgres -d $DB_NAME -c \"ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];\""
        exit 1
    fi
else
    echo "   ⏭️  permanently_deleted_note_ids 字段已存在"
fi

if [ "$HAS_URL_ID" -eq 0 ]; then
    echo "   添加 permanently_deleted_url_ids 字段..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        ALTER TABLE user_settings 
        ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];
    " 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ permanently_deleted_url_ids 字段已添加"
    else
        echo "   ❌ 添加字段失败，可能需要 postgres 超级用户权限"
        echo "   请尝试使用 postgres 用户执行:"
        echo "   psql -h $DB_HOST -p $DB_PORT -U postgres -d $DB_NAME -c \"ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];\""
        exit 1
    fi
else
    echo "   ⏭️  permanently_deleted_url_ids 字段已存在"
fi

# 添加注释
echo "3. 添加字段注释..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    COMMENT ON COLUMN user_settings.permanently_deleted_note_ids IS '永久删除的笔记ID列表';
    COMMENT ON COLUMN user_settings.permanently_deleted_url_ids IS '永久删除的网址ID列表';
" 2>&1

if [ $? -eq 0 ]; then
    echo "   ✅ 字段注释已添加"
else
    echo "   ⚠️  添加注释失败（不影响功能）"
fi

echo ""
echo "=========================================="
echo "✅ 数据库迁移完成！"
echo "=========================================="









