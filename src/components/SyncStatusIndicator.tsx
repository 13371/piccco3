/**
 * 同步状态指示器组件
 * 显示同步状态（同步中、成功、失败），不干扰用户操作
 */
import { useEffect, useState } from 'react';
import { useDataStore } from '../stores/dataStore';
import './SyncStatusIndicator.css';

const SyncStatusIndicator = () => {
  const isUploading = useDataStore((state) => state.isUploading);
  const isDownloading = useDataStore((state) => state.isDownloading);
  const syncError = useDataStore((state) => state.syncError);
  const syncSuccess = useDataStore((state) => state.syncSuccess);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (syncError) {
      setShowError(true);
      // 5秒后自动隐藏错误提示
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [syncError]);

  // 如果没有任何状态，不显示
  if (!isUploading && !isDownloading && !showError && !syncSuccess) {
    return null;
  }

  return (
    <div className="sync-status-indicator">
      {/* 同步中：小图标转圈 */}
      {(isUploading || isDownloading) && (
        <div className="sync-status-item sync-status-loading" title="同步中...">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="sync-spinner"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* 失败：角落提示 */}
      {showError && syncError && (
        <div className="sync-status-item sync-status-error" title={syncError}>
          <span>⚠️ 同步失败，将自动重试</span>
        </div>
      )}

      {/* 成功：短暂显示后消失 */}
      {syncSuccess && !isUploading && !isDownloading && (
        <div className="sync-status-item sync-status-success" title="同步成功">
          <span>✓</span>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;





























