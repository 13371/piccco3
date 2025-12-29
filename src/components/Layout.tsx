import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useUserStore } from '../stores/userStore';
import { useMessageStore } from '../stores/messageStore';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import './Layout.css';

const Layout = () => {
  const navigate = useNavigate();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated());
  const isBanned = useUserStore((state) => state.isBanned());
  const checkBanStatus = useUserStore((state) => state.checkBanStatus);
  const currentUser = useUserStore((state) => state.currentUser);
  const logout = useUserStore((state) => state.logout);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const nightMode = useSettingsStore((state) => state.nightMode);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [banMessage, setBanMessage] = useState<string | null>(null);

  // 检查封禁状态（更频繁检查，确保解封后立即恢复）
  useEffect(() => {
    if (isAuthenticated) {
      // 立即检查一次
      checkBanStatus().then((result) => {
        if (result === true) {
          // 用户被封禁
          const user = useUserStore.getState().currentUser;
          const reason = user?.banReason;
          setBanMessage(`您的账号已被封禁${reason ? '，原因：' + reason : ''}。`);
        } else if (result === 'unbanned') {
          // 用户被解封，清除封禁消息
          setBanMessage(null);
        }
      });
      
      // 每5秒检查一次封禁状态（更频繁，确保解封后立即恢复）
      const interval = setInterval(async () => {
        const result = await checkBanStatus();
        if (result === true) {
          // 用户被封禁
          const user = useUserStore.getState().currentUser;
          const reason = user?.banReason;
          setBanMessage(`您的账号已被封禁${reason ? '，原因：' + reason : ''}。`);
        } else if (result === 'unbanned') {
          // 用户被解封，清除封禁消息
          setBanMessage(null);
        }
      }, 5000); // 改为5秒检查一次
      
      return () => clearInterval(interval);
    } else {
      // 未登录时清除封禁消息
      setBanMessage(null);
    }
  }, [isAuthenticated, checkBanStatus]);

  // 自动同步消息（每30秒）
  useEffect(() => {
    if (!isAuthenticated || isBanned) return;
    
    const loadMessagesFromServer = useMessageStore.getState().loadMessagesFromServer;
    
    // 立即加载一次
    loadMessagesFromServer();
    
    // 每30秒自动同步一次
    const interval = setInterval(() => {
      loadMessagesFromServer();
    }, 30000); // 30秒
    
    return () => clearInterval(interval);
  }, [isAuthenticated, isBanned]);

  // 自动同步数据（每60秒，只在有变更时上传）
  useEffect(() => {
    if (!isAuthenticated || isBanned) return;
    
    const dataStore = useDataStore.getState();
    const syncDataFromServer = dataStore.syncDataFromServer;
    const syncDataToServer = dataStore.syncDataToServer;
    
    // 延迟同步，避免与登录时的同步冲突
    const initialSyncTimer = setTimeout(() => {
      syncDataFromServer();
    }, 1000);
    
    // 每60秒自动同步一次
    const interval = setInterval(() => {
      // 先下载服务器数据
      syncDataFromServer();
      
      // 如果有待同步的变更，上传数据
      if (dataStore.pendingChanges) {
        debouncedDownloadSync(() => {
          syncDataToServer();
        }, 2000);
      }
    }, 60000); // 60秒
    
    return () => {
      clearTimeout(initialSyncTimer);
      clearInterval(interval);
    };
  }, [isAuthenticated, isBanned]);

  useEffect(() => {
    if (!isAuthenticated || isBanned) {
      if (isBanned) {
        logout();
      }
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isBanned, navigate, logout]);

  // 根据设置调整全局字体缩放
  useEffect(() => {
    let scale = 1;
    if (fontSize === 'small') {
      // 小号：明显更小
      scale = 0.8;
    } else if (fontSize === 'large') {
      // 大号：明显更大
      scale = 1.5;
    }
    document.documentElement.style.setProperty('--font-scale', String(scale));
  }, [fontSize]);

  // 判断是否应该使用深色主题
  const isDarkMode = (() => {
    if (nightMode === 'day') return false;
    if (nightMode === 'night') return true;
    // auto 模式：根据当前时间判断（18:00-6:00 为夜间）
    return currentHour >= 18 || currentHour < 6;
  })();

  // 应用深色主题
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  // 自动模式下，每分钟检查一次时间变化
  useEffect(() => {
    if (nightMode === 'auto') {
      const interval = setInterval(() => {
        setCurrentHour(new Date().getHours());
      }, 60000); // 每分钟检查一次

      return () => clearInterval(interval);
    } else {
      // 非自动模式时，重置为当前时间
      setCurrentHour(new Date().getHours());
    }
  }, [nightMode]);

  // 如果未认证或已封禁，不渲染任何内容（useEffect 会处理导航到 /login）
  if (!isAuthenticated || isBanned) {
    return null;
  }

  return (
    <div className="layout">
      {banMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#ef4444',
          color: 'white',
          padding: '12px',
          textAlign: 'center',
          zIndex: 10000,
          fontSize: '14px',
        }}>
          {banMessage}
        </div>
      )}
      <TopBar />
      <main className="main-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;







