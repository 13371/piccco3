import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useUserStore } from '../stores/userStore';
import { useTranslation } from '../i18n/useTranslation';
import './UserManagementPage.css';

interface DeviceInfo {
  id: string;
  name: string;
  detail: string;
  loginTime: number;
  isCurrent: boolean;
}

const DeviceManagementPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentUser = useUserStore((state) => state.currentUser);
  const logout = useUserStore((state) => state.logout);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const key = `piccco-login-time-${currentUser.id}`;
    let loginTime = Number(localStorage.getItem(key) || '');
    if (!loginTime) {
      loginTime = Date.now();
      localStorage.setItem(key, String(loginTime));
    }
    const ua = window.navigator.userAgent;
    const name = '本机';
    const detail = ua;
    setDevices([
      {
        id: 'current',
        name,
        detail,
        loginTime,
        isCurrent: true,
      },
    ]);
  }, [currentUser]);

  const handleOffline = (id: string, isCurrent: boolean) => {
    // 当前设备不能被下线
    if (isCurrent) {
      alert('当前设备不能被下线');
      return;
    }
    
    if (!confirm('确定要将该设备下线吗？')) return;
    
    // 下线其他设备（未来扩展功能，可能需要后端支持）
    alert('该设备已下线');
    // 这里可以调用后端API来下线其他设备
    // 暂时只是提示，实际的下线逻辑需要后端支持多设备管理
  };

  return (
    <div className="user-management-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('deviceManagement')}</h1>
      </div>

      {(!currentUser || devices.length === 0) ? (
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


