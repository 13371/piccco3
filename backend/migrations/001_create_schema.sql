-- PostgreSQL 数据库迁移脚本
-- 创建所有必要的表和索引

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar TEXT,
    is_banned BOOLEAN DEFAULT FALSE,
    banned_at TIMESTAMP,
    ban_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- 2. 文件夹表
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'normal',
    color VARCHAR(50),
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id_deleted ON folders(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_folders_updated_at ON folders(updated_at);

-- 3. 笔记表
CREATE TABLE IF NOT EXISTS notes (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    folder_id VARCHAR(255),
    title VARCHAR(255),
    content TEXT,
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, folder_id) REFERENCES folders(user_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id_deleted ON notes(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);

-- 4. URL表
CREATE TABLE IF NOT EXISTS urls (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    folder_id VARCHAR(255),
    title VARCHAR(255),
    url TEXT NOT NULL,
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, folder_id) REFERENCES folders(user_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);
CREATE INDEX IF NOT EXISTS idx_urls_folder_id ON urls(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_urls_user_id_deleted ON urls(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_urls_updated_at ON urls(updated_at);

-- 5. 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    user_id VARCHAR(255) PRIMARY KEY,
    sort_mode VARCHAR(50) DEFAULT 'updatedAt',
    font_size VARCHAR(50) DEFAULT 'medium',
    language VARCHAR(10) DEFAULT 'zh',
    night_mode VARCHAR(50) DEFAULT 'auto',
    last_sync_at BIGINT,
    permanently_deleted_folder_ids TEXT[], -- PostgreSQL数组类型
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. 消息表
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id_created_at ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- 7. 消息历史表
CREATE TABLE IF NOT EXISTS message_history (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'single',
    user_count INTEGER,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_history_user_id ON message_history(user_id);
CREATE INDEX IF NOT EXISTS idx_message_history_type ON message_history(type);
CREATE INDEX IF NOT EXISTS idx_message_history_created_at ON message_history(created_at DESC);

-- 8. 验证码表（可选，用于持久化验证码）
CREATE TABLE IF NOT EXISTS verification_codes (
    email VARCHAR(255) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- 9. 日志表（可选，用于持久化日志）
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

-- 10. 迁移状态表（用于跟踪迁移进度）
CREATE TABLE IF NOT EXISTS migration_status (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    migration_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_migration_status_user_id ON migration_status(user_id);


