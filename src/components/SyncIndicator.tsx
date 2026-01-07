/**
 * 新UI的同步指示器
 * 显示三个旋转的蓝色点和"同步中..."文字
 */
import { useDataStore } from '../stores/dataStore';
import './SyncIndicator.css';

const SyncIndicator = () => {
  const isUploading = useDataStore((state) => state.isUploading);
  const isDownloading = useDataStore((state) => state.isDownloading);

  // 如果不在同步，不显示
  if (!isUploading && !isDownloading) {
    return null;
  }

  return (
    <div className="sync-indicator">
      <div className="sync-dots">
        <span className="sync-dot"></span>
        <span className="sync-dot"></span>
        <span className="sync-dot"></span>
      </div>
      <span className="sync-text">同步中...</span>
    </div>
  );
};

export default SyncIndicator;





















