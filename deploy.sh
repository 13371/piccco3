#!/bin/bash

# ==========================================
# Piccco3 完整部署脚本
# ==========================================
# 功能：
#   1. 从 Git 拉取最新代码
#   2. 安装依赖（前端和后端）
#   3. 构建前端
#   4. 重启后端服务
#   5. 重载 Nginx
# ==========================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量（根据实际情况修改）
PROJECT_DIR="/www/wwwroot/piccco3"
BACKEND_DIR="$PROJECT_DIR/backend"
GIT_BRANCH="main"
GIT_REPO="https://github.com/13371/piccco3.git"

# 函数：打印信息
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 函数：检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        error "$1 未安装，请先安装"
        exit 1
    fi
}

# 函数：检查目录是否存在
check_directory() {
    if [ ! -d "$1" ]; then
        error "目录不存在: $1"
        exit 1
    fi
}

echo "=========================================="
echo "Piccco3 完整部署脚本"
echo "=========================================="
echo ""

# 1. 检查必需的命令
info "检查必需的命令..."
check_command "node"
check_command "npm"
check_command "pm2"
check_command "git"
check_command "nginx"

# 2. 检查项目目录
info "检查项目目录..."
if [ ! -d "$PROJECT_DIR" ]; then
    warn "项目目录不存在，正在创建..."
    mkdir -p "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    
    # 克隆代码
    info "正在克隆代码..."
    git clone "$GIT_REPO" .
else
    cd "$PROJECT_DIR"
    
    # 检查是否是 Git 仓库
    if [ ! -d ".git" ]; then
        error "项目目录不是 Git 仓库"
        exit 1
    fi
    
    # 拉取最新代码
    info "正在拉取最新代码..."
    git fetch origin
    git checkout "$GIT_BRANCH"
    git pull origin "$GIT_BRANCH"
fi

# 3. 安装前端依赖
info "检查前端依赖..."
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    info "安装前端依赖..."
    npm install --production=false
else
    info "前端依赖已是最新"
fi

# 4. 安装后端依赖
info "检查后端依赖..."
if [ ! -d "$BACKEND_DIR/node_modules" ] || [ "$BACKEND_DIR/package.json" -nt "$BACKEND_DIR/node_modules" ]; then
    info "安装后端依赖..."
    cd "$BACKEND_DIR"
    npm install --production=false
    cd "$PROJECT_DIR"
else
    info "后端依赖已是最新"
fi

# 5. 检查后端环境变量
info "检查后端环境变量..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    error "后端 .env 文件不存在！"
    error "请先创建 $BACKEND_DIR/.env 文件并配置环境变量"
    exit 1
fi

# 6. 构建前端
info "构建前端..."
cd "$PROJECT_DIR"

# 清理旧的构建文件
if [ -d "dist" ]; then
    info "清理旧的构建文件..."
    rm -rf dist
fi

# 构建前端（设置 API 基础 URL）
info "正在构建前端..."
VITE_API_BASE_URL=/api npm run build

if [ $? -eq 0 ]; then
    info "前端构建成功"
    
    # 设置文件权限
    info "设置文件权限..."
    chmod -R 755 dist
    
    # 如果使用宝塔面板，设置用户组
    if id "www" &>/dev/null; then
        chown -R www:www dist
    fi
else
    error "前端构建失败"
    exit 1
fi

# 7. 重启后端服务
info "重启后端服务..."
cd "$BACKEND_DIR"

# 检查 PM2 服务是否存在
if pm2 list | grep -q "piccco-backend"; then
    info "重启现有服务..."
    pm2 restart piccco-backend --update-env
else
    info "启动新服务..."
    pm2 start src/server.js --name piccco-backend
    pm2 save
    
    # 设置开机自启（如果未设置）
    if ! pm2 startup | grep -q "already"; then
        info "设置 PM2 开机自启..."
        pm2 startup
    fi
fi

# 检查服务状态
sleep 2
if pm2 list | grep -q "piccco-backend.*online"; then
    info "后端服务运行正常"
else
    error "后端服务启动失败，请检查日志: pm2 logs piccco-backend"
    exit 1
fi

# 8. 重载 Nginx
info "重载 Nginx..."
if nginx -t > /dev/null 2>&1; then
    nginx -s reload
    if [ $? -eq 0 ]; then
        info "Nginx 已重载"
    else
        warn "Nginx 重载失败，请手动检查"
    fi
else
    error "Nginx 配置有误，请先修复: nginx -t"
    exit 1
fi

# 9. 显示部署结果
echo ""
echo "=========================================="
echo -e "${GREEN}✓ 部署完成！${NC}"
echo "=========================================="
echo ""
echo "服务状态："
pm2 status piccco-backend
echo ""
echo "访问地址："
echo "  - 前端: http://8.136.38.126"
echo "  - 管理员: http://8.136.38.126/admin"
echo "  - API健康检查: http://8.136.38.126/api/health"
echo ""
echo "常用命令："
echo "  - 查看PM2状态: pm2 status"
echo "  - 查看后端日志: pm2 logs piccco-backend"
echo "  - 重启后端: pm2 restart piccco-backend"
echo "  - 重载Nginx: nginx -s reload"
echo ""

