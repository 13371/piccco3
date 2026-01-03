# 🚀 v1.172 立即部署步骤

## 快速部署命令

在服务器上执行以下命令：

```bash
cd /www/wwwroot/piccco3 && ./deploy.sh
```

或者使用快速部署：

```bash
cd /www/wwwroot/piccco3 && ./quick_deploy.sh
```

---

## 一键部署命令（复制粘贴）

```bash
cd /www/wwwroot/piccco3 && git pull origin main && npm install && cd backend && npm install && cd .. && rm -rf dist && VITE_API_BASE_URL=/api npm run build && chmod -R 755 dist && chown -R www:www dist && pm2 restart piccco-backend --update-env && nginx -s reload && echo "部署完成！" && pm2 status piccco-backend
```

---

## 部署后验证

```bash
# 检查服务状态
pm2 status piccco-backend

# 检查健康检查
curl http://localhost:4000/api/health

# 查看最新日志
pm2 logs piccco-backend --lines 20
```

---

**版本**: v1.172（测试版）  
**提交**: e7a6327






