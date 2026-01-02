import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ListItem from '../components/ListItem';
import Modal from '../components/Modal';
import { useSettingsStore } from '../stores/settingsStore';
import { useDataStore } from '../stores/dataStore';
import { useTranslation } from '../i18n/useTranslation';
import {
  DeviceManagementIcon,
  SortManagementIcon,
  FontSizeIcon,
  NightModeIcon,
  LanguageIcon,
  UserAgreementIcon,
  VersionUpdateIcon,
} from '../components/Icons';
import './SettingsPage.css';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sortMode = useSettingsStore((state) => state.sortMode);
  const setSortMode = useSettingsStore((state) => state.setSortMode);
  const [showSortModal, setShowSortModal] = useState(false);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const [showFontModal, setShowFontModal] = useState(false);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const nightMode = useSettingsStore((state) => state.nightMode);
  const setNightMode = useSettingsStore((state) => state.setNightMode);
  const [showNightModal, setShowNightModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  
  // 同步状态
  const isUploading = useDataStore((state) => state.isUploading);
  const isDownloading = useDataStore((state) => state.isDownloading);
  const syncError = useDataStore((state) => state.syncError);
  const syncSuccess = useDataStore((state) => state.syncSuccess);
  const lastSyncTime = useDataStore((state) => state.lastSyncTime);
  const pendingChanges = useDataStore((state) => state.pendingChanges);
  const syncDataFromServer = useDataStore((state) => state.syncDataFromServer);
  const syncDataToServer = useDataStore((state) => state.syncDataToServer);
  const clearSyncError = useDataStore((state) => state.clearSyncError);
  const forceResetSyncState = useDataStore((state) => state.forceResetSyncState);
  
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
  
  // 手动同步（先上传本地数据，再下载服务器数据，一切以服务器为准）
  const handleManualSync = async () => {
    clearSyncError();
    // 先上传本地数据（如果有待同步的变更）
    if (pendingChanges) {
      await syncDataToServer();
    }
    // 然后从服务器下载数据并合并（一切以服务器为准）
    await syncDataFromServer(0, true); // 强制优先使用服务器数据
  };
  
  // 获取同步状态文本
  const getSyncStatusText = () => {
    if (isUploading || isDownloading) {
      return isUploading ? '上传中...' : '下载中...';
    }
    if (syncError) {
      return syncError;
    }
    if (syncSuccess) {
      return '同步成功';
    }
    if (pendingChanges) {
      return '待同步';
    }
    if (lastSyncTime) {
      const timeText = formatLastSyncTime(lastSyncTime);
      return timeText ? `已同步 ${timeText}` : '已同步';
    }
    return '未同步';
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

  const settingSubItems = [
    {
      icon: <DeviceManagementIcon />,
      title: t('deviceManagementTitle'),
      onClick: () => {
        navigate('/devices');
      },
    },
    {
      icon: <SortManagementIcon />,
      title: t('sortManagementTitle'),
      onClick: () => {
        setShowSortModal(true);
      },
    },
    {
      icon: <FontSizeIcon />,
      title: t('fontSizeTitle'),
      onClick: () => {
        setShowFontModal(true);
      },
    },
    {
      icon: <NightModeIcon />,
      title: t('nightModeTitle'),
      onClick: () => {
        setShowNightModal(true);
      },
    },
    {
      icon: <LanguageIcon />,
      title: t('languageTitle'),
      onClick: () => {
        setShowLanguageModal(true);
      },
    },
    {
      icon: <UserAgreementIcon />,
      title: t('userAgreementTitle'),
      onClick: () => {
        navigate('/user-agreement');
      },
    },
    {
      icon: <VersionUpdateIcon />,
      title: '版本更新说明',
      onClick: () => {
        setShowVersionModal(true);
      },
    },
    {
      icon: <span>📋</span>,
      title: '日志查看器',
      onClick: () => {
        navigate('/logs');
      },
    },
  ];
  
  const syncStatusText = getSyncStatusText();
  const syncStatusIcon = isUploading || isDownloading ? '⏳' : 
                         syncError ? '⚠️' : 
                         syncSuccess ? '✅' : 
                         pendingChanges ? '⏸️' : '✓';

  return (
    <div className="settings-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('settings')}</h1>
      </div>
      <div className="settings-list">
        {/* 同步状态 */}
        <div className="sync-status-item">
          <div className="sync-status-content">
            <span className="sync-status-icon">{syncStatusIcon}</span>
            <div className="sync-status-info">
              <div className="sync-status-title">数据同步</div>
              <div className={`sync-status-text ${
                isUploading || isDownloading ? 'syncing' :
                syncError ? 'error' :
                syncSuccess ? 'success' :
                pendingChanges ? 'pending' : 'idle'
              }`}>
                {syncStatusText}
              </div>
            </div>
          </div>
          <div className="sync-buttons">
            <button 
              className="sync-button"
              onClick={handleManualSync}
              disabled={isUploading || isDownloading}
            >
              {isUploading || isDownloading ? '同步中...' : '同步'}
            </button>
            {(isUploading || isDownloading) && (
              <button 
                className="sync-reset-button"
                onClick={() => {
                  if (window.confirm('同步似乎卡住了，是否重置同步状态？')) {
                    forceResetSyncState();
                  }
                }}
                title="重置同步状态"
              >
                重置
              </button>
            )}
          </div>
        </div>
        
        {settingSubItems.map((item, index) => (
          <ListItem
            key={index}
            icon={item.icon}
            title={item.title}
            onClick={item.onClick}
          />
        ))}
      </div>
      <Modal
        isOpen={showSortModal}
        onClose={() => setShowSortModal(false)}
        title={t('sortManagementTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="sortMode"
                value="updatedAt"
                checked={sortMode === 'updatedAt'}
                onChange={() => setSortMode('updatedAt')}
              />
              {t('sortByTime')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="sortMode"
                value="name"
                checked={sortMode === 'name'}
                onChange={() => setSortMode('name')}
              />
              {t('sortByName')}
            </label>
          </div>
          <p className="sort-tip">
            {t('sortTip')}
          </p>
        </div>
      </Modal>
      <Modal
        isOpen={showFontModal}
        onClose={() => setShowFontModal(false)}
        title={t('fontSizeTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="fontSize"
                value="small"
                checked={fontSize === 'small'}
                onChange={() => setFontSize('small')}
              />
              {t('fontSizeSmall')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="fontSize"
                value="medium"
                checked={fontSize === 'medium'}
                onChange={() => setFontSize('medium')}
              />
              {t('fontSizeMedium')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="fontSize"
                value="large"
                checked={fontSize === 'large'}
                onChange={() => setFontSize('large')}
              />
              {t('fontSizeLarge')}
            </label>
          </div>
          <p className="sort-tip">
            {t('fontSizeTip')}
          </p>
        </div>
      </Modal>
      <Modal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title={t('languageTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="language"
                value="zh"
                checked={language === 'zh'}
                onChange={() => setLanguage('zh')}
              />
              {t('languageZh')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="language"
                value="en"
                checked={language === 'en'}
                onChange={() => setLanguage('en')}
              />
              {t('languageEn')}
            </label>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={showNightModal}
        onClose={() => setShowNightModal(false)}
        title={t('nightModeTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="nightMode"
                value="day"
                checked={nightMode === 'day'}
                onChange={() => setNightMode('day')}
              />
              {t('nightModeDay')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="nightMode"
                value="night"
                checked={nightMode === 'night'}
                onChange={() => setNightMode('night')}
              />
              {t('nightModeNight')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="nightMode"
                value="auto"
                checked={nightMode === 'auto'}
                onChange={() => setNightMode('auto')}
              />
              {t('nightModeAuto')}
            </label>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        title="版本更新说明 v1.15（测试版）"
      >
        <div className="version-update-content">
          <div className="version-section">
            <h3 className="version-section-title">✨ 新增功能</h3>
            <ul className="version-list">
              <li>首页大白框内容独立存储，不再与其他文件夹关联</li>
              <li>导航栏从底部移至顶部，去掉图标只保留文字标签</li>
              <li>新建记事从弹窗改为全屏页面，提供更好的编辑体验</li>
              <li>记事编辑改为全屏页面，与新建页面保持一致</li>
              <li>同步状态移至设置页面，支持手动同步</li>
              <li>搜索框聚焦时，取消按钮显示蓝色背景</li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🎨 UI/UX 优化</h3>
            <ul className="version-list">
              <li>统一所有图标为蓝色 SVG 风格，提升视觉一致性</li>
              <li>顶部导航栏添加圆角设计</li>
              <li>新建记事页面 UI 更圆润，与整体风格更搭配</li>
              <li>设置页面选项适配夜间模式</li>
              <li>优化移动端新建/编辑页面光标可见性</li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🔧 功能优化</h3>
            <ul className="version-list">
              <li>优化自动同步逻辑：保存/编辑时自动同步，支持手动同步</li>
              <li>修复头像和用户名更改不同步的问题</li>
              <li>修复移动端光标在底部时被隐藏的问题</li>
              <li>改进移动端输入体验，确保光标始终可见</li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🐛 问题修复</h3>
            <ul className="version-list">
              <li>修复移动端登录问题（CORS 配置优化）</li>
              <li>修复后端路由注册问题</li>
              <li>修复同步状态显示问题</li>
              <li>修复夜间模式下的颜色显示问题</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;


