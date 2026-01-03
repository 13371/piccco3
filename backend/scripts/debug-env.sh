#!/bin/bash

# 调试 .env 文件读取
# 使用方法：bash scripts/debug-env.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "当前目录: $(pwd)"
echo ""

if [ -f .env ]; then
    echo "✅ 找到 .env 文件"
    echo ""
    echo "DB_USER 行："
    grep "^DB_USER=" .env || echo "未找到 DB_USER"
    echo ""
    echo "DB_PASSWORD 行（隐藏密码）："
    grep "^DB_PASSWORD=" .env | sed 's/=.*/=***/' || echo "未找到 DB_PASSWORD"
    echo ""
    
    # 尝试不同的读取方式
    echo "方法1（当前脚本使用）："
    DB_USER1=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
    echo "  DB_USER1: [$DB_USER1]"
    echo ""
    
    echo "方法2（使用 awk）："
    DB_USER2=$(grep "^DB_USER=" .env | awk -F'=' '{print $2}' | tr -d ' ' | tr -d '"' | tr -d "'")
    echo "  DB_USER2: [$DB_USER2]"
    echo ""
    
    echo "方法3（使用 sed）："
    DB_USER3=$(grep "^DB_USER=" .env | sed 's/^DB_USER=//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | sed 's/^"//' | sed 's/"$//' | sed "s/^'//" | sed "s/'$//")
    echo "  DB_USER3: [$DB_USER3]"
    echo ""
    
    echo "方法4（直接 source）："
    set -a
    source .env 2>/dev/null || true
    set +a
    echo "  DB_USER4: [${DB_USER:-未设置}]"
    echo ""
    
    # 检查是否有特殊字符
    echo "DB_USER 行的原始内容（十六进制）："
    grep "^DB_USER=" .env | od -An -tx1 | head -1
    echo ""
    
else
    echo "❌ 未找到 .env 文件"
fi

