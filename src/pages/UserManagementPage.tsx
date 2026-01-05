import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { logger } from '../utils/logger';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import './UserManagementPage.css';

interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  isBanned: boolean;
  bannedAt: string | null;
  banReason: string | null;
}

const UserManagementPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [filters, setFilters] = useState({
    keyword: '',
    isBanned: undefined as boolean | undefined,
    sortBy: 'createdAt',
    order: 'desc' as 'asc' | 'desc',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: filters.sortBy,
        order: filters.order,
      });
      if (filters.keyword) {
        params.append('keyword', filters.keyword);
      }
      if (filters.isBanned !== undefined) {
        params.append('isBanned', filters.isBanned.toString());
      }

      const res = await fetch(`${API_BASE_URL}/v1/admin/users?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setPagination({
          page: data.page,
          pageSize: data.pageSize,
          total: data.total,
          totalPages: data.totalPages,
        });
      } else {
        alert(data.message || '获取用户列表失败');
      }
    } catch (e) {
      logger.error('获取用户列表失败:', e);
      alert('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.keyword, filters.isBanned, filters.sortBy, filters.order, pagination.page]);

  const handleViewDetail = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/admin/users/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedUser(data);
        setShowDetailModal(true);
      } else {
        alert(data.message || '获取用户详情失败');
      }
    } catch (e) {
      logger.error('获取用户详情失败:', e);
      alert('获取用户详情失败');
    }
  };

  const handleBan = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: banReason }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('用户已封禁');
        setShowBanModal(false);
        setBanReason('');
        fetchUsers();
      } else {
        alert(data.message || '封禁用户失败');
      }
    } catch (e) {
      logger.error('封禁用户失败:', e);
      alert('封禁用户失败');
    }
  };

  const handleUnban = async (userId: string) => {
    if (!confirm('确定要解封该用户吗？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/v1/admin/users/${userId}/unban`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        alert('用户已解封');
        fetchUsers();
      } else {
        alert(data.message || '解封用户失败');
      }
    } catch (e) {
      logger.error('解封用户失败:', e);
      alert('解封用户失败');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('确定要删除该用户吗？此操作不可恢复！')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/v1/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        alert('用户已删除');
        fetchUsers();
      } else {
        alert(data.message || '删除用户失败');
      }
    } catch (e) {
      logger.error('删除用户失败:', e);
      alert('删除用户失败');
    }
  };

  return (
    <div className="user-management-page">
      <div className="user-management-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <h1 className="page-title">用户管理</h1>
      </div>

      {/* 筛选区域 */}
      <div className="filter-section">
        <div className="filter-row">
          <input
            type="text"
            placeholder="搜索用户名或邮箱"
            value={filters.keyword}
            onChange={(e) =>
              setFilters({ ...filters, keyword: e.target.value })
            }
            className="filter-input"
          />
          <select
            value={filters.isBanned === undefined ? 'all' : filters.isBanned ? 'banned' : 'active'}
            onChange={(e) => {
              const val = e.target.value;
              setFilters({
                ...filters,
                isBanned: val === 'all' ? undefined : val === 'banned',
              });
            }}
            className="filter-select"
          >
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="banned">已封禁</option>
          </select>
          <select
            value={`${filters.sortBy}-${filters.order}`}
            onChange={(e) => {
              const [sortBy, order] = e.target.value.split('-');
              setFilters({ ...filters, sortBy, order: order as 'asc' | 'desc' });
            }}
            className="filter-select"
          >
            <option value="createdAt-desc">注册时间（新→旧）</option>
            <option value="createdAt-asc">注册时间（旧→新）</option>
            <option value="username-asc">用户名（A→Z）</option>
            <option value="username-desc">用户名（Z→A）</option>
          </select>
        </div>
      </div>

      {/* 用户列表 */}
      {loading ? (
        <div className="loading">加载中...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">暂无用户</div>
      ) : (
        <>
          <div className="user-list">
            {users.map((user) => (
              <div
                key={user.id}
                className={`user-item ${user.isBanned ? 'banned' : ''}`}
              >
                <div className="user-info">
                  <div className="user-avatar">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <div className="user-name">
                      {user.username}
                      {user.isBanned && (
                        <span className="banned-badge">已封禁</span>
                      )}
                    </div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-meta">
                      注册时间：
                      {format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm', {
                        locale: zhCN,
                      })}
                    </div>
                  </div>
                </div>
                <div className="user-actions">
                  <button
                    className="action-btn view-btn"
                    onClick={() => handleViewDetail(user.id)}
                  >
                    查看
                  </button>
                  {user.isBanned ? (
                    <button
                      className="action-btn unban-btn"
                      onClick={() => handleUnban(user.id)}
                    >
                      解封
                    </button>
                  ) : (
                    <button
                      className="action-btn ban-btn"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowBanModal(true);
                      }}
                    >
                      封禁
                    </button>
                  )}
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleDelete(user.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page - 1 })
                }
              >
                上一页
              </button>
              <span className="page-info">
                第 {pagination.page} / {pagination.totalPages} 页（共{' '}
                {pagination.total} 条）
              </span>
              <button
                className="page-btn"
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page + 1 })
                }
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 用户详情弹窗 */}
      {showDetailModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>用户详情</h2>
              <button
                className="modal-close"
                onClick={() => setShowDetailModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <span className="detail-label">用户ID：</span>
                <span className="detail-value">{selectedUser.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">用户名：</span>
                <span className="detail-value">{selectedUser.username}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">邮箱：</span>
                <span className="detail-value">{selectedUser.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">注册时间：</span>
                <span className="detail-value">
                  {format(new Date(selectedUser.createdAt), 'yyyy-MM-dd HH:mm', {
                    locale: zhCN,
                  })}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">状态：</span>
                <span className="detail-value">
                  {selectedUser.isBanned ? (
                    <span className="banned-badge">已封禁</span>
                  ) : (
                    <span className="active-badge">正常</span>
                  )}
                </span>
              </div>
              {selectedUser.isBanned && selectedUser.bannedAt && (
                <>
                  <div className="detail-item">
                    <span className="detail-label">封禁时间：</span>
                    <span className="detail-value">
                      {format(
                        new Date(selectedUser.bannedAt),
                        'yyyy-MM-dd HH:mm',
                        { locale: zhCN }
                      )}
                    </span>
                  </div>
                  {selectedUser.banReason && (
                    <div className="detail-item">
                      <span className="detail-label">封禁原因：</span>
                      <span className="detail-value">
                        {selectedUser.banReason}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn"
                onClick={() => setShowDetailModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 封禁弹窗 */}
      {showBanModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowBanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>封禁用户</h2>
              <button
                className="modal-close"
                onClick={() => setShowBanModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="ban-info">
                确定要封禁用户 <strong>{selectedUser.username}</strong> 吗？
              </div>
              <div className="ban-reason-input">
                <label>封禁原因（可选）：</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="请输入封禁原因"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn cancel-btn"
                onClick={() => {
                  setShowBanModal(false);
                  setBanReason('');
                }}
              >
                取消
              </button>
              <button
                className="modal-btn ban-confirm-btn"
                onClick={() => handleBan(selectedUser.id)}
              >
                确认封禁
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;

