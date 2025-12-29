const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// 登录页面 HTML
const loginHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>piccco 后台管理 - 登录</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      padding: 40px;
      max-width: 400px;
      width: 100%;
    }
    .login-header {
      text-align: center;
      margin-bottom: 30px;
    }
    .login-header h1 {
      font-size: 28px;
      color: #333;
      margin-bottom: 10px;
    }
    .login-header p {
      color: #666;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #374151;
      font-size: 14px;
      font-weight: 500;
    }
    .form-group input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
    }
    .btn-login {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-login:hover {
      opacity: 0.9;
    }
    .btn-login:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 14px;
      display: none;
    }
    .error-message.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-header">
      <h1>🔐 管理员登录</h1>
      <p>piccco 后台管理系统</p>
    </div>
    <div class="error-message" id="errorMessage"></div>
    <form id="loginForm">
      <div class="form-group">
        <label for="password">管理员密码</label>
        <input type="password" id="password" name="password" placeholder="请输入管理员密码" required autofocus />
      </div>
      <button type="submit" class="btn-login" id="loginBtn">登录</button>
    </form>
  </div>
  <script>
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = passwordInput.value.trim();
      if (!password) {
        showError('请输入密码');
        return;
      }
      
      loginBtn.disabled = true;
      loginBtn.textContent = '登录中...';
      hideError();
      
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ password }),
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
          // 登录成功，刷新页面
          window.location.reload();
        } else {
          showError(data.message || '登录失败，请检查密码');
        }
      } catch (e) {
        showError('网络错误，请稍后重试');
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
      }
    });
    
    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.classList.add('show');
    }
    
    function hideError() {
      errorMessage.classList.remove('show');
    }
    
    // 检查是否已登录
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/check-auth', {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.authenticated) {
          window.location.href = '/admin';
        }
      } catch (e) {
        // 忽略错误，继续显示登录页面
      }
    }
    
    checkAuth();
  </script>
