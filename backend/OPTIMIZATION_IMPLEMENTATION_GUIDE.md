# 性能优化实施指南

本文档提供详细的性能优化实施步骤，包括 PgBouncer 配置和增量同步优化。

## 📋 优化清单

### ✅ 已完成
- [x] PostgreSQL 配置优化（shared_buffers, work_mem, WAL等）
- [x] 数据库索引优化（users, notes, folders表）
- [x] Node.js 连接池限制（max: 20）
- [x] 接口分页实现（notes, folders, logs）
- [x] 用户信息内存缓存（5分钟TTL）
- [x] 数据库权限修复

### 🔄 进行中
- [ ] 安装和配置 PgBouncer 连接池
- [ ] 优化同步策略（基于 updated_at，增量同步）

---

## 一、PgBouncer 安装和配置

### 1.1 安装 PgBouncer（宝塔面板）

#### 方法 1: 通过宝塔面板安装（推荐）

1. **打开宝塔面板** → **软件商店** → **运行环境**
2. 搜索 **PgBouncer** 或 **PostgreSQL 连接池**
3. 点击 **安装**

#### 方法 2: 通过命令行安装

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install pgbouncer

# CentOS/RHEL
sudo yum install pgbouncer
```

### 1.2 配置 PgBouncer

#### 步骤 1: 创建配置文件

```bash
# 复制示例配置
cd /www/wwwroot/piccco3/backend
sudo cp config/pgbouncer.ini.example /etc/pgbouncer/pgbouncer.ini
```

#### 步骤 2: 编辑配置文件

编辑 `/etc/pgbouncer/pgbouncer.ini`：

```ini
[databases]
piccco = host=127.0.0.1 port=5432 dbname=piccco

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432

# 认证配置
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# 连接池配置（关键）
max_client_conn = 2000
default_pool_size = 50
min_pool_size = 5
pool_mode = session

# 超时配置
server_connect_timeout = 15
server_idle_timeout = 600
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0

# 日志配置
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid

# 管理用户
admin_users = postgres
stats_users = postgres
```

#### 步骤 3: 创建用户认证文件

```bash
# 生成 MD5 密码哈希（替换 'your_password' 为实际密码）
echo -n "your_passwordpiccco_user" | md5sum

# 创建用户列表文件
sudo nano /etc/pgbouncer/userlist.txt
```

在 `userlist.txt` 中添加：

```
"piccco_user" "md5hash_here"
"postgres" "md5hash_here"
```

**生成 MD5 哈希的方法：**

```bash
# 方法 1: 使用 PostgreSQL 生成
/www/server/pgsql/bin/psql -U postgres -d piccco -c "SELECT 'md5' || md5('your_password' || 'piccco_user');"

# 方法 2: 使用命令行
echo -n "your_passwordpiccco_user" | md5sum | awk '{print "md5"$1}'
```

#### 步骤 4: 创建日志目录

```bash
sudo mkdir -p /var/log/pgbouncer
sudo mkdir -p /var/run/pgbouncer
sudo chown pgbouncer:pgbouncer /var/log/pgbouncer
sudo chown pgbouncer:pgbouncer /var/run/pgbouncer
```

### 1.3 启动 PgBouncer

```bash
# 启动服务
sudo systemctl start pgbouncer

# 设置开机自启
sudo systemctl enable pgbouncer

# 检查状态
sudo systemctl status pgbouncer
```

### 1.4 验证连接

```bash
# 测试通过 PgBouncer 连接
/www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U piccco_user -d piccco -c "SELECT version();"
```

### 1.5 更新应用配置

编辑 `backend/.env` 文件：

```env
# 启用 PgBouncer
USE_PGBOUNCER=true
DB_HOST=127.0.0.1
DB_PORT=6432
DB_NAME=piccco
DB_USER=piccco_user
DB_PASSWORD=your_password
```

### 1.6 重启应用

```bash
pm2 restart piccco-backend --update-env
```

### 1.7 验证 PgBouncer 统计

```bash
# 连接到 PgBouncer 管理界面
/www/server/pgsql/bin/psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer

