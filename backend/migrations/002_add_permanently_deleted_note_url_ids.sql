-- 添加永久删除的笔记和网址ID字段
-- 迁移脚本：002_add_permanently_deleted_note_url_ids.sql

-- 添加 permanently_deleted_note_ids 字段
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_note_ids TEXT[];

-- 添加 permanently_deleted_url_ids 字段
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS permanently_deleted_url_ids TEXT[];

-- 添加注释
COMMENT ON COLUMN user_settings.permanently_deleted_note_ids IS '永久删除的笔记ID列表';
COMMENT ON COLUMN user_settings.permanently_deleted_url_ids IS '永久删除的网址ID列表';