</body>
</html>
`;

// 管理界面 HTML
const adminHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>piccco 后台管理</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
    }
    .header h1 {
      font-size: 24px;
      margin-bottom: 5px;
    }
    .header p {
      opacity: 0.9;
      font-size: 14px;
    }
    .toolbar {
      padding: 20px 30px;
      border-bottom: 1px solid #eee;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-box {
      flex: 1;
      min-width: 200px;
    }
    .search-box input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .filter-box {
      min-width: 150px;
    }
    .filter-box select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      background: white;
      cursor: pointer;
    }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background: #5568d3;
    }
    .btn-danger {
      background: #ef4444;
      color: white;
    }
    .btn-danger:hover {
      background: #dc2626;
    }
    .btn-success {
      background: #10b981;
      color: white;
    }
    .btn-success:hover {
      background: #059669;
    }
    .btn-secondary {
      background: #6b7280;
      color: white;
    }
    .btn-secondary:hover {
      background: #4b5563;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead {
      background: #f9fafb;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      font-weight: 600;
      color: #374151;
      font-size: 14px;
    }
    td {
      font-size: 14px;
      color: #6b7280;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-active {
      background: #d1fae5;
      color: #065f46;
    }
    .status-banned {
      background: #fee2e2;
      color: #991b1b;
    }
    .actions {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }
    .actions .btn {
      min-width: 36px;
      padding: 6px 10px;
      font-size: 14px;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }
    .pagination {
      padding: 20px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #eee;
    }
    .pagination-info {
      color: #6b7280;
      font-size: 14px;
    }
    .pagination-buttons {
      display: flex;
      gap: 10px;
    }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .modal.show {
      display: flex;
    }
    .modal-content {
      background: white;
      border-radius: 8px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      margin-bottom: 20px;
    }
    .modal-header h2 {
      font-size: 20px;
      color: #111827;
    }
    .modal-body {
      margin-bottom: 20px;
    }
    .modal-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      margin-bottom: 5px;
      color: #374151;
      font-size: 14px;
      font-weight: 500;
    }
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>📝 piccco 后台管理</h1>
          <p>用户管理系统</p>
        </div>
        <button class="btn btn-secondary" onclick="logout()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">登出</button>
      </div>
    </div>
    
    <div class="toolbar">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="搜索用户名或邮箱..." />
      </div>
      <div class="filter-box">
        <select id="statusFilter" onchange="loadUsers()">
          <option value="">全部用户</option>
          <option value="false">正常用户</option>
          <option value="true">已封禁用户</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="loadUsers()">刷新</button>
      <button class="btn btn-primary" onclick="showBroadcastModal()" style="background: #10b981;">📢 群发消息</button>
      <button class="btn btn-secondary" onclick="showHistoryModal()">📋 发送历史</button>
    </div>
    
    <div class="table-container">
      <div id="loading" class="loading">加载中...</div>
      <table id="usersTable" style="display: none;">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>注册时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="usersBody"></tbody>
      </table>
    </div>
    
    <div class="pagination" id="pagination" style="display: none;">
      <div class="pagination-info" id="paginationInfo"></div>
      <div class="pagination-buttons">
        <button class="btn btn-secondary" id="prevBtn" onclick="changePage(-1)">上一页</button>
        <button class="btn btn-secondary" id="nextBtn" onclick="changePage(1)">下一页</button>
      </div>
    </div>
  </div>
  
  <!-- 封禁用户模态框 -->
  <div class="modal" id="banModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>封禁用户</h2>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>用户ID</label>
          <input type="text" id="banUserId" readonly />
        </div>
        <div class="form-group">
          <label>用户名</label>
          <input type="text" id="banUsername" readonly />
        </div>
        <div class="form-group">
          <label>封禁原因（可选）</label>
          <textarea id="banReason" placeholder="请输入封禁原因..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeBanModal()">取消</button>
        <button class="btn btn-danger" onclick="confirmBan()">确认封禁</button>
      </div>
    </div>
  </div>
  
  <!-- 发送消息模态框 -->
  <div class="modal" id="messageModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>发送消息</h2>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>用户ID</label>
          <input type="text" id="messageUserId" readonly />
        </div>
        <div class="form-group">
          <label>用户名</label>
          <input type="text" id="messageUsername" readonly />
        </div>
        <div class="form-group">
          <label>消息标题 <span style="color: red;">*</span></label>
          <input type="text" id="messageTitle" placeholder="请输入消息标题..." />
        </div>
        <div class="form-group">
          <label>消息内容 <span style="color: red;">*</span></label>
          <textarea id="messageContent" placeholder="请输入消息内容..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeMessageModal()">取消</button>
        <button class="btn btn-primary" onclick="confirmSendMessage()">发送</button>
      </div>
    </div>
  </div>
  
  <!-- 群发消息模态框 -->
  <div class="modal" id="broadcastModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>📢 群发消息</h2>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>消息标题 <span style="color: red;">*</span></label>
          <input type="text" id="broadcastTitle" placeholder="请输入消息标题..." />
        </div>
        <div class="form-group">
          <label>消息内容 <span style="color: red;">*</span></label>
          <textarea id="broadcastContent" placeholder="请输入消息内容..."></textarea>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="broadcastOnlyActive" checked />
            仅发送给正常用户（不包含已封禁用户）
          </label>
        </div>
        <div class="form-group" style="padding: 10px; background: #f0f9ff; border-radius: 4px; margin-top: 10px;">
          <small style="color: #0369a1;">
            <strong>提示：</strong>此操作将向所有符合条件的用户发送消息，请谨慎操作。
          </small>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeBroadcastModal()">取消</button>
        <button class="btn btn-primary" onclick="confirmBroadcastMessage()" style="background: #10b981;">确认发送</button>
      </div>
    </div>
  </div>
  
  <!-- 发送历史模态框 -->
  <div class="modal" id="historyModal">
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h2>📋 发送消息历史</h2>
      </div>
      <div class="modal-body">
        <div class="toolbar" style="padding: 0; margin-bottom: 15px; border: none;">
          <div class="filter-box">
            <select id="historyTypeFilter" onchange="loadHistory()">
              <option value="">全部类型</option>
              <option value="single">单个用户</option>
              <option value="broadcast">群发消息</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="loadHistory()">刷新</button>
        </div>
        <div id="historyLoading" class="loading">加载中...</div>
        <div id="historyTable" style="display: none;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">类型</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">标题</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">内容</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">接收用户</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">发送时间</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">操作</th>
              </tr>
            </thead>
            <tbody id="historyBody"></tbody>
          </table>
          <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
            <div id="historyPaginationInfo" style="color: #6b7280; font-size: 14px;"></div>
            <div style="display: flex; gap: 10px;">
              <button class="btn btn-secondary" id="historyPrevBtn" onclick="changeHistoryPage(-1)">上一页</button>
              <button class="btn btn-secondary" id="historyNextBtn" onclick="changeHistoryPage(1)">下一页</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeHistoryModal()">关闭</button>
      </div>
    </div>
  </div>
  
  <script>
    let currentPage = 1;
    let currentSearch = '';
    let currentFilter = '';
    
    async function loadUsers() {
      const loading = document.getElementById('loading');
      const table = document.getElementById('usersTable');
      const pagination = document.getElementById('pagination');
      
      loading.style.display = 'block';
      table.style.display = 'none';
      pagination.style.display = 'none';
      
      try {
        const search = document.getElementById('searchInput').value;
        const filter = document.getElementById('statusFilter').value;
        currentSearch = search;
        currentFilter = filter;
        
        let url = \`/api/admin/users?page=\${currentPage}&limit=20&search=\${encodeURIComponent(search)}\`;
        if (filter !== '') {
          url += \`&isBanned=\${filter}\`;
        }
        
        const res = await fetch(url, {
          credentials: 'include',
        });
        const data = await res.json();
        
        if (res.ok) {
          renderUsers(data.users);
          renderPagination(data);
        } else {
          alert('加载失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('加载失败: ' + e.message);
      } finally {
        loading.style.display = 'none';
        table.style.display = 'table';
        pagination.style.display = 'flex';
      }
    }
    
    function renderUsers(users) {
      const tbody = document.getElementById('usersBody');
      if (users.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="6" style="text-align: center; padding: 40px; color: #6b7280;">
              暂无用户数据<br>
              <small style="font-size: 12px; margin-top: 10px; display: block;">
                提示：用户注册后会自动显示在这里，您可以使用"发送消息"功能向用户发送消息
              </small>
            </td>
          </tr>
        \`;
        return;
      }
      tbody.innerHTML = users.map(user => {
        const createdAt = new Date(user.createdAt).toLocaleString('zh-CN');
        const status = user.isBanned ? 'banned' : 'active';
        const statusText = user.isBanned ? '已封禁' : '正常';
        const banInfo = user.isBanned ? \`<br><small style="color: #991b1b;">原因: \${user.banReason || '无'}</small>\` : '';
        
        return \`
          <tr>
            <td>\${user.id}</td>
            <td>\${user.username}</td>
            <td>\${user.email}</td>
            <td>\${createdAt}</td>
            <td>
              <span class="status-badge status-\${status}">\${statusText}</span>
              \${banInfo}
            </td>
            <td>
              <div class="actions">
                <button class="btn btn-primary" onclick="showMessageModal('\${user.id}', '\${user.username}')" style="background: #667eea; color: white; font-weight: 500;">📨 发送消息</button>
                \${user.isBanned 
                  ? \`<button class="btn btn-success" onclick="unbanUser('\${user.id}')">解封</button>\`
                  : \`<button class="btn btn-danger" onclick="showBanModal('\${user.id}', '\${user.username}')">封禁</button>\`
                }
                <button class="btn btn-danger" onclick="deleteUser('\${user.id}', '\${user.username}')">删除</button>
              </div>
            </td>
          </tr>
        \`;
      }).join('');
    }
    
    function renderPagination(data) {
      const info = document.getElementById('paginationInfo');
      info.textContent = \`第 \${data.page} 页，共 \${data.totalPages} 页，总计 \${data.total} 条\`;
      
      const prevBtn = document.getElementById('prevBtn');
      const nextBtn = document.getElementById('nextBtn');
      prevBtn.disabled = data.page <= 1;
      nextBtn.disabled = data.page >= data.totalPages;
    }
    
    function changePage(delta) {
      currentPage += delta;
      loadUsers();
    }
    
    function showBanModal(userId, username) {
      document.getElementById('banUserId').value = userId;
      document.getElementById('banUsername').value = username;
      document.getElementById('banReason').value = '';
      document.getElementById('banModal').classList.add('show');
    }
    
    function closeBanModal() {
      document.getElementById('banModal').classList.remove('show');
    }
    
    async function confirmBan() {
      const userId = document.getElementById('banUserId').value;
      const reason = document.getElementById('banReason').value;
      
      try {
        const res = await fetch(\`/api/admin/users/\${userId}/ban\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason }),
        });
        const data = await res.json();
        
        if (res.ok) {
          alert('用户已封禁');
          closeBanModal();
          loadUsers();
        } else {
          alert('封禁失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('封禁失败: ' + e.message);
      }
    }
    
    async function unbanUser(userId) {
      if (!confirm('确定要解封该用户吗？')) return;
      
      try {
        const res = await fetch(\`/api/admin/users/\${userId}/unban\`, {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json();
        
        if (res.ok) {
          alert('用户已解封');
          loadUsers();
        } else {
          alert('解封失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('解封失败: ' + e.message);
      }
    }
    
    async function deleteUser(userId, username) {
      if (!confirm(\`确定要删除用户 "\${username}" 吗？此操作不可恢复！\`)) return;
      
      try {
        const res = await fetch(\`/api/admin/users/\${userId}\`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json();
        
        if (res.ok) {
          alert('用户已删除');
          loadUsers();
        } else {
          alert('删除失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('删除失败: ' + e.message);
      }
    }
    
    function showMessageModal(userId, username) {
      document.getElementById('messageUserId').value = userId;
      document.getElementById('messageUsername').value = username;
      document.getElementById('messageTitle').value = '';
      document.getElementById('messageContent').value = '';
      document.getElementById('messageModal').classList.add('show');
    }
    
    function closeMessageModal() {
      document.getElementById('messageModal').classList.remove('show');
    }
    
    async function confirmSendMessage() {
      const userId = document.getElementById('messageUserId').value;
      const title = document.getElementById('messageTitle').value.trim();
      const content = document.getElementById('messageContent').value.trim();
      
      if (!title || !content) {
        alert('请填写消息标题和内容');
        return;
      }
      
      try {
        const res = await fetch(\`/api/admin/users/\${userId}/message\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title, content }),
        });
        const data = await res.json();
        
        if (res.ok) {
          alert('消息已发送');
          closeMessageModal();
        } else {
          alert('发送失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('发送失败: ' + e.message);
      }
    }
    
    function showBroadcastModal() {
      document.getElementById('broadcastTitle').value = '';
      document.getElementById('broadcastContent').value = '';
      document.getElementById('broadcastOnlyActive').checked = true;
      document.getElementById('broadcastModal').classList.add('show');
    }
    
    function closeBroadcastModal() {
      document.getElementById('broadcastModal').classList.remove('show');
    }
    
    async function confirmBroadcastMessage() {
      const title = document.getElementById('broadcastTitle').value.trim();
      const content = document.getElementById('broadcastContent').value.trim();
      const onlyActive = document.getElementById('broadcastOnlyActive').checked;
      
      if (!title || !content) {
        alert('请填写消息标题和内容');
        return;
      }
      
      if (!confirm(\`确定要向\${onlyActive ? '所有正常' : '所有'}用户发送消息吗？此操作不可撤销！\`)) {
        return;
      }
      
      const sendBtn = event.target;
      const originalText = sendBtn.textContent;
      sendBtn.disabled = true;
      sendBtn.textContent = '发送中...';
      
      try {
        const res = await fetch('/api/admin/users/message/all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title, content, onlyActive }),
        });
        const data = await res.json();
        
        if (res.ok) {
          alert(\`消息已成功发送给 \${data.count} 个用户！\`);
          closeBroadcastModal();
        } else {
          alert('发送失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('发送失败: ' + e.message);
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = originalText;
      }
    }
    
    // 搜索框回车事件
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        currentPage = 1;
        loadUsers();
      }
    });
    
    // 筛选变化时重置页码
    document.getElementById('statusFilter').addEventListener('change', () => {
      currentPage = 1;
    });
    
    // 发送历史相关变量
    let historyPage = 1;
    let historyTypeFilter = '';
    
    function showHistoryModal() {
      historyPage = 1;
      historyTypeFilter = '';
      document.getElementById('historyTypeFilter').value = '';
      document.getElementById('historyModal').classList.add('show');
      loadHistory();
    }
    
    function closeHistoryModal() {
      document.getElementById('historyModal').classList.remove('show');
    }
    
    async function loadHistory() {
      const loading = document.getElementById('historyLoading');
      const table = document.getElementById('historyTable');
      
      loading.style.display = 'block';
      table.style.display = 'none';
      
      try {
        const type = document.getElementById('historyTypeFilter').value;
        historyTypeFilter = type;
        
        const res = await fetch(\`/api/admin/message-history?page=\${historyPage}&limit=10&type=\${type || ''}\`, {
          credentials: 'include',
        });
        const data = await res.json();
        
        if (res.ok) {
          displayHistory(data.history || []);
          updateHistoryPagination(data);
        } else {
          alert('加载历史失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('加载历史失败: ' + e.message);
      } finally {
        loading.style.display = 'none';
        table.style.display = 'block';
      }
    }
    
    function displayHistory(history) {
      const tbody = document.getElementById('historyBody');
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">暂无发送历史</td></tr>';
        return;
      }
      
      tbody.innerHTML = history.map(h => {
        const date = new Date(h.createdAt);
        const dateStr = date.toLocaleString('zh-CN');
        const typeLabel = h.type === 'broadcast' ? '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">群发</span>' : '<span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">单个</span>';
        const userInfo = h.type === 'broadcast' ? \`<span style="color: #10b981;">\${h.userCount || 0} 个用户</span>\` : (h.userId ? \`<span style="color: #667eea;">用户ID: \${h.userId}</span>\` : '-');
        const contentPreview = h.content.length > 50 ? h.content.substring(0, 50) + '...' : h.content;
        
        return \`
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">\${typeLabel}</td>
            <td style="padding: 10px; font-weight: 500;">\${h.title || '-'}</td>
            <td style="padding: 10px; color: #6b7280; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="\${h.content}">\${contentPreview}</td>
            <td style="padding: 10px;">\${userInfo}</td>
            <td style="padding: 10px; color: #6b7280; font-size: 12px;">\${dateStr}</td>
            <td style="padding: 10px;">
              <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="deleteHistoryRecord('\${h.id}')">删除</button>
            </td>
          </tr>
        \`;
      }).join('');
    }
    
    function updateHistoryPagination(data) {
      const info = document.getElementById('historyPaginationInfo');
      const prevBtn = document.getElementById('historyPrevBtn');
      const nextBtn = document.getElementById('historyNextBtn');
      
      info.textContent = \`第 \${data.page} 页，共 \${data.totalPages} 页，总计 \${data.total} 条记录\`;
      prevBtn.disabled = data.page <= 1;
      nextBtn.disabled = data.page >= data.totalPages;
    }
    
    function changeHistoryPage(delta) {
      historyPage += delta;
      if (historyPage < 1) historyPage = 1;
      loadHistory();
    }
    
    async function deleteHistoryRecord(historyId) {
      if (!confirm('确定要删除这条历史记录吗？')) {
        return;
      }
      
      try {
        const res = await fetch(\`/api/admin/message-history/\${historyId}\`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json();
        
        if (res.ok) {
          alert('历史记录已删除');
          loadHistory();
        } else {
          alert('删除失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('删除失败: ' + e.message);
      }
    }
    
    // 登出功能
    async function logout() {
      if (!confirm('确定要登出吗？')) return;
      
      try {
        const res = await fetch('/api/admin/logout', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          window.location.reload();
        } else {
          alert('登出失败: ' + (data.message || '未知错误'));
        }
      } catch (e) {
        alert('登出失败: ' + e.message);
      }
    }
    
    // 检查认证状态
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/check-auth', {
          credentials: 'include',
        });
        const data = await res.json();
        if (!data.authenticated) {
          window.location.reload();
        }
      } catch (e) {
        // 如果检查失败，可能是未登录，刷新页面显示登录表单
        window.location.reload();
      }
    }
    
    // 初始化加载
    checkAuth();
    loadUsers();
  </script>
</body>
</html>
`;

// 提供管理界面
router.get('/', (req, res) => {
  // 检查是否已登录
  if (req.session && req.session.isAdmin) {
    // 已登录，显示管理界面
    res.send(adminHTML);
  } else {
    // 未登录，显示登录页面
    res.send(loginHTML);
  }
});

module.exports = router;

