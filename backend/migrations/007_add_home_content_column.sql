-- 添加 home_content 列到 user_settings 表
-- 用于存储首页大白框内容

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS home_content TEXT DEFAULT '';

COMMENT ON COLUMN user_settings.home_content IS '首页大白框内容';

