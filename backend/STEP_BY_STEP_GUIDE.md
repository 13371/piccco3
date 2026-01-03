# PostgreSQL 迁移 - 详细操作指南

## 📋 准备工作

在开始之前，请确保您已经：
- ✅ 有服务器/开发环境的访问权限
- ✅ 了解基本的命令行操作
- ✅ 准备好数据库密码（建议使用强密码）

---

## 第一步：检查当前环境

### 1.1 检查 Node.js 版本
```bash
node --version
```
**要求**：Node.js 14.0 或更高版本

### 1.2 检查是否已安装 PostgreSQL
```bash
# Linux/macOS
psql --version

# Windows
# 打开命令提示符
psql --version
```

**如果未安装**，请先安装 PostgreSQL（见第二步）

### 1.3 检查当前项目状态
```bash
cd backend
pwd  # 确认当前在 backend 目录
ls -la  # 查看文件列表
```

---

## 第二步：安装 PostgreSQL（如果未安装）

### 2.1 Ubuntu/Debian
```bash
# 更新包列表
sudo apt-get update

# 安装PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# 启动PostgreSQL服务
sudo systemctl start postgresql
sudo systemctl enable postgresql  # 设置开机自启

# 检查服务状态
sudo systemctl status postgresql
```

### 2.2 macOS
```bash
# 使用 Homebrew
brew install postgresql@14

# 启动服务
brew services start postgresql@14

# 或手动启动
pg_ctl -D /usr/local/var/postgres start
```

### 2.3 Windows
1. 访问 https://www.postgresql.org/download/windows/
2. 下载 PostgreSQL 安装程序
3. 运行安装程序，按提示安装
4. 记住安装时设置的 postgres 用户密码

### 2.4 验证安装
```bash
psql --version
# 应该显示类似：psql (PostgreSQL) 14.x
```

---

## 第三步：创建数据库和用户

### 3.1 登录 PostgreSQL
```bash
# Linux/macOS（使用 postgres 用户）
sudo -u postgres psql

# Windows（打开命令提示符，使用安装时创建的用户）
psql -U postgres
```

### 3.2 创建数据库
在 PostgreSQL 命令行中执行：
```sql
-- 创建数据库
CREATE DATABASE piccco;

-- 创建用户（替换 'your_password' 为您的密码）
CREATE USER piccco_user WITH PASSWORD 'your_password';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE piccco TO piccco_user;

-- 退出
\q
```

### 3.3 验证数据库创建
```bash
# 使用新用户登录测试
psql -U piccco_user -d piccco -h localhost

# 如果成功，会看到：
# piccco=>

# 测试查询
SELECT version();

# 退出
\q
```

---

## 第四步：配置环境变量

### 4.1 检查 .env 文件
```bash
cd backend
ls -la .env  # 检查文件是否存在
```

### 4.2 编辑 .env 文件
```bash
# Linux/macOS
nano .env
# 或
vim .env

# Windows
notepad .env
```

### 4.3 添加数据库配置
在 `.env` 文件中添加以下内容（如果不存在）：

```env
# ============================================
# 数据库配置（新增）
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=piccco
DB_USER=piccco_user
DB_PASSWORD=your_password  # 替换为您在第三步设置的密码

# 存储模式配置
# 'file' - 仅使用文件存储（默认，当前模式）
# 'db' - 仅使用数据库存储
# 'dual' - 双写模式（同时写入文件和数据库，推荐过渡期使用）
STORAGE_MODE=file

# 数据库连接池配置（可选，使用默认值即可）
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

### 4.4 保存并验证
```bash
# 检查配置是否正确
cat .env | grep DB_
```

---

## 第五步：安装 Node.js 依赖

### 5.1 进入 backend 目录
```bash
cd backend
```

### 5.2 安装依赖
```bash
npm install
```

### 5.3 验证安装
```bash
# 检查 pg 包是否安装成功
npm list pg

