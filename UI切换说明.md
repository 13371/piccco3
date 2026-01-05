# UI切换说明

## 如何切换新旧UI

### 切换到新UI（默认已启用）
新UI已经默认启用，界面特点：
- 浅灰色渐变背景
- 大的白色圆角面板
- 标题输入框和内容输入框分离
- 三个旋转的蓝色点同步指示器
- 简洁的顶部导航栏

### 回滚到旧UI
如果需要回滚到旧UI，请按以下步骤操作：

1. 打开文件：`src/config/ui.ts`
2. 将 `USE_NEW_UI` 的值改为 `false`：
   ```typescript
   export const USE_NEW_UI = false; // 设置为 false 回滚到旧UI
   ```
3. 保存文件，刷新浏览器即可看到旧UI

### 新UI文件位置
- 新UI首页组件：`src/pages/HomePageNew.tsx`
- 新UI首页样式：`src/pages/HomePageNew.css`
- 新UI同步指示器：`src/components/SyncIndicator.tsx`
- 新UI同步指示器样式：`src/components/SyncIndicator.css`
- UI配置开关：`src/config/ui.ts`

### 旧UI文件位置
- 旧UI首页组件：`src/pages/HomePage.tsx`（当 `USE_NEW_UI = false` 时使用）
- 旧UI样式：`src/pages/HomePage.css`

### 注意事项
1. 新旧UI共享相同的数据存储，切换不会丢失数据
2. 新UI的标题和内容使用换行符分隔存储（第一行是标题，其余是内容）
3. 如果从新UI切换回旧UI，标题会显示在内容的第一行


