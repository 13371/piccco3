-- 修复数据库权限脚本
-- 授予应用用户访问所有表的权限
-- 
-- 使用方法：
-- 1. 在宝塔面板的 PostgreSQL 管理界面中，选择数据库 piccco
-- 2. 点击"SQL"或"执行SQL"按钮
-- 3. 复制粘贴以下 SQL 并执行
--
-- 注意：请将 'postgres' 替换为你的实际应用数据库用户名
--       如果环境变量 DB_USER 未设置，默认使用 'postgres'

-- 设置应用用户（请根据实际情况修改）
\set app_user 'postgres'

-- 授予 public schema 权限
GRANT USAGE ON SCHEMA public TO :app_user;

-- 授予表权限
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE folders TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notes TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE urls TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_settings TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE messages TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE message_history TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE verification_codes TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE logs TO :app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE migration_status TO :app_user;

-- 授予序列权限（用于自增ID）
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE folders_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE notes_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE urls_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE user_settings_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE messages_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE message_history_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE verification_codes_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE logs_id_seq TO :app_user;
GRANT USAGE, SELECT ON SEQUENCE migration_status_id_seq TO :app_user;

-- 注意：如果上面的 \set 命令在宝塔面板中不支持，请直接替换 :app_user 为实际用户名
-- 例如：GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO postgres;


