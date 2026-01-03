# 检查缺失文件

## 当前问题

错误：`Cannot find module './src/db/config'`

这说明服务器上缺少数据库相关的文件。

## 快速检查

在终端中执行以下命令，检查文件是否存在：

```bash
cd /www/wwwroot/piccco3/backend

# 检查数据库配置文件
ls -la src/db/config.js

# 检查数据库目录结构
ls -la src/db/

# 检查 migrations 文件
ls -la migrations/001_create_schema.sql
```

## 解决方案

### 方案一：上传所有文件（推荐）

如果您有本地项目代码，需要将以下文件/目录上传到服务器：

**必需的文件和目录：**
```
backend/
├── src/
│   ├── db/
│   │   ├── config.js          ← 必需
│   │   ├── migrations.js      ← 必需
│   │   └── dao/
│   │       ├── userDao.js     ← 必需
│   │       ├── userDataDao.js ← 必需
│   │       ├── messageDao.js  ← 必需
│   │       └── messageHistoryDao.js ← 必需
│   └── store/
│       └── storageAdapter.js  ← 必需
├── migrations/
│   └── 001_create_schema.sql  ← 必需
├── scripts/
│   └── migrate-to-db.js       ← 可选
└── package.json               ← 需要包含 pg 依赖
```

### 方案二：使用 Git 拉取代码

如果项目在 Git 仓库中：

```bash
cd /www/wwwroot/piccco3
git pull origin main
```

### 方案三：检查是否已安装依赖

即使文件存在，也需要安装依赖：

```bash
cd /www/wwwroot/piccco3/backend
npm install
```

---

## 快速诊断命令

执行以下命令查看详细情况：

```bash
cd /www/wwwroot/piccco3/backend

echo "=== 检查目录结构 ==="
ls -la src/ 2>&1
echo ""
ls -la src/db/ 2>&1
echo ""

echo "=== 检查关键文件 ==="
[ -f src/db/config.js ] && echo "✅ src/db/config.js 存在" || echo "❌ src/db/config.js 不存在"
[ -f src/db/migrations.js ] && echo "✅ src/db/migrations.js 存在" || echo "❌ src/db/migrations.js 不存在"
[ -f src/store/storageAdapter.js ] && echo "✅ src/store/storageAdapter.js 存在" || echo "❌ src/store/storageAdapter.js 不存在"
[ -f migrations/001_create_schema.sql ] && echo "✅ migrations/001_create_schema.sql 存在" || echo "❌ migrations/001_create_schema.sql 不存在"
echo ""

echo "=== 检查依赖 ==="
[ -f package.json ] && echo "✅ package.json 存在" || echo "❌ package.json 不存在"
[ -d node_modules/pg ] && echo "✅ pg 包已安装" || echo "❌ pg 包未安装"
```

---

## 下一步

根据检查结果：
1. **如果文件缺失**：需要上传文件或使用 Git 拉取
2. **如果文件存在但依赖未安装**：运行 `npm install`
3. **如果都正常**：再次运行测试脚本