# 应该显示类似：
# piccco-backend@1.0.0
# └── pg@8.11.3
```

**如果安装失败**，请检查：
- Node.js 版本是否满足要求
- 网络连接是否正常
- 是否有足够的磁盘空间

---

## 第六步：创建数据库 Schema

### 6.1 方法一：使用 psql 直接执行（推荐）
```bash
# 执行 SQL 文件
psql -U piccco_user -d piccco -f migrations/001_create_schema.sql

# 如果提示输入密码，输入您在第三步设置的密码
```

### 6.2 方法二：使用 Node.js 脚本
```bash
# 创建测试脚本
node -e "
const { initPool } = require('./src/db/config');
const { createSchema } = require('./src/db/migrations');

(async () => {
  try {
    initPool();
    await createSchema();
    console.log('✅ Schema 创建成功');
    process.exit(0);
  } catch (error) {
    console.error('❌ Schema 创建失败:', error);
    process.exit(1);
  }
})();
"
```

### 6.3 验证 Schema 创建
```bash
# 登录数据库
psql -U piccco_user -d piccco

# 检查表是否创建
\dt

# 应该看到以下表：
# - users
# - folders
# - notes
# - urls
# - user_settings
# - messages
# - message_history
# - verification_codes
# - logs
# - migration_status

# 检查某个表的结构
\d users

# 退出
\q
```

---

## 第七步：测试数据库连接

### 7.1 创建测试脚本
创建文件 `backend/test-db-connection.js`：

```javascript
const { initPool, checkConnection, closePool } = require('./src/db/config');

(async () => {
  try {
    console.log('🔌 正在测试数据库连接...');
    initPool();
    
    const result = await checkConnection();
    
    if (result.connected) {
      console.log('✅ 数据库连接成功！');
      console.log('📅 数据库时间:', result.timestamp);
    } else {
      console.error('❌ 数据库连接失败:', result.error);
      process.exit(1);
    }
    
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('❌ 连接测试失败:', error);
    process.exit(1);
  }
})();
```

### 7.2 运行测试
```bash
node test-db-connection.js
```

**预期输出**：
```
🔌 正在测试数据库连接...
✅ 数据库连接成功！
📅 数据库时间: 2026-01-03T12:00:00.000Z
```

**如果失败**，请检查：
- 数据库服务是否运行
- `.env` 文件中的配置是否正确
- 数据库用户密码是否正确
- 防火墙是否阻止了连接

---

## 第八步：迁移现有数据（可选）

### 8.1 备份现有数据
```bash
# 备份 data 目录
cd backend
cp -r data data_backup_$(date +%Y%m%d_%H%M%S)

# 或 Windows
xcopy data data_backup_%date:~0,4%%date:~5,2%%date:~8,2% /E /I
```

### 8.2 执行数据迁移
```bash
# 确保数据库连接正常
node test-db-connection.js

# 执行迁移脚本
node scripts/migrate-to-db.js
```

### 8.3 查看迁移结果
迁移脚本会输出类似以下信息：
```
[migrate] 开始数据迁移...
[migrate] 数据库已初始化
[migrate] 开始迁移用户数据...
[migrate] 用户数据迁移完成: 成功 3, 失败 0
[migrate] 开始迁移用户数据（文件夹、笔记、URL）...
[migrate] 用户数据迁移完成: 成功 3, 失败 0
[migrate] 开始迁移消息数据...
[migrate] 消息数据迁移完成: 成功 5, 失败 0
[migrate] 开始迁移消息历史...
[migrate] 消息历史迁移完成: 成功 2, 失败 0
[migrate] 数据迁移完成
```

### 8.4 验证迁移数据
```bash
# 登录数据库
psql -U piccco_user -d piccco

# 检查用户数量
SELECT COUNT(*) FROM users;

# 检查文件夹数量
SELECT COUNT(*) FROM folders;

# 检查笔记数量
SELECT COUNT(*) FROM notes;

# 退出
\q
```

---

## 第九步：切换到双写模式（推荐）

### 9.1 修改 .env 文件
```bash
# 编辑 .env 文件
nano .env  # 或 vim .env 或 notepad .env

# 修改这一行：
STORAGE_MODE=dual
```

### 9.2 重启服务器
```bash
# 如果服务器正在运行，先停止
# 按 Ctrl+C 停止

