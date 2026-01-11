#!/bin/bash
# 运行迁移脚本 004：添加 version 字段

set -e

echo "开始执行迁移 004：添加 version 字段..."

# 从环境变量或 .env 文件读取数据库配置
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 默认值
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-piccco}
DB_USER=${DB_USER:-postgres}

# 如果设置了 POSTGRES_PASSWORD，使用它
if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD="$POSTGRES_PASSWORD"
elif [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD="$DB_PASSWORD"
else
    echo "错误：未设置 POSTGRES_PASSWORD 或 DB_PASSWORD 环境变量"
    echo "请设置：export PGPASSWORD='your_postgres_password'"
    exit 1
fi

echo "连接到数据库: $DB_HOST:$DB_PORT/$DB_NAME (用户: $DB_USER)"

# 执行 SQL
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- 添加 version 字段到 notes、folders、urls 表
ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE urls 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 添加注释
COMMENT ON COLUMN folders.version IS '版本号，用于冲突检测';
COMMENT ON COLUMN notes.version IS '版本号，用于冲突检测';
COMMENT ON COLUMN urls.version IS '版本号，用于冲突检测';
EOF

echo "迁移完成！"









