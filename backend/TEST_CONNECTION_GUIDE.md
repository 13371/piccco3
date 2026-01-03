# 测试数据库连接 - 详细指南

## 🚀 快速测试

### 方法一：使用宝塔面板终端（推荐）

1. **打开终端**
   - 在宝塔面板左侧菜单，点击 **"终端"**
   - 或点击文件管理器右上角的 **"终端"** 按钮

2. **进入项目目录**
   ```bash
   cd /www/wwwroot/piccco3/backend
   ```
   （如果您的项目路径不同，请修改为实际路径）

3. **运行测试脚本**
   ```bash
   node test-db-connection.js
   ```

4. **查看结果**
   - ✅ 如果看到 "数据库连接成功！"，说明配置正确
   - ❌ 如果看到错误信息，请检查配置

---

### 方法二：使用 SSH 连接

如果您有 SSH 访问权限：

```bash
# SSH 连接到服务器
ssh root@8.136.38.126

# 进入项目目录
cd /www/wwwroot/piccco3/backend

# 运行测试
node test-db-connection.js
```

---

## 📋 预期输出

### ✅ 成功示例

```
🔌 正在测试数据库连接...

📋 数据库配置:
   - 主机: localhost
   - 端口: 5432
   - 数据库: piccco
   - 用户: piccco_user
   - 密码: ***已设置***

✅ 数据库连接成功！
📅 数据库时间: 2026-01-03T12:00:00.000Z

🎉 可以继续下一步操作了！
```

### ❌ 失败示例

如果连接失败，可能会看到：

```
❌ 数据库连接失败！
错误信息: connection refused

💡 请检查：
   1. PostgreSQL 服务是否运行
   2. .env 文件中的数据库配置是否正确
   3. 数据库用户密码是否正确
   4. 防火墙是否阻止了连接
```

---

## 🔧 常见问题排查

### 问题1：找不到 test-db-connection.js 文件

**解决**：
```bash
# 检查文件是否存在
ls -la test-db-connection.js

# 如果不存在，检查当前目录
pwd
# 应该显示：/www/wwwroot/piccco3/backend
```

### 问题2：找不到 node 命令

**解决**：
```bash
# 检查 Node.js 是否安装
node --version

# 如果未安装，在宝塔面板中安装 Node.js
# 宝塔面板 → 软件商店 → 搜索 "Node.js版本管理器"
```

### 问题3：连接被拒绝 (connection refused)

**检查**：
1. PostgreSQL 服务是否运行
   - 在宝塔面板中，打开 PostgreSQL 管理器
   - 检查 "服务状态" 是否为 "开启"

2. 端口是否正确
   - 检查 `.env` 文件中的 `DB_PORT=5432`
   - 在 PostgreSQL 管理器中查看实际端口

### 问题4：认证失败 (authentication failed)

**检查**：
1. 用户名是否正确：`piccco_user`
2. 密码是否正确：`kkFSK7p2yN5wR7wt`
3. `.env` 文件中的密码是否有引号或特殊字符

### 问题5：数据库不存在 (database does not exist)

**解决**：
1. 在 PostgreSQL 管理器中，检查数据库 `piccco` 是否存在
2. 如果不存在，重新创建数据库

---

## 📝 测试脚本说明

`test-db-connection.js` 脚本会：
1. 读取 `.env` 文件中的数据库配置
2. 尝试连接到 PostgreSQL 数据库
3. 执行一个简单的查询（SELECT NOW()）
4. 显示连接结果

---

## ✅ 测试成功后

如果测试成功，您可以继续：
1. 创建数据库 Schema
2. 迁移数据
3. 切换到双写模式

---

**需要帮助？** 如果测试失败，请告诉我具体的错误信息，我会帮您排查。