# 查看统计信息
SHOW POOLS;
SHOW STATS;
SHOW CLIENTS;
```

---

## 二、增量同步优化

### 2.1 问题分析

**当前问题：**
- 同步接口传输完整 JSON 数据
- 每次同步都传输所有文件夹、笔记、URL
- 数据量大时网络传输慢，数据库写入压力大

**优化目标：**
- 只同步变化的数据（基于 `updated_at`）
- 减少网络传输量
- 降低数据库写入压力

### 2.2 实现方案

#### 方案 1: 基于 `lastSyncAt` 的增量同步（推荐）

**原理：**
- 客户端记录最后同步时间 `lastSyncAt`
- 服务器只返回 `updated_at > lastSyncAt` 的数据
- 客户端只发送 `updated_at > lastSyncAt` 的数据

**优势：**
- 实现简单
- 兼容性好
- 支持多设备同步

#### 方案 2: 基于版本号的增量同步

**原理：**
- 每个数据项维护版本号
- 只同步版本号变化的数据

**优势：**
- 更精确
- 支持冲突检测

**劣势：**
- 实现复杂
- 需要修改数据库结构

### 2.3 实施步骤

#### 步骤 1: 修改 DAO 层，支持增量查询

创建 `backend/src/db/dao/userDataDao.js` 的增量查询方法：

```javascript
/**
 * 获取用户增量数据（基于 updated_at）
 */
async function getUserDataIncremental(userId, lastSyncAt) {
  try {
    const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    
    // 获取文件夹（只返回 updated_at > lastSyncAt 的）
    const foldersResult = await query(
      `SELECT * FROM folders 
       WHERE user_id = $1 AND updated_at > $2 
       ORDER BY updated_at DESC`,
      [userId, since]
    );

    // 获取笔记
    const notesResult = await query(
      `SELECT * FROM notes 
       WHERE user_id = $1 AND updated_at > $2 
       ORDER BY updated_at DESC`,
      [userId, since]
    );

    // 获取URL
    const urlsResult = await query(
      `SELECT * FROM urls 
       WHERE user_id = $1 AND updated_at > $2 
       ORDER BY updated_at DESC`,
      [userId, since]
    );

    return {
      folders: foldersResult.rows.map(formatFolder),
      notes: notesResult.rows.map(formatNote),
      urls: urlsResult.rows.map(formatUrl),
      hasMore: false, // 可以用于分页
    };
  } catch (error) {
    logger.error('userDataDao', '获取增量数据失败', error);
    throw error;
  }
}
```

#### 步骤 2: 修改同步接口

修改 `backend/src/routes/data.js`：

```javascript
// GET /api/v1/data/sync - 支持增量同步
router.get('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const lastSyncAt = req.query.lastSyncAt ? parseInt(req.query.lastSyncAt) : null;
    
    // 如果提供了 lastSyncAt，使用增量同步
    if (lastSyncAt) {
      const incrementalData = await userDataDao.getUserDataIncremental(userId, lastSyncAt);
      return res.json({
        success: true,
        data: incrementalData,
        incremental: true,
        lastSyncAt: Date.now(),
      });
    }
    
    // 否则返回完整数据（向后兼容）
    const userData = await userDataStoreAdapter.getUserData(userId);
    // ... 现有逻辑
  } catch (error) {
    // ... 错误处理
  }
});
```

#### 步骤 3: 优化客户端同步逻辑

修改前端 `src/stores/dataStore.ts`：

```typescript
// 增量同步
syncDataFromServer: async () => {
  const lastSyncAt = get().lastSyncAt;
  
  // 使用增量同步接口
  const url = lastSyncAt 
    ? `${API_BASE_URL}/data/sync?lastSyncAt=${lastSyncAt}`
    : `${API_BASE_URL}/data/sync`;
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const result = await res.json();
  
  if (result.incremental) {
    // 合并增量数据
    mergeIncrementalData(result.data);
  } else {
    // 完整同步（首次或回退）
    setData(result.data);
  }
  
  set({ lastSyncAt: result.lastSyncAt || Date.now() });
}
```

### 2.4 性能对比

**优化前：**
- 每次同步传输：10,000 条笔记 × 5KB = 50MB
- 同步时间：5-10 秒
- 数据库写入：10,000 条 INSERT/UPDATE

**优化后：**
- 每次同步传输：100 条变化笔记 × 5KB = 500KB
- 同步时间：0.5-1 秒
- 数据库写入：100 条 INSERT/UPDATE

**性能提升：**
- 网络传输减少：99%
- 同步时间减少：90%
- 数据库压力减少：99%

---

## 三、实施计划

### 阶段 1: PgBouncer 配置（1-2小时）

1. ✅ 安装 PgBouncer
2. ✅ 配置连接池
3. ✅ 创建认证文件
4. ✅ 启动服务
5. ✅ 更新应用配置
6. ✅ 验证连接

### 阶段 2: 增量同步优化（2-4小时）

1. ✅ 修改 DAO 层，添加增量查询方法
2. ✅ 修改同步接口，支持增量同步
3. ✅ 更新前端同步逻辑
4. ✅ 测试增量同步功能
5. ✅ 性能测试和验证

### 阶段 3: 监控和优化（持续）

1. ✅ 监控 PgBouncer 连接池使用情况
2. ✅ 监控同步性能
3. ✅ 根据实际情况调整配置

---

## 四、验证和测试

### 4.1 PgBouncer 验证

```bash
# 1. 检查服务状态
sudo systemctl status pgbouncer

