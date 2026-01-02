#!/bin/bash

# piccco3 服务状态检查脚本
# 使用方法: ./check_services.sh

echo "=========================================="
echo "piccco3 服务状态检查"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查 Nginx 状态
echo "1. 检查 Nginx 服务状态..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx 服务运行中${NC}"
    nginx -v 2>&1 | head -1
else
    echo -e "${RED}✗ Nginx 服务未运行${NC}"
fi
echo ""

# 2. 检查后端服务状态
echo "2. 检查后端服务状态 (PM2)..."
if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 list | grep piccco-backend || echo "")
    if [ -n "$PM2_STATUS" ]; then
        echo -e "${GREEN}✓ 后端服务已配置${NC}"
        pm2 list | grep piccco-backend
    else
        echo -e "${RED}✗ 后端服务未找到${NC}"
    fi
else
    echo -e "${YELLOW}⚠ PM2 未安装${NC}"
fi
echo ""

# 3. 检查端口监听情况
echo "3. 检查端口监听情况..."
echo "端口 80 (HTTP):"
if netstat -tlnp 2>/dev/null | grep -q ":80 " || ss -tlnp 2>/dev/null | grep -q ":80 "; then
    echo -e "${GREEN}✓ 端口 80 正在监听${NC}"
    netstat -tlnp 2>/dev/null | grep ":80 " || ss -tlnp 2>/dev/null | grep ":80 "
else
    echo -e "${RED}✗ 端口 80 未监听${NC}"
fi
echo ""

echo "端口 4000 (后端 API):"
if netstat -tlnp 2>/dev/null | grep -q ":4000 " || ss -tlnp 2>/dev/null | grep -q ":4000 "; then
    echo -e "${GREEN}✓ 端口 4000 正在监听${NC}"
    netstat -tlnp 2>/dev/null | grep ":4000 " || ss -tlnp 2>/dev/null | grep ":4000 "
else
    echo -e "${RED}✗ 端口 4000 未监听${NC}"
fi
echo ""

# 4. 检查前端文件
echo "4. 检查前端文件..."
FRONTEND_DIR="/www/wwwroot/piccco3/dist"
if [ -d "$FRONTEND_DIR" ]; then
    if [ -f "$FRONTEND_DIR/index.html" ]; then
        echo -e "${GREEN}✓ 前端文件存在${NC}"
        echo "  目录: $FRONTEND_DIR"
        echo "  文件大小: $(du -sh $FRONTEND_DIR | cut -f1)"
        echo "  文件数量: $(find $FRONTEND_DIR -type f | wc -l)"
    else
        echo -e "${RED}✗ index.html 不存在${NC}"
    fi
else
    echo -e "${RED}✗ 前端目录不存在${NC}"
fi
echo ""

# 5. 检查后端文件
echo "5. 检查后端文件..."
BACKEND_DIR="/www/wwwroot/piccco3/backend"
if [ -d "$BACKEND_DIR" ]; then
    if [ -f "$BACKEND_DIR/src/server.js" ]; then
        echo -e "${GREEN}✓ 后端文件存在${NC}"
        echo "  目录: $BACKEND_DIR"
        echo "  文件大小: $(du -sh $BACKEND_DIR | cut -f1)"
    else
        echo -e "${RED}✗ server.js 不存在${NC}"
    fi
else
    echo -e "${RED}✗ 后端目录不存在${NC}"
fi
echo ""

# 6. 测试本地 API 连接
echo "6. 测试后端 API 连接..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:4000/api/auth/me 2>/dev/null)
if [ "$API_RESPONSE" = "401" ] || [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ 后端 API 可访问 (HTTP $API_RESPONSE)${NC}"
else
    echo -e "${RED}✗ 后端 API 无法访问 (HTTP $API_RESPONSE)${NC}"
fi
echo ""

# 7. 测试通过 Nginx 访问前端
echo "7. 测试通过 Nginx 访问前端..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: 8.136.38.126" --max-time 5 http://127.0.0.1/ 2>/dev/null)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ 前端可通过 Nginx 访问 (HTTP $FRONTEND_RESPONSE)${NC}"
else
    echo -e "${RED}✗ 前端无法通过 Nginx 访问 (HTTP $FRONTEND_RESPONSE)${NC}"
fi
echo ""

# 8. 测试通过 Nginx 访问 API
echo "8. 测试通过 Nginx 访问 API..."
API_PROXY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: 8.136.38.126" --max-time 5 http://127.0.0.1/api/auth/me 2>/dev/null)
if [ "$API_PROXY_RESPONSE" = "401" ] || [ "$API_PROXY_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ API 可通过 Nginx 代理访问 (HTTP $API_PROXY_RESPONSE)${NC}"
else
    echo -e "${RED}✗ API 无法通过 Nginx 代理访问 (HTTP $API_PROXY_RESPONSE)${NC}"
fi
echo ""

# 9. 检查 Nginx 配置
echo "9. 检查 Nginx 配置..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx 配置语法正确${NC}"
else
    echo -e "${RED}✗ Nginx 配置有错误${NC}"
    nginx -t
fi
echo ""

# 10. 检查数据目录
echo "10. 检查数据目录..."
DATA_DIR="/www/wwwroot/piccco3/backend/data"
if [ -d "$DATA_DIR" ]; then
    echo -e "${GREEN}✓ 数据目录存在${NC}"
    echo "  目录: $DATA_DIR"
    echo "  大小: $(du -sh $DATA_DIR | cut -f1)"
    echo "  文件:"
    ls -lh $DATA_DIR/*.json 2>/dev/null | awk '{print "    " $9 " (" $5 ")"}'
else
    echo -e "${RED}✗ 数据目录不存在${NC}"
fi
echo ""

# 11. 检查后端日志（最近错误）
echo "11. 检查后端日志（最近5条）..."
if command -v pm2 &> /dev/null; then
    PM2_LOGS=$(pm2 logs piccco-backend --lines 5 --nostream 2>/dev/null | tail -5)
    if [ -n "$PM2_LOGS" ]; then
        echo "最近日志:"
        echo "$PM2_LOGS" | head -5
    else
        echo -e "${YELLOW}⚠ 无法获取日志${NC}"
    fi
fi
echo ""

# 12. 检查系统资源
echo "12. 检查系统资源..."
echo "CPU 使用率:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "  " 100 - $1 "%"}'
echo "内存使用:"
free -h | grep Mem | awk '{print "  总内存: " $2 ", 已用: " $3 ", 可用: " $7}'
echo "磁盘使用:"
df -h / | tail -1 | awk '{print "  总容量: " $2 ", 已用: " $3 " (" $5 "), 可用: " $4}'
echo ""

echo "=========================================="
echo "检查完成！"
echo "=========================================="



















