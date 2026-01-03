# 解决 Git Pull 冲突

## 问题

Git pull 失败，因为服务器上存在未跟踪的文件 `backend/test-db-connection.js`，Git 认为会被覆盖。

## 解决方案

在服务器上执行以下命令：

### 方案一：备份并删除（推荐）

```bash
cd /www/wwwroot/piccco3/backend

# 备份现有文件（如果有重要修改）
cp test-db-connection.js test-db-connection.js.backup 2>/dev/null || true

# 删除未跟踪的文件
rm test-db-connection.js

# 重新拉取代码
cd /www/wwwroot/piccco3
git pull origin main
```

### 方案二：直接删除

```bash
cd /www/wwwroot/piccco3/backend
rm test-db-connection.js
cd /www/wwwroot/piccco3
git pull origin main
```

### 方案三：使用 Git stash（如果文件有修改）

```bash
cd /www/wwwroot/piccco3
git stash
git pull origin main
git stash pop
```

## 执行后

拉取成功后，再次测试数据库连接：

```bash
cd /www/wwwroot/piccco3/backend
node test-db-connection.js
```