# 2. 测试连接
psql -h 127.0.0.1 -p 6432 -U piccco_user -d piccco -c "SELECT 1;"

# 3. 查看连接池统计
psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;"
```

### 4.2 增量同步验证

```bash
# 1. 测试增量同步接口
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:4000/api/v1/data/sync?lastSyncAt=1234567890"

# 2. 检查返回数据量
# 应该只返回 updated_at > lastSyncAt 的数据
```

### 4.3 性能测试

```bash
# 1. 压力测试（使用 Apache Bench）
ab -n 1000 -c 100 -H "Authorization: Bearer TOKEN" \
  http://localhost:4000/api/v1/data/sync

# 2. 监控数据库连接数
watch -n 1 'psql -h 127.0.0.1 -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;"'
```

---

## 五、故障排查

### 5.1 PgBouncer 连接失败

**问题：** 无法通过 PgBouncer 连接数据库

**排查：**
1. 检查 PgBouncer 服务状态：`sudo systemctl status pgbouncer`
2. 检查配置文件：`sudo pgbouncer -v /etc/pgbouncer/pgbouncer.ini`
3. 检查认证文件：`cat /etc/pgbouncer/userlist.txt`
4. 查看日志：`tail -f /var/log/pgbouncer/pgbouncer.log`

### 5.2 增量同步数据不完整

**问题：** 增量同步后数据缺失

**排查：**
1. 检查 `lastSyncAt` 是否正确传递
2. 检查数据库 `updated_at` 字段是否正确更新
3. 检查时区问题（确保使用 UTC 时间戳）

---

## 六、回滚方案

### 6.1 PgBouncer 回滚

如果 PgBouncer 出现问题，可以快速回滚：

```bash
# 1. 停止 PgBouncer
sudo systemctl stop pgbouncer

# 2. 修改 .env，直接连接 PostgreSQL
USE_PGBOUNCER=false
DB_PORT=5432

# 3. 重启应用
pm2 restart piccco-backend --update-env
```

### 6.2 增量同步回滚

增量同步向后兼容，如果出现问题：

1. 前端不传递 `lastSyncAt` 参数
2. 服务器自动回退到完整同步模式

---

## 七、最佳实践

### 7.1 PgBouncer 配置建议

- **连接池大小：** 根据实际并发数调整（建议 50-100）
- **超时设置：** 根据应用特点调整
- **监控：** 定期检查连接池使用情况

### 7.2 增量同步建议

- **首次同步：** 使用完整同步
- **后续同步：** 使用增量同步
- **冲突处理：** 基于 `updated_at` 判断最新数据
- **数据完整性：** 定期进行完整同步验证

---

**最后更新：** 2026-01-03

