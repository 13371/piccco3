#!/bin/bash
# 恢复并修复 LoginPage.tsx

cd /www/wwwroot/piccco3

# 从 Git 恢复文件（丢弃本地修改）
git checkout HEAD -- src/pages/LoginPage.tsx

# 手动修复：使用更精确的方法删除 devCode 相关代码
cd src/pages

# 使用 awk 更安全地删除包含 devCode 的代码块
awk '
/if \(result\.devCode\)/ {
    # 跳过这一行和接下来4行
    getline
    getline
    getline
    getline
    next
}
/开发模式.*验证码/ {
    # 跳过注释行
    next
}
{ print }
' LoginPage.tsx > LoginPage.tsx.tmp && mv LoginPage.tsx.tmp LoginPage.tsx

echo "修复完成"

