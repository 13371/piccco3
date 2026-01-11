# 修复 LoginPage.tsx 的 devCode 问题

## 方法 1：从 Git 恢复然后手动删除

```bash
cd /www/wwwroot/piccco3

# 从 Git 恢复文件
git checkout HEAD -- src/pages/LoginPage.tsx

# 编辑文件，删除包含 devCode 的代码块（大约在第 138-143 行）
# 删除以下代码：
#     // 开发模式：如果返回了验证码，显示提示
#     if (result.devCode) {
#       setError(`验证码已发送！开发模式验证码：${result.devCode}（已显示在控制台）`);
#       // 3秒后清除提示
#       setTimeout(() => setError(''), 3000);
#     }
```

## 方法 2：使用 Python 脚本修复

```bash
cd /www/wwwroot/piccco3

# 从 Git 恢复文件
git checkout HEAD -- src/pages/LoginPage.tsx

# 使用 Python 删除包含 devCode 的行
python3 << 'EOF'
with open('src/pages/LoginPage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 删除包含 devCode 或相关注释的行
filtered_lines = []
skip_next = 0
for i, line in enumerate(lines):
    if skip_next > 0:
        skip_next -= 1
        continue
    if 'devCode' in line or '开发模式.*验证码' in line:
        # 如果是 if 语句，跳过接下来的几行
        if 'if (result.devCode)' in line:
            skip_next = 4  # 跳过 if 块
        continue
    filtered_lines.append(line)

with open('src/pages/LoginPage.tsx', 'w', encoding='utf-8') as f:
    f.writelines(filtered_lines)

print("修复完成")
EOF
```

## 方法 3：直接使用 vim/nano 编辑

```bash
cd /www/wwwroot/piccco3

# 从 Git 恢复文件
git checkout HEAD -- src/pages/LoginPage.tsx

# 使用 vim 编辑
vim src/pages/LoginPage.tsx

# 在 vim 中：
# 1. 按 / 搜索 "devCode"
# 2. 找到包含 devCode 的代码块（大约第 138-143 行）
# 3. 按 dd 删除当前行，重复删除整个代码块
# 4. 保存并退出：:wq
```

