#!/bin/bash

# piccco3 完整项目备份脚本（打包为 ZIP 并上传到云存储）
# 使用方法: ./backup_full_project.sh

# 配置
PROJECT_DIR="/www/wwwroot/piccco3"
BACKUP_BASE_DIR="/root/piccco3-backups"
BACKUP_NAME="piccco3-full-backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_BASE_DIR}/${BACKUP_NAME}.zip"
LOG_FILE="${BACKUP_BASE_DIR}/full-backup.log"

# 云存储配置（可选）
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-hangzhou.aliyuncs.com}"
OSS_BUCKET="${OSS_BUCKET:-your-bucket-name}"
OSS_ACCESS_KEY_ID="${OSS_ACCESS_KEY_ID:-}"
OSS_ACCESS_KEY_SECRET="${OSS_ACCESS_KEY_SECRET:-}"
OSS_PATH="piccco3-full-backups/"
CLOUD_STORAGE_TYPE="${CLOUD_STORAGE_TYPE:-none}"  # oss, cos, none

# 创建备份目录
mkdir -p "${BACKUP_BASE_DIR}"

# 记录日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "=========================================="
log "开始完整项目备份"
log "=========================================="

# 检查项目目录是否存在
if [ ! -d "${PROJECT_DIR}" ]; then
    log "错误: 项目目录不存在: ${PROJECT_DIR}"
    exit 1
fi

# 创建临时目录
TEMP_DIR=$(mktemp -d)
log "临时目录: ${TEMP_DIR}"

# 复制项目文件（排除不需要的文件）
log "正在复制项目文件..."
cd "${PROJECT_DIR}"

# 使用 rsync 或 cp 复制，排除不需要的目录
rsync -av --progress \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='.vite' \
    --exclude='*.log' \
    --exclude='*.tmp' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    --exclude='*.swp' \
    --exclude='*.swo' \
    --exclude='.env' \
    --exclude='backend/data' \
    --exclude='.user.ini' \
    --exclude='.htaccess' \
    . "${TEMP_DIR}/piccco3" 2>&1 | tee -a "${LOG_FILE}"

if [ $? -ne 0 ]; then
    log "警告: rsync 可能未安装，使用 cp 替代..."
    # 如果 rsync 不可用，使用 find + cp
    find . -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/.git/*" \
        ! -path "*/.vite/*" \
        ! -name "*.log" \
        ! -name "*.tmp" \
        ! -name ".DS_Store" \
        ! -name "Thumbs.db" \
        ! -name "*.swp" \
        ! -name "*.swo" \
        ! -name ".env" \
        ! -path "*/backend/data/*" \
        ! -name ".user.ini" \
        ! -name ".htaccess" \
        -exec cp --parents {} "${TEMP_DIR}/piccco3/" \; 2>/dev/null
fi

# 创建备份信息文件
cat > "${TEMP_DIR}/piccco3/BACKUP_INFO.txt" << EOF
piccco3 完整项目备份
====================

备份日期: $(date '+%Y-%m-%d %H:%M:%S')
备份类型: 完整项目备份
Git 提交: $(cd "${PROJECT_DIR}" && git rev-parse HEAD 2>/dev/null || echo "N/A")
Git 分支: $(cd "${PROJECT_DIR}" && git branch --show-current 2>/dev/null || echo "N/A")
服务器: $(hostname)
系统: $(uname -a)

包含内容:
- 前端源代码
- 后端源代码
- 配置文件
- 工具脚本
- 文档

排除内容:
- node_modules (可通过 npm install 恢复)
- dist (构建产物，可通过 npm run build 恢复)
- .git (Git 历史，已保存在 GitHub)
- backend/data (用户数据，需单独备份)

恢复说明:
1. 解压 ZIP 文件
2. 运行 npm install (前端和后端)
3. 运行 npm run build (前端)
4. 配置 .env 文件
5. 恢复用户数据（从数据备份）

EOF

# 打包为 ZIP
log ""
log "正在打包为 ZIP 文件..."
cd "${TEMP_DIR}"
zip -r "${BACKUP_FILE}" piccco3 -q

if [ $? -ne 0 ]; then
    log "错误: ZIP 打包失败"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# 清理临时目录
rm -rf "${TEMP_DIR}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "✓ ZIP 打包成功！"
log "备份文件: ${BACKUP_FILE}"
log "备份大小: ${BACKUP_SIZE}"

# 上传到云存储
if [ "${CLOUD_STORAGE_TYPE}" = "oss" ]; then
    log ""
    log "开始上传到阿里云 OSS..."
    
    if ! command -v ossutil &> /dev/null; then
        log "警告: ossutil 未安装，跳过云存储上传"
        log "安装 ossutil: wget http://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64 -O /usr/local/bin/ossutil && chmod 755 /usr/local/bin/ossutil"
    else
        if [ -n "${OSS_ACCESS_KEY_ID}" ] && [ -n "${OSS_ACCESS_KEY_SECRET}" ]; then
            export OSS_ACCESS_KEY_ID
            export OSS_ACCESS_KEY_SECRET
            ossutil cp "${BACKUP_FILE}" "oss://${OSS_BUCKET}/${OSS_PATH}${BACKUP_NAME}.zip" \
                --endpoint="${OSS_ENDPOINT}"
        else
            ossutil cp "${BACKUP_FILE}" "oss://${OSS_BUCKET}/${OSS_PATH}${BACKUP_NAME}.zip"
        fi
        
        if [ $? -eq 0 ]; then
            log "✓ 上传到阿里云 OSS 成功！"
            log "OSS 路径: oss://${OSS_BUCKET}/${OSS_PATH}${BACKUP_NAME}.zip"
        else
            log "✗ 上传到阿里云 OSS 失败！"
        fi
    fi

elif [ "${CLOUD_STORAGE_TYPE}" = "cos" ]; then
    log ""
    log "开始上传到腾讯云 COS..."
    
    if ! command -v coscli &> /dev/null; then
        log "警告: coscli 未安装，跳过云存储上传"
    else
        if [ -n "${COS_SECRET_ID}" ] && [ -n "${COS_SECRET_KEY}" ]; then
            export COS_SECRET_ID
            export COS_SECRET_KEY
            coscli cp "${BACKUP_FILE}" "cos://${COS_BUCKET}/${COS_PATH}${BACKUP_NAME}.zip" \
                --region="${COS_REGION}"
            
            if [ $? -eq 0 ]; then
                log "✓ 上传到腾讯云 COS 成功！"
            else
                log "✗ 上传到腾讯云 COS 失败！"
            fi
        fi
    fi

else
    log ""
    log "跳过云存储上传（CLOUD_STORAGE_TYPE=${CLOUD_STORAGE_TYPE}）"
    log "提示: 可以手动上传 ${BACKUP_FILE} 到云存储"
fi

# 清理旧备份（保留最近7天的完整备份）
log ""
log "清理7天前的完整备份..."
find "${BACKUP_BASE_DIR}" -name "piccco3-full-backup-*.zip" -type f -mtime +7 -delete
log "清理完成"

log ""
log "=========================================="
log "备份完成！"
log "=========================================="
log ""
log "本地备份文件: ${BACKUP_FILE}"
log "备份大小: ${BACKUP_SIZE}"
log "备份目录: ${BACKUP_BASE_DIR}"
log ""
log "查看所有备份文件:"
ls -lh "${BACKUP_BASE_DIR}"/*.zip 2>/dev/null | tail -5

