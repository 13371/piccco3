-- 数据库索引优化脚本
-- 添加缺失的索引，优化查询性能
-- 如果索引已存在，会自动忽略（使用 IF NOT EXISTS）

-- ============================================
-- 1. users 表索引优化
-- ============================================

-- email 唯一索引（已存在，但确保存在）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- created_at 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- status 索引（使用 is_banned 字段，因为表结构中使用 is_banned 而不是 status）
CREATE INDEX IF NOT EXISTS idx_users_status ON users(is_banned);

-- ============================================
-- 2. notes 表索引优化
-- ============================================

-- user_id 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

-- updated_at 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);

-- is_deleted 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);

-- 组合索引：user_id + is_deleted（关键索引，避免全表扫描）
CREATE INDEX IF NOT EXISTS idx_notes_user_id_deleted ON notes(user_id, is_deleted);

-- 组合索引：user_id + updated_at（优化排序查询）
CREATE INDEX IF NOT EXISTS idx_notes_user_id_updated_at ON notes(user_id, updated_at DESC);

-- ============================================
-- 3. folders 表索引优化
-- ============================================

-- user_id 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- 组合索引：user_id + is_deleted（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_folders_user_id_deleted ON folders(user_id, is_deleted);

-- updated_at 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_folders_updated_at ON folders(updated_at);

-- ============================================
-- 4. logs 表索引优化
-- ============================================

-- created_at 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(timestamp DESC);

-- level 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

-- 注意：logs 表当前没有 user_id 字段，如果需要按用户查询，需要先添加字段

-- ============================================
-- 5. messages 表索引优化
-- ============================================

-- user_id 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- 组合索引：user_id + created_at（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_messages_user_id_created_at ON messages(user_id, created_at DESC);

-- is_read 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- 组合索引：user_id + is_read（优化"查询未读消息"）
CREATE INDEX IF NOT EXISTS idx_messages_user_id_read ON messages(user_id, is_read) WHERE is_read = false;

-- ============================================
-- 6. urls 表索引优化
-- ============================================

-- user_id 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);

-- 组合索引：user_id + is_deleted（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_urls_user_id_deleted ON urls(user_id, is_deleted);

-- updated_at 索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_urls_updated_at ON urls(updated_at);

-- ============================================
-- 索引优化说明
-- ============================================
-- 1. 所有查询必须使用索引，避免全表扫描
-- 2. 组合索引顺序很重要：WHERE 条件在前，ORDER BY 在后
-- 3. 部分索引（WHERE 子句）可以进一步优化性能
-- 4. 定期执行 ANALYZE 更新统计信息



