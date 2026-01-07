-- 添加 version 字段到 notes、folders、urls 表
-- 用于版本控制和冲突检测

-- 1. 为 folders 表添加 version 字段
ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 2. 为 notes 表添加 version 字段
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 3. 为 urls 表添加 version 字段
ALTER TABLE urls 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 4. 添加注释
COMMENT ON COLUMN folders.version IS '版本号，用于冲突检测';
COMMENT ON COLUMN notes.version IS '版本号，用于冲突检测';
COMMENT ON COLUMN urls.version IS '版本号，用于冲突检测';


