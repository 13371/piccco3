#!/bin/bash
# 修复 LoginPage.tsx 中的 devCode 问题

cd /www/wwwroot/piccco3/src/pages

# 备份原文件
cp LoginPage.tsx LoginPage.tsx.bak

# 使用更精确的 sed 命令，只删除包含 devCode 的完整代码块
# 删除包含 "if (result.devCode)" 的行及其后 4 行（整个 if 块）
sed -i '/if (result\.devCode)/,/setTimeout/d' LoginPage.tsx

# 删除包含 "开发模式" 的注释行
sed -i '/开发模式.*验证码/d' LoginPage.tsx

# 删除可能留下的空行（连续多个空行只保留一个）
sed -i ':a;N;$!ba;s/\n\n\n*/\n\n/g' LoginPage.tsx

echo "修复完成，已备份原文件到 LoginPage.tsx.bak"

