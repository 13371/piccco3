import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useUserStore } from '../stores/userStore';
import { useMessageStore } from '../stores/messageStore';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useHomeContentStore } from '../stores/homeContentStore';
import { USE_NEW_UI } from '../config/ui';
import TopBar from './TopBar';
import TopNav from './TopNav';
import './Layout.css';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated());
  const isBanned = useUserStore((state) => state.isBanned());
  const logout = useUserStore((state) => state.logout);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const nightMode = useSettingsStore((state) => state.nightMode);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [banMessage, setBanMessage] = useState<string | null>(null);
  
  // 检查是否在新建记事页面
  const isNewNotePage = location.pathname === '/new-note';

  // 检查封禁状态（更频繁检查，确保解封后立即恢复）
  useEffect(() => {
    if (isAuthenticated) {
      // 立即检查一次
      const checkBan = useUserStore.getState().checkBanStatus;
      checkBan().then((result: boolean | 'unbanned' | false) => {
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
        const checkBan = useUserStore.getState().checkBanStatus;
        const result = await checkBan();
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
  }, [isAuthenticated]);

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

  // 登录时初始同步（只下载一次）
  useEffect(() => {
    if (!isAuthenticated || isBanned) return;
    
    const syncDataFromServer = useDataStore.getState().syncDataFromServer;
    const syncHomeContent = useHomeContentStore.getState().syncFromServer;
    
    // 延迟同步，避免与登录时的同步冲突（一切以服务器为准）
    const initialSyncTimer = setTimeout(() => {
      syncDataFromServer(0, true); // 强制优先使用服务器数据
      // 同步首页内容
      syncHomeContent();
    }, 1000);
    
    return () => {
      clearTimeout(initialSyncTimer);
    };
  }, [isAuthenticated, isBanned]);

  // 页面可见性变化时自动同步（刷新网页、切换标签页等）
  // 确保B设备刷新网页后能从服务器获取最新数据
  useEffect(() => {
    if (!isAuthenticated || isBanned) return;
    
    const syncDataFromServer = useDataStore.getState().syncDataFromServer;
    const syncHomeContent = useHomeContentStore.getState().syncFromServer;
    const syncTimers: ReturnType<typeof setTimeout>[] = [];
    
    // 页面可见性变化处理
    const handleVisibilityChangeWrapper = () => {
      if (document.visibilityState === 'visible') {
        // 页面变为可见时，从服务器同步数据（确保B设备刷新后能获取最新数据）
        const syncTimer = setTimeout(() => {
          console.log('[Layout] 页面可见，强制从服务器同步数据');
          syncDataFromServer(0, true); // 强制优先使用服务器数据
          syncHomeContent(); // 同步首页内容
        }, 300);
        syncTimers.push(syncTimer);
      } else if (document.visibilityState === 'hidden') {
        // 页面隐藏时，立即同步本地变更到服务器
        console.log('[Layout] 页面隐藏，立即同步数据');
        const { currentUser } = useUserStore.getState();
        if (currentUser) {
          // 使用 syncDataToServer 同步（会检查是否有变化）
          useDataStore.getState().syncDataToServer();
          // 同步首页内容
          useHomeContentStore.getState().syncToServer();
        }
      }
    };
    
    // 页面加载时立即同步一次（刷新网页时）
    const handleLoad = () => {
      // 延迟1秒同步，确保登录同步已完成
      const syncTimer = setTimeout(() => {
        console.log('[Layout] 页面加载完成，强制从服务器同步数据');
        syncDataFromServer(0, true); // 强制优先使用服务器数据
        syncHomeContent(); // 同步首页内容
      }, 1000);
      syncTimers.push(syncTimer);
    };
    
    // 页面获得焦点时同步（切换回标签页时）
    const handleFocus = () => {
      const syncTimer = setTimeout(() => {
        console.log('[Layout] 页面获得焦点，强制从服务器同步数据');
        syncDataFromServer(0, true); // 强制优先使用服务器数据
        syncHomeContent(); // 同步首页内容
      }, 300);
      syncTimers.push(syncTimer);
    };
    
    // 兜底同步（每3分钟同步一次，确保数据一致性）
    const fallbackSyncInterval = setInterval(() => {
      console.log('[Layout] 兜底同步（3分钟）');
      // 只从服务器拉取，不上传（避免无变化时也上传）
      syncDataFromServer(0, true); // 强制优先使用服务器数据
      syncHomeContent(); // 同步首页内容
    }, 3 * 60 * 1000); // 3分钟
    
    // 监听网络状态，恢复网络后自动同步
    const handleOnline = () => {
      console.log('[Layout] 网络恢复，自动同步');
      setTimeout(() => {
        // 延迟1秒，确保网络稳定
        syncDataFromServer(0, true);
        syncHomeContent();
        // 如果有未同步的变更，触发上传
        const { pendingChanges } = useDataStore.getState();
        if (pendingChanges) {
          useDataStore.getState().syncDataToServer();
        }
      }, 1000);
    };
    
    window.addEventListener('online', handleOnline);
    
    // 页面加载时立即同步一次（刷新网页时）
    // 注意：load 事件可能在组件挂载后已经触发，所以需要检查
    if (document.readyState === 'complete') {
      // 页面已经加载完成，立即同步
      handleLoad();
    } else {
      // 页面还在加载，等待 load 事件
      window.addEventListener('load', handleLoad);
    }
    
    // 添加事件监听器
    document.addEventListener('visibilitychange', handleVisibilityChangeWrapper);
    window.addEventListener('focus', handleFocus);
    
    // 清理函数
    return () => {
      // 清除所有定时器
      syncTimers.forEach(timer => clearTimeout(timer));
      clearInterval(fallbackSyncInterval);
      // 移除事件监听器
      document.removeEventListener('visibilitychange', handleVisibilityChangeWrapper);
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
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
    <div className={`layout ${USE_NEW_UI ? 'layout-new' : ''}`}>
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
      {/* 在新建记事页面时隐藏 TopBar 和 TopNav */}
      {!isNewNotePage && <TopBar />}
      {!isNewNotePage && <TopNav />}
      <main className={`main-content ${USE_NEW_UI ? 'main-content-new' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;







