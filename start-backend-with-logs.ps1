# 启动后端服务器并显示日志
# 使用方法：在 PowerShell 中运行 .\start-backend-with-logs.ps1

Write-Host "正在停止现有的 Node.js 进程..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "`n=== 启动后端服务器（前台模式）===" -ForegroundColor Cyan
Write-Host "日志将直接显示在下方" -ForegroundColor Green
Write-Host "执行删除操作时，会看到如下格式的日志：" -ForegroundColor Green
Write-Host "  删除后 folders = [ ... ]" -ForegroundColor Gray
Write-Host "`n按 Ctrl+C 可停止服务器`n" -ForegroundColor Yellow

Set-Location backend
node src/server.js






