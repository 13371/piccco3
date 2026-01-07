-- 添加文件夹密码字段（用于隐私文件夹）
-- 迁移脚本：005_add_folder_password_column.sql

-- 添加 password 字段到 folders 表
ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS password TEXT;

-- 添加注释
COMMENT ON COLUMN folders.password IS '隐私文件夹密码（加密存储）';

