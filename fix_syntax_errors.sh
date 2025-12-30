#!/bin/bash
# 修复语法错误脚本

cd /www/wwwroot/piccco3

python3 << 'ENDOFSCRIPT'
import os
import re
import subprocess

os.chdir('/www/wwwroot/piccco3')

print("=" * 70)
print("修复语法错误")
print("=" * 70)

def check_and_fix_syntax(filepath):
    print(f"\n{'='*70}")
    print(f"检查并修复 {filepath}")
    print(f"{'='*70}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"文件总行数: {len(lines)}")
    
    # 先运行一次构建，获取具体错误
    result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)
    errors = []
    for line in result.stderr.split('\n'):
        if filepath in line and 'error TS1005' in line:
            # 提取行号和错误信息
            match = re.search(r'\((\d+),(\d+)\): error TS1005: (.+)', line)
            if match:
                line_num = int(match.group(1)) - 1  # 转换为0-based
                col_num = int(match.group(2))
                error_msg = match.group(3)
                errors.append((line_num, col_num, error_msg))
    
    if not errors:
        print(f"  ✓ 没有发现 {filepath} 的语法错误")
        return True
    
    print(f"\n发现 {len(errors)} 个语法错误:")
    for line_num, col_num, error_msg in errors[:10]:
        if line_num < len(lines):
            print(f"  第 {line_num + 1} 行, 第 {col_num} 列: {error_msg}")
            print(f"    内容: {repr(lines[line_num][:100])}")
    
    # 尝试修复常见的语法错误
    print(f"\n开始修复...")
    new_lines = lines[:]
    fixed = []
    
    for line_num, col_num, error_msg in errors:
        if line_num >= len(new_lines):
            continue
        
        line = new_lines[line_num]
        stripped = line.strip()
        
        # 修复策略
        if "'}' expected" in error_msg:
            # 检查是否缺少闭合括号
            if not stripped.endswith('}'):
                # 检查这一行是否有未闭合的括号
                open_braces = line.count('{')
                close_braces = line.count('}')
                if open_braces > close_braces:
                    # 在行尾添加缺失的 }
                    new_lines[line_num] = line.rstrip() + '}\n'
                    fixed.append(f"第 {line_num + 1} 行: 添加缺失的 }}")
        
        elif "';' expected" in error_msg:
            # 检查是否缺少分号
            if stripped and not stripped.endswith(';') and not stripped.endswith('{') and not stripped.endswith('}') and not stripped.endswith('(') and not stripped.endswith(')'):
                # 在某些情况下添加分号
                if 'return' in stripped or stripped.startswith('const ') or stripped.startswith('let ') or stripped.startswith('var '):
                    if not line.rstrip().endswith(';'):
                        new_lines[line_num] = line.rstrip() + ';\n'
                        fixed.append(f"第 {line_num + 1} 行: 添加缺失的 ;")
        
        elif "')' expected" in error_msg:
            # 检查是否缺少闭合括号
            open_parens = line.count('(')
            close_parens = line.count(')')
            if open_parens > close_parens:
                new_lines[line_num] = line.rstrip() + ')\n'
                fixed.append(f"第 {line_num + 1} 行: 添加缺失的 )")
        
        elif "',' expected" in error_msg:
            # 检查是否缺少逗号
            # 这通常发生在对象字面量或函数参数中
            if col_num < len(line):
                # 在指定位置插入逗号
                before = line[:col_num].rstrip()
                after = line[col_num:]
                if not before.endswith(',') and not before.endswith('(') and not before.endswith('{'):
                    new_lines[line_num] = before + ',' + after
                    fixed.append(f"第 {line_num + 1} 行: 添加缺失的 ,")
    
    if fixed:
        print(f"\n修复了 {len(fixed)} 个问题:")
        for fix in fixed:
            print(f"  {fix}")
        
        # 写回文件
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        
        print(f"\n✓ 已修复并保存文件")
    else:
        print(f"\n⚠ 无法自动修复，需要手动检查")
        print(f"\n错误行详情:")
        for line_num, col_num, error_msg in errors[:5]:
            if line_num < len(lines):
                print(f"\n第 {line_num + 1} 行:")
                print(f"  错误: {error_msg}")
                print(f"  内容: {repr(lines[line_num])}")
                if line_num > 0:
                    print(f"  上一行: {repr(lines[line_num - 1])}")
                if line_num < len(lines) - 1:
                    print(f"  下一行: {repr(lines[line_num + 1])}")
    
    return len(fixed) > 0

# 修复两个文件
print("\n开始修复...")
fix_category = check_and_fix_syntax('src/pages/CategoryPage.tsx')
fix_url = check_and_fix_syntax('src/pages/UrlPage.tsx')

print("\n" + "=" * 70)
print("重新构建验证...")
print("=" * 70)
print()

result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)

# 显示错误
errors = [line for line in result.stderr.split('\n') if 'error TS' in line]
if errors:
    print(f"\n发现 {len(errors)} 个 TypeScript 错误:")
    for i, err in enumerate(errors[:25], 1):
        print(f"  {i}. {err}")
else:
    print("\n✓ 没有 TypeScript 错误！")
    # 显示成功信息
    output_lines = result.stdout.split('\n')
    for line in output_lines:
        if 'built' in line.lower() or 'success' in line.lower() or 'dist' in line.lower():
            print(line)

if result.returncode == 0:
    print("\n" + "=" * 70)
    print("✓✓✓ 构建成功！✓✓✓")
    print("=" * 70)
else:
    print("\n" + "=" * 70)
    print(f"✗ 构建失败 (退出码: {result.returncode})")
    print("=" * 70)
    print("\n如果自动修复失败，建议:")
    print("1. 从本地重新上传正确的文件")
    print("2. 或者手动检查错误行并修复")
ENDOFSCRIPT












