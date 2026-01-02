# 测试CORS配置
Write-Host "测试后端CORS配置..."
Write-Host ""

# 测试OPTIONS预检请求
$headers = @{
    "Origin" = "http://192.168.0.9:5173"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "Content-Type"
}

try {
    $response = Invoke-WebRequest -Uri "http://192.168.0.9:4000/api/auth/login" -Method OPTIONS -Headers $headers -UseBasicParsing
    Write-Host "✓ OPTIONS请求成功" -ForegroundColor Green
    Write-Host "状态码: $($response.StatusCode)"
    Write-Host "CORS头:"
    $response.Headers | Where-Object { $_ -like "*Access-Control*" } | ForEach-Object { Write-Host "  $_" }
} catch {
    Write-Host "✗ OPTIONS请求失败" -ForegroundColor Red
    Write-Host "错误: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "测试POST请求..."
try {
    $body = @{
        email = "test@example.com"
        password = "test"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://192.168.0.9:4000/api/auth/login" -Method POST -Body $body -ContentType "application/json" -Headers @{"Origin" = "http://192.168.0.9:5173"} -UseBasicParsing
    Write-Host "✓ POST请求成功" -ForegroundColor Green
    Write-Host "状态码: $($response.StatusCode)"
} catch {
    Write-Host "✗ POST请求失败" -ForegroundColor Red
    Write-Host "状态码: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "错误: $($_.Exception.Message)"
}

















