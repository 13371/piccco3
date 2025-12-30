#!/bin/bash
# 服务器端修复脚本 - 修复重复的 export default 和语法错误

cd /www/wwwroot/piccco3

python3 << 'ENDOFSCRIPT'
import os
import re
import subprocess

os.chdir('/www/wwwroot/piccco3')

print("=" * 70)
print("修复服务器上的 TypeScript 错误")
print("=" * 70)

def fix_file(filepath, component_name):
    print(f"\n{'='*70}")
    print(f"修复 {filepath}")
    print(f"{'='*70}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"原始文件: {len(lines)} 行")
    
    # 1. 查找所有 export default 语句
    export_indices = []
    for i, line in enumerate(lines):
        if f'export default {component_name}' in line:
            export_indices.append(i)
    
    print(f"\n步骤1: 检查 export default 语句")
    print(f"找到 {len(export_indices)} 个 export default 语句:")
    for idx in export_indices:
        print(f"  第 {idx + 1} 行: {repr(lines[idx][:80])}")
    
    # 2. 找到 return 语句
    return_idx = None
    for i, line in enumerate(lines):
        if re.match(r'^\s*return\s*\(', line):
            return_idx = i
            break
    
    if return_idx is None:
        print("✗ 无法找到 return 语句")
        return False
    
    print(f"\n步骤2: 找到 return 在第 {return_idx + 1} 行")
    
    # 3. 删除重复的 export，只保留最后一个
    new_lines = []
    deleted_exports = []
    
    if len(export_indices) > 1:
        print(f"\n步骤3: 删除重复的 export 语句")
        for i, line in enumerate(lines):
            if i in export_indices[:-1]:  # 保留最后一个，删除其他的
                print(f"  删除第 {i+1} 行: {repr(line[:80])}")
                deleted_exports.append(i + 1)
                continue
            new_lines.append(line)
        print(f"删除了 {len(deleted_exports)} 个重复的 export 语句")
    else:
        new_lines = lines[:]
    
    # 4. 重新找到 export 位置
    new_export_idx = None
    for i, line in enumerate(new_lines):
        if f'export default {component_name}' in line:
            new_export_idx = i
            break
    
    if new_export_idx is None:
        print("✗ 无法找到 export 位置")
        return False
    
    print(f"export 在第 {new_export_idx + 1} 行")
    
    # 5. 删除 return 和 export 之间所有单独的 ); 和 };
    print(f"\n步骤4: 清理多余的闭合括号")
    final_lines = []
    deleted_brackets = []
    
    for i, line in enumerate(new_lines):
        stripped = line.strip()
        
        # 如果在 return 和 export 之间
        if return_idx < i < new_export_idx:
            if stripped in [');', '};']:
                print(f"  删除第 {i+1} 行: {stripped}")
                deleted_brackets.append(i + 1)
                continue
        
        final_lines.append(line)
    
    print(f"删除了 {len(deleted_brackets)} 个多余的闭合括号")
    
    # 6. 重新找到 export 位置
    final_export_idx = None
    for i, line in enumerate(final_lines):
        if f'export default {component_name}' in line:
            final_export_idx = i
            break
    
    if final_export_idx is None:
        print("✗ 无法找到 export 位置")
        return False
    
    # 7. 确保 export 之前有 ); 和 };
    print(f"\n步骤5: 确保文件结构正确")
    has_paren = False
    has_brace = False
    paren_idx = None
    brace_idx = None
    
    for i in range(max(0, final_export_idx - 5), final_export_idx):
        stripped = final_lines[i].strip()
        if stripped == ');':
            has_paren = True
            paren_idx = i
        if stripped == '};':
            has_brace = True
            brace_idx = i
    
    print(f"  ); 存在: {has_paren} (第 {paren_idx + 1 if paren_idx else 'N/A'} 行)")
    print(f"  }}; 存在: {has_brace} (第 {brace_idx + 1 if brace_idx else 'N/A'} 行)")
    
    # 获取缩进
    indent = '  '
    if final_export_idx > 0:
        match = re.match(r'^(\s*)', final_lines[final_export_idx])
        if match:
            indent = match.group(1)
    
    # 确保 ); 在 }; 之前
    if has_paren and has_brace and paren_idx is not None and brace_idx is not None:
        if paren_idx > brace_idx:
            print(f"  交换 ); 和 }}; 的顺序")
            final_lines[paren_idx], final_lines[brace_idx] = final_lines[brace_idx], final_lines[paren_idx]
            paren_idx, brace_idx = brace_idx, paren_idx
    
    # 如果缺少，添加
    insert_pos = final_export_idx
    if not has_paren:
        final_lines.insert(insert_pos, indent + ');\n')
        print(f"  添加 ); 在第 {insert_pos + 1} 行")
        insert_pos += 1
    if not has_brace:
        final_lines.insert(insert_pos, indent + '};\n')
        print(f"  添加 }}; 在第 {insert_pos + 1} 行")
    
    # 8. 清理多余的空行（export 之前只保留一个空行）
    final_export_idx = None
    for i, line in enumerate(final_lines):
        if f'export default {component_name}' in line:
            final_export_idx = i
            break
    
    if final_export_idx and final_export_idx > 2:
        # 检查 export 之前的空行
        empty_count = 0
        for i in range(final_export_idx - 1, max(0, final_export_idx - 5), -1):
            if not final_lines[i].strip():
                empty_count += 1
            else:
                break
        
        if empty_count > 1:
            print(f"  清理多余的空行（保留1个）")
            # 只保留一个空行
            new_final = []
            skip_empty = True
            for i, line in enumerate(final_lines):
                if i == final_export_idx - 1:
                    if not line.strip():
                        if skip_empty:
                            new_final.append('\n')
                            skip_empty = False
                        continue
                new_final.append(line)
            final_lines = new_final
    
    # 9. 写回文件
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
    
    print(f"\n✓ 修复完成！")
    print(f"  最终文件: {len(final_lines)} 行")
    
    # 显示最后几行
    print("\n最后8行:")
    for i in range(max(0, len(final_lines) - 8), len(final_lines)):
        marker = ">>>" if i == len(final_lines) - 1 else "   "
        print(f"  {marker} {i+1:4d}: {repr(final_lines[i])}")
    
    return True

# 执行修复
print("\n开始修复文件...")
fix_category = fix_file('src/pages/CategoryPage.tsx', 'CategoryPage')
fix_url = fix_file('src/pages/UrlPage.tsx', 'UrlPage')

print("\n" + "=" * 70)
print("开始构建验证...")
print("=" * 70)
print()

result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)

# 显示构建输出
output = result.stdout + result.stderr
lines = output.split('\n')

# 显示关键信息
print("构建输出:")
for line in lines:
    if any(keyword in line.lower() for keyword in ['error', 'warning', 'built', 'success', 'dist', 'vite', 'typescript']):
        print(line)

# 提取错误
errors = [line for line in lines if 'error TS' in line or 'error' in line.lower()]
if errors:
    print(f"\n发现 {len(errors)} 个错误:")
    for i, err in enumerate(errors[:25], 1):
        print(f"  {i}. {err}")

if result.returncode == 0:
    print("\n" + "=" * 70)
    print("✓✓✓ 构建成功！✓✓✓")
    print("=" * 70)
    print("\n下一步:")
    print("1. 配置 Nginx 反向代理")
    print("2. 使用 PM2 启动后端服务")
    print("3. 测试应用访问")
else:
    print("\n" + "=" * 70)
    print(f"✗ 构建失败 (退出码: {result.returncode})")
    print("=" * 70)
    print("\n请检查上面的错误信息，继续修复...")
ENDOFSCRIPT












