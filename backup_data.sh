#!/bin/bash

# piccco3 数据备份脚本
# 使用方法: ./backup_data.sh

# 配置
PROJECT_DIR="/www/wwwroot/piccco3"
DATA_DIR="${PROJECT_DIR}/backend/data"
BACKUP_BASE_DIR="/root/piccco3-backups"  # 备份文件存放目录
BACKUP_NAME="piccco3-data-$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_BASE_DIR}/${BACKUP_NAME}.tar.gz"
LOG_FILE="${BACKUP_BASE_DIR}/backup.log"

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

# 执行备份
log "备份源目录: ${DATA_DIR}"
log "备份目标文件: ${BACKUP_FILE}"

tar -czf "${BACKUP_FILE}" -C "${PROJECT_DIR}/backend" data

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "✓ 备份成功！"
    log "备份文件: ${BACKUP_FILE}"
    log "备份大小: ${BACKUP_SIZE}"
    
    # 清理旧备份（保留最近30天的备份）
    log "清理30天前的旧备份..."
    find "${BACKUP_BASE_DIR}" -name "piccco3-data-*.tar.gz" -type f -mtime +30 -delete
    log "清理完成"
    
    log "=========================================="
    log "备份完成！"
    log "=========================================="
    log ""
    log "备份文件位置: ${BACKUP_FILE}"
    log "备份目录: ${BACKUP_BASE_DIR}"
    log ""
    log "查看所有备份文件:"
    ls -lh "${BACKUP_BASE_DIR}"/*.tar.gz 2>/dev/null | tail -5
    log ""
else
    log "✗ 备份失败！"
    exit 1
fi


