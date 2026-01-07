-- 添加首页内容字段到 user_settings 表
-- 迁移脚本：006_add_home_content_column.sql

-- 添加 home_content 字段到 user_settings 表
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS home_content TEXT DEFAULT '';

-- 添加注释
COMMENT ON COLUMN user_settings.home_content IS '首页大白框内容';

