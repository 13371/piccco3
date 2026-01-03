-- 修复数据库权限脚本（简化版，适用于宝塔面板）
-- 请将 'postgres' 替换为你的实际应用数据库用户名
-- 如果环境变量 DB_USER 未设置，默认使用 'postgres'

-- 授予 public schema 权限
GRANT USAGE ON SCHEMA public TO postgres;

-- 授予所有表权限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;

-- 授予所有序列权限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- 授予未来创建的表和序列的默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres;