# 重新启动
npm start
```

### 9.3 观察日志
启动后，您应该看到：
```
[server] piccco backend listening on http://0.0.0.0:4000
[db] 数据库连接池初始化成功
```

### 9.4 测试功能
1. 注册一个新用户
2. 创建一个文件夹
3. 创建一条笔记
4. 检查数据是否同时写入文件和数据库

---

## 第十步：验证数据一致性

### 10.1 创建验证脚本
创建文件 `backend/verify-data.js`：

```javascript
const { userStoreAdapter } = require('./src/store/storageAdapter');
const { userDataStoreAdapter } = require('./src/store/storageAdapter');
const { query } = require('./src/db/config');

(async () => {
  try {
    console.log('🔍 开始验证数据一致性...\n');
    
    // 获取所有用户
    const users = await userStoreAdapter.getAllUsers();
    console.log(`📊 用户数量: ${users.length}`);
    
    // 从数据库直接查询
    const dbResult = await query('SELECT COUNT(*) as count FROM users');
    console.log(`📊 数据库用户数量: ${dbResult.rows[0].count}`);
    
    // 验证每个用户的数据
    for (const user of users) {
      const userData = await userDataStoreAdapter.getUserData(user.id);
      console.log(`\n👤 用户: ${user.username} (${user.id})`);
      console.log(`   - 文件夹: ${userData.folders.length}`);
      console.log(`   - 笔记: ${userData.notes.length}`);
      console.log(`   - URL: ${userData.urls.length}`);
    }
    
    console.log('\n✅ 数据验证完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  }
})();
```

### 10.2 运行验证
```bash
node verify-data.js
```

---

## 第十一步：完全切换到数据库模式（可选）

### 11.1 确认数据一致性
在切换到纯数据库模式之前，请确保：
- ✅ 所有数据已成功迁移
- ✅ 双写模式运行正常
- ✅ 没有错误日志

### 11.2 修改 .env 文件
```bash
# 编辑 .env 文件
STORAGE_MODE=db
```

### 11.3 重启服务器
```bash
npm start
```

### 11.4 测试功能
测试所有功能，确保一切正常：
- 用户注册/登录
- 创建/编辑/删除文件夹
- 创建/编辑/删除笔记
- 创建/编辑/删除URL
- 数据同步
- 消息功能

---

## 第十二步：监控和优化

### 12.1 监控数据库性能
```bash
# 登录数据库
psql -U piccco_user -d piccco

# 查看数据库大小
SELECT pg_size_pretty(pg_database_size('piccco'));

# 查看表大小
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# 退出
\q
```

### 12.2 查看应用日志
确保没有数据库相关的错误：
```bash
# 查看服务器日志
# 应该没有数据库连接错误
```

---

## 🔙 回滚步骤（如果需要）

### 回滚到文件存储
1. 修改 `.env` 文件：
   ```env
   STORAGE_MODE=file
   ```

2. 重启服务器：
   ```bash
   npm start
   ```

3. 数据将从 JSON 文件读取

**注意**：回滚后，数据库中的数据不会自动同步回文件。

---

## ❓ 常见问题

### Q1: 数据库连接失败
**检查**：
- PostgreSQL 服务是否运行
- `.env` 配置是否正确
- 防火墙设置
- 数据库用户权限

### Q2: 迁移脚本执行失败
**检查**：
- 数据库 Schema 是否已创建
- JSON 文件是否可读
- 数据库用户权限
- 查看详细错误日志

### Q3: 双写模式数据不一致
**处理**：
- 检查日志中的错误信息
- 验证两个存储的数据
- 考虑重新迁移数据

### Q4: 性能问题
**优化**：
- 调整连接池大小
- 添加数据库索引
- 优化查询语句

---

## 📞 获取帮助

如果遇到问题：
1. 查看日志文件
2. 检查数据库连接
3. 验证环境变量配置
4. 参考 `MIGRATION_GUIDE.md` 文档

---

**祝您迁移顺利！** 🎉





