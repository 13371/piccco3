#!/bin/bash

# 配置 PostgreSQL 慢查询日志脚本
# 使用方法：bash scripts/configure-slow-query-log.sh

set -e

echo "🔧 配置 PostgreSQL 慢查询日志..."
echo ""

# 查找 postgresql.conf 文件
POSTGRESQL_CONF=""

# 尝试常见路径
POSSIBLE_PATHS=(
  "/www/server/pgsql/data/postgresql.conf"
  "/etc/postgresql/*/main/postgresql.conf"
  "/var/lib/pgsql/data/postgresql.conf"
  "/usr/local/pgsql/data/postgresql.conf"
)

for path in "${POSSIBLE_PATHS[@]}"; do
  if [ -f "$path" ] || [ -n "$(find $(dirname "$path" 2>/dev/null) -name "postgresql.conf" 2>/dev/null | head -1)" ]; then
    if [ -f "$path" ]; then
      POSTGRESQL_CONF="$path"
      break
    else
      # 处理通配符路径
      found=$(find $(dirname "$path" 2>/dev/null) -name "postgresql.conf" 2>/dev/null | head -1)
      if [ -n "$found" ]; then
        POSTGRESQL_CONF="$found"
        break
      fi
    fi
  fi
done

# 如果还是找不到，尝试使用 find 命令
if [ -z "$POSTGRESQL_CONF" ]; then
  POSTGRESQL_CONF=$(find /www/server/pgsql -name "postgresql.conf" 2>/dev/null | head -1)
fi

if [ -z "$POSTGRESQL_CONF" ]; then
  echo "❌ 错误: 未找到 postgresql.conf 文件"
  echo ""
  echo "请手动查找配置文件："
  echo "  find /www/server/pgsql -name postgresql.conf"
  echo "  find /etc -name postgresql.conf"
  exit 1
fi

echo "📋 找到配置文件: $POSTGRESQL_CONF"
echo ""

# 备份配置文件
BACKUP_FILE="${POSTGRESQL_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$POSTGRESQL_CONF" "$BACKUP_FILE"
echo "✅ 已备份配置文件到: $BACKUP_FILE"
echo ""

# 检查是否已配置
if grep -q "^log_min_duration_statement" "$POSTGRESQL_CONF"; then
  echo "⚠️  检测到已存在 log_min_duration_statement 配置"
  echo "   当前值:"
  grep "^log_min_duration_statement" "$POSTGRESQL_CONF" || grep "^#log_min_duration_statement" "$POSTGRESQL_CONF"
  echo ""
  read -p "是否要更新配置？(y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
  fi
  # 注释掉旧配置
  sed -i 's/^log_min_duration_statement/#log_min_duration_statement/g' "$POSTGRESQL_CONF"
fi

# 添加配置
echo "📝 添加慢查询日志配置..."

# 检查是否有 CUSTOMIZED OPTIONS 部分
if grep -q "# CUSTOMIZED OPTIONS" "$POSTGRESQL_CONF"; then
  # 在 CUSTOMIZED OPTIONS 后添加
  sed -i '/# CUSTOMIZED OPTIONS/a\
\
# ============================================\
# 慢查询日志配置\
# ============================================\
# 记录执行时间超过 300 毫秒的查询\
log_min_duration_statement = 300\
\
# 记录查询参数（有助于调试）\
log_parameter_max_length = 0\
\
# 日志格式（包含时间、进程、用户、数据库等信息）\
log_line_prefix = '\''%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '\''
' "$POSTGRESQL_CONF"
else
  # 在文件末尾添加
  cat >> "$POSTGRESQL_CONF" << 'EOF'

# ============================================
# 慢查询日志配置
# ============================================
# 记录执行时间超过 300 毫秒的查询
log_min_duration_statement = 300

# 记录查询参数（有助于调试）
log_parameter_max_length = 0

# 日志格式（包含时间、进程、用户、数据库等信息）
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
EOF
fi

echo "✅ 配置已添加"
echo ""

# 验证配置
echo "🔍 验证配置..."
if grep -q "^log_min_duration_statement = 300" "$POSTGRESQL_CONF"; then
  echo "✅ 配置验证成功"
  echo ""
  echo "📋 添加的配置："
  grep -A 10 "慢查询日志配置" "$POSTGRESQL_CONF" | head -15
else
  echo "⚠️  配置验证失败，请手动检查"
fi

echo ""
echo "📝 下一步："
echo "   1. 重启 PostgreSQL 服务使配置生效"
echo "   2. 在宝塔面板中重启，或执行："
echo "      /etc/init.d/postgresql restart"
echo ""
echo "   3. 查看慢查询日志："
echo "      tail -f /www/server/pgsql/logs/postgresql-*.log | grep duration"
echo ""


