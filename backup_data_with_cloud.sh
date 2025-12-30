#!/bin/bash

# piccco3 数据备份脚本（支持云存储上传）
# 使用方法: ./backup_data_with_cloud.sh

# 配置
PROJECT_DIR="/www/wwwroot/piccco3"
DATA_DIR="${PROJECT_DIR}/backend/data"
BACKUP_BASE_DIR="/root/piccco3-backups"
BACKUP_NAME="piccco3-data-$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_BASE_DIR}/${BACKUP_NAME}.tar.gz"
LOG_FILE="${BACKUP_BASE_DIR}/backup.log"

# 云存储配置（在脚本中配置，或从环境变量读取）
# 阿里云 OSS 配置
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-hangzhou.aliyuncs.com}"  # 修改为你的 OSS Endpoint
OSS_BUCKET="${OSS_BUCKET:-your-bucket-name}"  # 修改为你的 Bucket 名称
OSS_ACCESS_KEY_ID="${OSS_ACCESS_KEY_ID:-}"  # 从环境变量读取，或在这里填写
OSS_ACCESS_KEY_SECRET="${OSS_ACCESS_KEY_SECRET:-}"  # 从环境变量读取，或在这里填写
OSS_PATH="piccco3-backups/"  # OSS 中的路径

# 腾讯云 COS 配置（如果使用腾讯云）
COS_REGION="${COS_REGION:-ap-guangzhou}"  # 修改为你的区域
COS_BUCKET="${COS_BUCKET:-your-bucket-name}"  # 修改为你的 Bucket 名称
COS_SECRET_ID="${COS_SECRET_ID:-}"  # 从环境变量读取
COS_SECRET_KEY="${COS_SECRET_KEY:-}"  # 从环境变量读取
COS_PATH="piccco3-backups/"  # COS 中的路径

# 云存储类型：oss（阿里云）、cos（腾讯云）、none（不上传）
CLOUD_STORAGE_TYPE="${CLOUD_STORAGE_TYPE:-none}"

# 创建备份目录
mkdir -p "${BACKUP_BASE_DIR}"

# 记录日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "=========================================="
log "开始备份 piccco3 数据"
log "=========================================="

# 检查数据目录是否存在
if [ ! -d "${DATA_DIR}" ]; then
    log "错误: 数据目录不存在: ${DATA_DIR}"
    exit 1
fi

# 执行本地备份
log "备份源目录: ${DATA_DIR}"
log "备份目标文件: ${BACKUP_FILE}"

tar -czf "${BACKUP_FILE}" -C "${PROJECT_DIR}/backend" data

if [ $? -ne 0 ]; then
    log "✗ 本地备份失败！"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "✓ 本地备份成功！"
log "备份文件: ${BACKUP_FILE}"
log "备份大小: ${BACKUP_SIZE}"

# 上传到云存储
if [ "${CLOUD_STORAGE_TYPE}" = "oss" ]; then
    log ""
    log "开始上传到阿里云 OSS..."
    
    # 检查 ossutil 是否安装
    if ! command -v ossutil &> /dev/null; then
        log "警告: ossutil 未安装，跳过云存储上传"
        log "安装 ossutil: wget http://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64 -O /usr/local/bin/ossutil && chmod 755 /usr/local/bin/ossutil"
    else
        # 配置 ossutil（如果未配置）
        if [ ! -f ~/.ossutilconfig ]; then
            log "首次使用，需要配置 ossutil"
            log "请运行: ossutil config"
            log "或设置环境变量: OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET"
        fi
        
        # 上传文件
        if [ -n "${OSS_ACCESS_KEY_ID}" ] && [ -n "${OSS_ACCESS_KEY_SECRET}" ]; then
            # 使用环境变量配置
            export OSS_ACCESS_KEY_ID
            export OSS_ACCESS_KEY_SECRET
            ossutil cp "${BACKUP_FILE}" "oss://${OSS_BUCKET}/${OSS_PATH}${BACKUP_NAME}.tar.gz" \
                --endpoint="${OSS_ENDPOINT}"
        else
            # 使用配置文件
            ossutil cp "${BACKUP_FILE}" "oss://${OSS_BUCKET}/${OSS_PATH}${BACKUP_NAME}.tar.gz"
        fi
        
        if [ $? -eq 0 ]; then
            log "✓ 上传到阿里云 OSS 成功！"
            log "OSS 路径: oss://${OSS_BUCKET}/${OSS_PATH}${BACKUP_NAME}.tar.gz"
        else
            log "✗ 上传到阿里云 OSS 失败！"
        fi
    fi

elif [ "${CLOUD_STORAGE_TYPE}" = "cos" ]; then
    log ""
    log "开始上传到腾讯云 COS..."
    
    # 检查 coscli 是否安装
    if ! command -v coscli &> /dev/null; then
        log "警告: coscli 未安装，跳过云存储上传"
        log "安装 coscli: https://cloud.tencent.com/document/product/436/63143"
    else
        # 上传文件
        if [ -n "${COS_SECRET_ID}" ] && [ -n "${COS_SECRET_KEY}" ]; then
            export COS_SECRET_ID
            export COS_SECRET_KEY
            coscli cp "${BACKUP_FILE}" "cos://${COS_BUCKET}/${COS_PATH}${BACKUP_NAME}.tar.gz" \
                --region="${COS_REGION}"
        else
            log "警告: 未设置 COS_SECRET_ID 和 COS_SECRET_KEY，跳过上传"
        fi
        
        if [ $? -eq 0 ]; then
            log "✓ 上传到腾讯云 COS 成功！"
            log "COS 路径: cos://${COS_BUCKET}/${COS_PATH}${BACKUP_NAME}.tar.gz"
        else
            log "✗ 上传到腾讯云 COS 失败！"
        fi
    fi

elif [ "${CLOUD_STORAGE_TYPE}" = "none" ]; then
    log ""
    log "跳过云存储上传（CLOUD_STORAGE_TYPE=none）"
else
    log ""
    log "警告: 未知的云存储类型: ${CLOUD_STORAGE_TYPE}"
    log "支持的类型: oss（阿里云）、cos（腾讯云）、none（不上传）"
fi

# 清理旧备份（保留最近30天的本地备份）
log ""
log "清理30天前的本地备份..."
find "${BACKUP_BASE_DIR}" -name "piccco3-data-*.tar.gz" -type f -mtime +30 -delete
log "清理完成"

log ""
log "=========================================="
log "备份完成！"
log "=========================================="
log ""
log "本地备份文件: ${BACKUP_FILE}"
log "备份目录: ${BACKUP_BASE_DIR}"
log ""
log "查看所有备份文件:"
ls -lh "${BACKUP_BASE_DIR}"/*.tar.gz 2>/dev/null | tail -5


