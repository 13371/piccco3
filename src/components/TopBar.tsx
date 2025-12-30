import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useEffect } from 'react';
import './TopBar.css';

const TopBar = () => {
  const navigate = useNavigate();
  const isUploading = useDataStore((state) => state.isUploading);
  const isDownloading = useDataStore((state) => state.isDownloading);
  const syncError = useDataStore((state) => state.syncError);
  const syncSuccess = useDataStore((state) => state.syncSuccess);
  const lastSyncTime = useDataStore((state) => state.lastSyncTime);
  const pendingChanges = useDataStore((state) => state.pendingChanges);
  const syncDataFromServer = useDataStore((state) => state.syncDataFromServer);
  const syncDataToServer = useDataStore((state) => state.syncDataToServer);
  const clearSyncError = useDataStore((state) => state.clearSyncError);

  const handleAdd = () => {
    // 快速新建记事，跳转到新建记事页面
    navigate('/new-note');
  };

  const handleSearch = () => {
    // 打开搜索页面
    navigate('/search');
  };

  const handleManualSync = async () => {
    clearSyncError();
    await syncDataFromServer();
    if (pendingChanges) {
      await syncDataToServer();
    }
  };

  // 格式化最后同步时间
  const formatLastSyncTime = (timestamp: number | null) => {
    if (!timestamp) return null;
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  // 自动隐藏错误提示（5秒后）
  useEffect(() => {
    if (syncError) {
      const timer = setTimeout(() => {
        clearSyncError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [syncError, clearSyncError]);

  // 获取同步状态文本和样式
  const getSyncStatus = () => {
    if (isUploading || isDownloading) {
      return { text: isUploading ? '上传中...' : '下载中...', className: 'sync-status syncing' };
    }
    if (syncError) {
      return { text: syncError, className: 'sync-status error' };
    }
    if (syncSuccess) {
      return { text: '同步成功', className: 'sync-status success' };
    }
    if (pendingChanges) {
      return { text: '待同步', className: 'sync-status pending' };
    }
    if (lastSyncTime) {
      const timeText = formatLastSyncTime(lastSyncTime);
      return { text: timeText ? `已同步 ${timeText}` : '已同步', className: 'sync-status idle' };
    }
    return null;
  };

  const syncStatus = getSyncStatus();

  return (
    <div className="top-bar">
      <div className="top-bar-row single-row">
        <button className="add-btn" onClick={handleAdd}>
          ➕
        </button>
        <h1 className="app-title">piccco</h1>
        <div className="top-bar-right">
          {syncStatus && (
            <div 
              className={syncStatus.className}
              onClick={handleManualSync}
              title="点击手动同步"
            >
              <span className="sync-icon">
                {isUploading || isDownloading ? '⏳' : 
                 syncError ? '⚠️' : 
                 syncSuccess ? '✅' : 
                 pendingChanges ? '⏸️' : '✓'}
              </span>
              <span className="sync-text">{syncStatus.text}</span>
            </div>
          )}
          <button className="search-btn" onClick={handleSearch}>🔍</button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;

