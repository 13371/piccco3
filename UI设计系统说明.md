# UI设计系统说明

## 设计理念
- **轻量、简洁、干净**
- **白色为主色，辅助浅蓝色（偏冷色系）**
- **玻璃磨砂 + 微弱阴影 + 圆角**
- **现代、简洁、养眼，不花哨**
- **参考：Apple / Notion / 少即是多风格**

## 设计变量系统

### 颜色
- **主色**：`#007AFF` (浅蓝色)
- **主色浅**：`#E3F2FD` (浅蓝背景)
- **主色渐变**：`linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)`
- **背景色**：`#FFFFFF` (白色)
- **毛玻璃背景**：`rgba(255, 255, 255, 0.8)`
- **文字主色**：`#1A1A1A`
- **文字次要**：`#6B7280`
- **文字三级**：`#9CA3AF`
- **边框色**：`#E5E7EB` (极淡灰色)

### 圆角系统
- **小圆角**：`8px`
- **中圆角**：`14px`
- **大圆角**：`20px`
- **超大圆角**：`24px`
- **胶囊形**：`999px`
- **卡片圆角**：`16px`

### 阴影系统
- **小阴影**：`0 1px 2px rgba(0, 0, 0, 0.04)`
- **中阴影**：`0 4px 12px rgba(0, 0, 0, 0.08)`
- **大阴影**：`0 8px 24px rgba(0, 0, 0, 0.12)`
- **卡片阴影**：`0 2px 8px rgba(0, 0, 0, 0.06)`
- **柔和阴影**：`0 4px 16px rgba(0, 0, 0, 0.06)`

### 过渡时间
- **快速**：`150ms`
- **正常**：`200ms`
- **慢速**：`250ms`

## 组件样式

### 导航栏（TopBar）
- ✅ 白色背景 + 毛玻璃效果
- ✅ 带图标（添加、搜索）
- ✅ 淡淡阴影
- ✅ 轻微半透明效果

### Tab导航条（TopNav）
- ✅ 胶囊形背景
- ✅ 选中项：浅蓝渐变背景
- ✅ 未选中项：文字灰色
- ✅ 圆角较大（pill形状）
- ✅ hover轻微缩放动效

### 卡片 & 内容容器
- ✅ 圆角：16px（卡片标准）
- ✅ 阴影：柔和扩散阴影
- ✅ 背景：白色或半透明白
- ✅ 边框：极淡灰色边框（可选）
- ✅ hover轻微浮起效果

### 我的页面
- ✅ 顶部个人信息卡片
  - 头像圆形
  - 用户名 & 邮箱纵向排列
  - 右侧按钮「修改」
  - 清爽不拥挤
- ✅ 菜单项使用卡片样式
  - 圆角
  - 图标+文字+箭头
  - 间距统一
  - hover有轻微浮起
- ✅ 退出按钮
  - 保持红色
  - 大号圆角按钮
  - 居中
  - 阴影柔和

### 动效
- ✅ hover轻微缩放（`scale(1.02)`）
- ✅ active轻微按压（`scale(0.98)`）
- ✅ 过渡时间：150-250ms
- ✅ 卡片hover轻微浮起（`translateY(-2px)`）

### 响应式
- ✅ 手机端适配自然
- ✅ 元素居中
- ✅ 适度缩放
- ✅ 触摸目标大小优化（最小44px）

## 使用方式

### CSS变量使用
```css
/* 使用设计变量 */
.card {
  background: var(--bg-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-light);
  transition: transform var(--transition-normal) ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}
```

### 毛玻璃效果
```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}
```

### 按钮动效
```css
button {
  transition: transform var(--transition-fast) ease;
}

button:hover {
  transform: scale(1.02);
}

button:active {
  transform: scale(0.98);
}
```

## 已更新的文件

1. **全局样式**：`src/styles/global.css`
   - 定义了完整的设计变量系统
   - 添加了卡片基础样式
   - 添加了毛玻璃效果类
   - 添加了按钮动效

2. **导航栏**：`src/components/TopBar.css`
   - 白色背景 + 毛玻璃效果
   - 淡淡阴影
   - 图标hover动效

3. **Tab导航**：`src/components/TopNav.css`
   - 胶囊形背景
   - 浅蓝渐变选中
   - 圆角较大

4. **列表项**：`src/components/ListItem.css`
   - 卡片样式
   - 圆角、阴影、边框
   - hover浮起效果

5. **我的页面**：`src/pages/MePage.css`
   - 个人信息卡片
   - 菜单卡片样式
   - 退出按钮样式

6. **首页**：`src/pages/HomePageNew.css`
   - 白色圆角面板
   - 柔和阴影
   - 极淡边框

## 深色模式支持

所有设计变量都支持深色模式，通过 `[data-theme="dark"]` 选择器自动切换。

## 注意事项

1. **不要引入太复杂UI框架** - 使用纯CSS实现
2. **不要堆叠太重阴影** - 使用柔和的阴影系统
3. **不要太花哨** - 保持极简风格
4. **保持结构不大改** - 只更新样式，不改变HTML结构


