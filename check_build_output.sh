#!/bin/bash
# 检查构建输出的完整信息

cd /www/wwwroot/piccco3

python3 << 'ENDOFSCRIPT'
import subprocess
import os

os.chdir('/www/wwwroot/piccco3')

print("=" * 70)
print("检查构建输出的完整信息")
print("=" * 70)

# 运行构建并捕获所有输出
result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)

print("\n标准输出 (stdout):")
print("-" * 70)
print(result.stdout)

print("\n错误输出 (stderr):")
print("-" * 70)
print(result.stderr)

print("\n" + "=" * 70)
print(f"退出码: {result.returncode}")
print("=" * 70)

# 检查是否有其他类型的错误
all_output = result.stdout + result.stderr
lines = all_output.split('\n')

# 查找错误关键词
error_keywords = ['error', 'Error', 'ERROR', 'failed', 'Failed', 'FAILED', 'warning', 'Warning']
error_lines = [line for line in lines if any(keyword in line for keyword in error_keywords)]

if error_lines:
    print(f"\n发现 {len(error_lines)} 行包含错误/警告:")
    for i, line in enumerate(error_lines[:30], 1):
        print(f"  {i}. {line}")

# 检查 dist 目录
if os.path.exists('dist'):
    print("\n✓ dist 目录存在")
    import os
    files = os.listdir('dist')
    print(f"  包含 {len(files)} 个文件/目录")
    for item in files[:10]:
        print(f"    - {item}")
else:
    print("\n✗ dist 目录不存在，构建可能未完成")

ENDOFSCRIPT







