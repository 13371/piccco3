import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useUserStore } from '../stores/userStore';
import { useTranslation } from '../i18n/useTranslation';
import { API_BASE_URL } from '../config/api';
import './UserManagementPage.css';

interface DeviceInfo {
  id: string;
  name: string;
  detail: string;
  loginTime: number;
  lastActiveTime?: number;
  isCurrent: boolean;
  type?: string;
  ipAddress?: string;
}

const DeviceManagementPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentUser = useUserStore((state) => state.currentUser);
  const token = useUserStore((state) => state.token);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从服务器获取设备列表
  const loadDevices = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // 每次都获取最新的token，确保使用最新的token
    const currentToken = useUserStore.getState().token;
    if (!currentToken) {
      setLoading(false);
      setError('未登录，无法获取设备列表');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`${API_BASE_URL}/v1/auth/devices`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Token过期，尝试刷新
          const refreshResult = await useUserStore.getState().refreshAccessToken();
          if (refreshResult.ok) {
            // 刷新成功，使用新token重试
            const newToken = useUserStore.getState().token;
            if (newToken) {
              const retryRes = await fetch(`${API_BASE_URL}/v1/auth/devices`, {
                headers: {
                  'Authorization': `Bearer ${newToken}`,
                },
              });
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                if (retryData.success && retryData.devices) {
                  const formattedDevices: DeviceInfo[] = retryData.devices.map((device: any) => ({
                    id: device.id,
                    name: device.name || '未知设备',
                    detail: device.userAgent || device.ipAddress || '',
                    loginTime: device.loginTime,
                    lastActiveTime: device.lastActiveTime,
                    isCurrent: device.isCurrent,
                    type: device.type,
                    ipAddress: device.ipAddress,
                  }));
                  setDevices(formattedDevices);
                  setLoading(false);
                  return;
                }
              }
            }
          }
          setError('登录已过期，请重新登录');
          setLoading(false);
          return;
        }
        throw new Error('获取设备列表失败');
      }

      const data = await res.json();
      if (data.success && data.devices) {
        // 转换设备数据格式
        const formattedDevices: DeviceInfo[] = data.devices.map((device: any) => ({
          id: device.id,
          name: device.name || '未知设备',
          detail: device.userAgent || device.ipAddress || '',
          loginTime: device.loginTime,
          lastActiveTime: device.lastActiveTime,
          isCurrent: device.isCurrent,
          type: device.type,
          ipAddress: device.ipAddress,
        }));
        setDevices(formattedDevices);
      } else {
        setDevices([]);
      }
    } catch (e) {
      console.error('加载设备列表失败:', e);
      setError('加载设备列表失败，请稍后重试');
      // 如果加载失败，至少显示当前设备
      const ua = window.navigator.userAgent;
      setDevices([
        {
          id: 'current',
          name: '本机',
          detail: ua,
          loginTime: Date.now(),
          isCurrent: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    loadDevices();
  }, [currentUser]);

  const handleOffline = async (deviceId: string, isCurrent: boolean) => {
    // 当前设备不能被下线
    if (isCurrent) {
      alert('当前设备不能被下线');
      return;
    }
    
    if (!confirm('确定要将该设备下线吗？')) return;
    
    // 获取最新的token
    const currentToken = useUserStore.getState().token;
    if (!currentToken) {
      alert('未登录，无法执行此操作');
      return;
    }

    try {
      let res = await fetch(`${API_BASE_URL}/v1/auth/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Token过期，尝试刷新
          const refreshResult = await useUserStore.getState().refreshAccessToken();
          if (refreshResult.ok) {
            // 刷新成功，使用新token重试
            const newToken = useUserStore.getState().token;
            if (newToken) {
              res = await fetch(`${API_BASE_URL}/v1/auth/devices/${deviceId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${newToken}`,
                },
              });
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || '下线设备失败');
              }
            } else {
              alert('登录已过期，请重新登录');
              return;
            }
          } else {
            alert('登录已过期，请重新登录');
            return;
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || '下线设备失败');
        }
      }

      // 下线成功，重新加载设备列表
      const data = await res.json();
      if (data.success) {
        alert('设备已下线');
        // 重新加载设备列表
        await loadDevices();
      }
    } catch (e) {
      console.error('下线设备失败:', e);
      alert(e instanceof Error ? e.message : '下线设备失败，请稍后重试');
    }
  };

  return (
    <div className="user-management-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('deviceManagement')}</h1>
        <button 
          className="page-back-button" 
          onClick={loadDevices}
          style={{ 
            marginLeft: 'auto',
            fontSize: '14px',
            padding: '6px 12px'
          }}
          disabled={loading}
        >
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : error ? (
        <div className="empty-state" style={{ color: '#ef4444' }}>{error}</div>
      ) : (!currentUser || devices.length === 0) ? (
        <div className="empty-state">暂无登录设备</div>
      ) : (
        <div className="user-list">
          {devices.map((device) => (
            <div key={device.id} className="user-item">
              <div className="user-info">
                <div className="user-avatar">
                  📱
                </div>
                <div className="user-details">
                  <div className="user-name">
                    {device.name}
                    {device.isCurrent && (
                      <span className="active-badge">当前设备</span>
                    )}
                  </div>
                  <div className="user-email">{device.detail}</div>
                  <div className="user-meta">
                    登录时间：
                    {format(new Date(device.loginTime), 'yyyy-MM-dd HH:mm', {
                      locale: zhCN,
                    })}
                    {device.lastActiveTime && device.lastActiveTime !== device.loginTime && (
                      <>
                        <br />
                        最后活动：
                        {format(new Date(device.lastActiveTime), 'yyyy-MM-dd HH:mm', {
                          locale: zhCN,
                        })}
                      </>
                    )}
                    {device.ipAddress && (
                      <>
                        <br />
                        IP地址：{device.ipAddress}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="user-actions">
                {device.isCurrent ? (
                  <span className="action-btn-disabled" style={{ 
                    padding: '6px 14px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#999',
                    backgroundColor: '#f5f5f5',
                    cursor: 'not-allowed',
                    border: 'none'
                  }}>
                    当前设备
                  </span>
                ) : (
                  <button
                    className="action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOffline(device.id, device.isCurrent);
                    }}
                  >
                    下线
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeviceManagementPage;


