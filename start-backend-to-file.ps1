# 启动后端服务器并将日志输出到文件
# 使用方法：在 PowerShell 中运行 .\start-backend-to-file.ps1
# 日志文件：backend\server.log

Write-Host "正在停止现有的 Node.js 进程..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "`n=== 启动后端服务器（日志输出到文件）===" -ForegroundColor Cyan
Write-Host "日志文件：backend\server.log" -ForegroundColor Green
Write-Host "可以使用以下命令实时查看日志：" -ForegroundColor Green
Write-Host "  Get-Content backend\server.log -Tail 50 -Wait" -ForegroundColor Gray
Write-Host "`n服务器在后台运行，按任意键停止...`n" -ForegroundColor Yellow

Set-Location backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node src/server.js 2>&1 | Tee-Object -FilePath server.log"

Write-Host "服务器已启动，日志正在写入 backend\server.log" -ForegroundColor Green
Write-Host "要查看实时日志，请在新窗口中运行：" -ForegroundColor Yellow
Write-Host "  Get-Content backend\server.log -Tail 50 -Wait" -ForegroundColor Gray






