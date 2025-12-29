# 上传代码到GitHub仓库 piccco3

## 📋 步骤说明

### 步骤1: 添加远程仓库

在GitHub上，你的仓库地址格式是：
```
https://github.com/你的用户名/piccco3.git
```

**获取完整地址的方法**：
1. 打开你的GitHub仓库页面：https://github.com/你的用户名/piccco3
2. 点击绿色的 "<> 代码" 按钮
3. 选择 "HTTPS" 标签
4. 复制显示的地址（类似：`https://github.com/你的用户名/piccco3.git`）

**然后运行以下命令**（替换为你的实际地址）：
```bash
git remote add origin https://github.com/你的用户名/piccco3.git
```

### 步骤2: 推送代码

```bash
# 重命名分支为main（GitHub默认分支）
git branch -M main

# 推送代码到远程仓库
git push -u origin main
```

**如果提示需要认证**：
- 输入你的GitHub用户名
- 密码处输入：**Personal Access Token**（不是GitHub密码）

### 步骤3: 获取Personal Access Token

如果还没有Token，按以下步骤创建：

1. 访问：https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 填写信息：
   - Note: `piccco3备份`
   - Expiration: 选择过期时间（建议90天或No expiration）
   - 勾选权限：**`repo`**（完整仓库访问权限）
4. 点击 "Generate token"
5. **立即复制Token**（只显示一次！）
6. 推送时，密码处粘贴这个Token

## ⚠️ 注意事项

1. **如果远程仓库已有README.md**：
   - 需要先拉取：`git pull origin main --allow-unrelated-histories`
   - 解决冲突后再推送

2. **如果提示"Repository not found"**：
   - 检查仓库地址是否正确
   - 确认仓库是公开的，或者你有访问权限

3. **如果提示"Permission denied"**：
   - 确认使用了Personal Access Token而不是密码
   - 确认Token有`repo`权限

## ✅ 验证上传成功

推送成功后，刷新GitHub仓库页面，应该能看到所有代码文件。

