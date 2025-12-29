# piccco - 记事、收藏、URL和书签应用

一款现代化的记事、收藏、保存URL和书签应用，采用简洁美观的UI设计。

## 功能特性

### 主要功能

#### 记事本
- 记事可以放在文件夹中
- 支持普通文件夹和隐私文件夹
- 隐私文件夹需要一级密码才能打开
- 首页独立的大白框输入区域，内容自动保存

#### 网址收藏
- 收藏网站的专用网址页面
- URL自动优化，方便保存链接
- 网址文件夹带有地球图标

#### 分类管理
- 分类页面管理各种文件夹
- 支持文件夹颜色切换（红、橙、黄、绿、青、蓝、紫）
- 文件夹图标可点击切换颜色

#### 全部页面
- 显示所有记事事项（排除隐私文件夹）
- 按最后编辑时间排序
- 星标记事置顶

#### 首页
- 独立的大白框输入区域
- 内容自动保存
- 独立于任何文件夹

### 其他功能

- **菜单功能**：重命名、编辑、删除、添加星标
- **回收站**：删除的文件30天可恢复，自动清理过期文件
- **星标系统**：星标文件夹和记事会置顶显示
- **用户系统**：支持登录注册，每个用户数据隔离
- **隐私保护**：隐私文件夹需要密码才能访问

## 技术栈

- React 18
- TypeScript
- React Router
- Zustand（状态管理）
- Vite（构建工具）
- date-fns（日期处理）

## 安装和运行

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 项目结构

```
piccco3/
├── src/
│   ├── components/      # 可复用组件
│   │   ├── Layout.tsx
│   │   ├── TopBar.tsx
│   │   ├── BottomNav.tsx
│   │   ├── ListItem.tsx
│   │   ├── FolderIcon.tsx
│   │   ├── Modal.tsx
│   │   ├── ContextMenu.tsx
│   │   └── PasswordModal.tsx
│   ├── pages/          # 页面组件
│   │   ├── LoginPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── AllPage.tsx
│   │   ├── UrlPage.tsx
│   │   ├── CategoryPage.tsx
│   │   ├── MePage.tsx
│   │   └── TrashPage.tsx
│   ├── stores/         # Zustand状态管理
│   │   ├── userStore.ts
│   │   └── dataStore.ts
│   ├── types/          # TypeScript类型定义
│   │   └── index.ts
│   ├── styles/         # 全局样式
│   │   ├── global.css
│   │   └── colors.css
│   ├── App.tsx         # 主应用组件
│   └── main.tsx        # 入口文件
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 使用说明

1. **首次使用**：注册一个新账号
2. **登录**：使用注册的用户名和密码登录
3. **创建文件夹**：在"分类"页面点击"新建文件夹"按钮
4. **添加记事**：在首页输入内容，自动保存
5. **收藏网址**：在"网址"页面添加网址
6. **管理文件**：右键点击项目可以重命名、编辑、删除或添加星标
7. **隐私文件夹**：创建隐私文件夹时需要设置密码，访问时需要输入密码

## 数据存储

应用使用 Zustand 的 persist 中间件将数据存储在浏览器的 localStorage 中。每个用户的数据是隔离的。

## 注意事项

- 隐私文件夹的密码目前以明文形式存储（实际应用中应加密）
- 回收站中的文件会在30天后自动清理
- 数据存储在浏览器本地，清除浏览器数据会丢失所有数据

## 开发计划

- [ ] 添加后端API支持
- [ ] 实现数据加密
- [ ] 添加搜索功能
- [ ] 支持文件夹嵌套
- [ ] 添加导出/导入功能
- [ ] 支持多设备同步

## 许可证

MIT License










