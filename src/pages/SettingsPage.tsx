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
    
    if (seconds < 60) return t('justNow');
    if (minutes < 60) return `${minutes}${t('minutesAgo')}`;
    if (hours < 24) return `${hours}${t('hoursAgo')}`;
    const days = Math.floor(hours / 24);
    return `${days}${t('daysAgo')}`;
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
      return isUploading ? t('uploading') : t('downloading');
    }
    if (syncError) {
      return syncError;
    }
    if (syncSuccess) {
      return t('syncSuccess');
    }
    if (pendingChanges) {
      return t('syncPending');
    }
    if (lastSyncTime) {
      const timeText = formatLastSyncTime(lastSyncTime);
      return timeText ? `${t('syncCompleted')} ${timeText}` : t('syncCompleted');
    }
    return t('syncNotSynced');
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
      title: t('versionUpdate'),
      onClick: () => {
        setShowVersionModal(true);
      },
    },
    {
      icon: <span>📋</span>,
      title: t('logViewer'),
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
              <div className="sync-status-title">{t('syncTitle')}</div>
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
              {isUploading || isDownloading ? t('syncing') : t('sync')}
            </button>
            {(isUploading || isDownloading) && (
              <button 
                className="sync-reset-button"
                onClick={() => {
                  if (window.confirm(t('resetSyncConfirm'))) {
                    forceResetSyncState();
                  }
                }}
                title={t('resetSyncState')}
              >
                {t('reset')}
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
        title={`${t('versionUpdate')} v1.20（测试版）`}
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
              <li>文件夹删除保护：当文件夹内有记事或网址时，无法删除并提示用户</li>
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
              <li>优化帮助和反馈页面布局，提升阅读体验</li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🔧 功能优化</h3>
            <ul className="version-list">
              <li>优化自动同步逻辑：保存/编辑时自动同步，支持手动同步</li>
              <li>修复头像和用户名更改不同步的问题</li>
              <li>修复移动端光标在底部时被隐藏的问题</li>
              <li>改进移动端输入体验，确保光标始终可见</li>
              <li><strong>优化多设备同步机制：强制以服务器数据为准，确保数据一致性</strong></li>
              <li><strong>改进删除操作同步：删除操作现在能可靠地同步到所有设备</strong></li>
              <li><strong>优化数据合并策略：服务器数据优先，避免数据冲突</strong></li>
              <li><strong>统一日志系统：生产环境减少日志输出，提升性能</strong></li>
              <li><strong>改进异步错误处理：修复 setTimeout 中的异步函数错误处理问题</strong></li>
              <li><strong>优化后端去重逻辑：考虑删除状态，确保数据一致性</strong></li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🐛 问题修复</h3>
            <ul className="version-list">
              <li>修复移动端登录问题（CORS 配置优化）</li>
              <li>修复后端路由注册问题</li>
              <li>修复同步状态显示问题</li>
              <li>修复夜间模式下的颜色显示问题</li>
              <li><strong>修复删除操作不同步的问题：删除的记事、网址、文件夹现在能正确同步</strong></li>
              <li><strong>修复同步卡住问题：添加超时保护和状态重置机制</strong></li>
              <li><strong>修复后端 500 错误：修复变量作用域和命名错误</strong></li>
              <li><strong>修复数据不一致问题：登录时强制使用服务器数据，确保多设备数据一致</strong></li>
              <li><strong>修复 JSON 解析错误：改进错误处理，避免解析空响应</strong></li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🔒 系统优化</h3>
            <ul className="version-list">
              <li><strong>完善前后端连通性检查：确保所有 API 端点匹配</strong></li>
              <li><strong>优化认证机制：改进 Token 刷新和错误处理</strong></li>
              <li><strong>改进网络错误处理：添加超时、重试机制</strong></li>
              <li><strong>代码质量提升：添加代码检查报告和前后端协调性报告</strong></li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🚀 v1.171 新增优化</h3>
            <ul className="version-list">
              <li><strong>添加全局错误边界（ErrorBoundary）：捕获渲染错误，防止应用崩溃，提升稳定性</strong></li>
              <li><strong>统一日志管理系统：使用 logger 替代 console，生产环境自动过滤调试日志，提升性能</strong></li>
              <li><strong>完善代码注释：为复杂逻辑添加 JSDoc 注释，提升代码可维护性</strong></li>
              <li><strong>优化后端去重逻辑：考虑删除状态，确保删除操作不会丢失，提升数据一致性</strong></li>
              <li><strong>完善前后端同步检查：全面检查 API 路径、数据同步逻辑、多设备同步机制</strong></li>
              <li><strong>改进错误处理：优化异步函数错误处理，修复 setTimeout 中的错误处理问题</strong></li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🎨 v1.20 UI/UX 全面升级</h3>
            <ul className="version-list">
              <li><strong>全新 UI 设计：采用轻量、简洁、干净的风格，白色为主，浅蓝色点缀，毛玻璃效果，柔和阴影，圆角设计</strong></li>
              <li><strong>导航栏优化：胶囊形状，选中项使用浅蓝色渐变背景和蓝色文字，未选中项为灰色文字，添加阴影效果</strong></li>
              <li><strong>卡片样式统一：所有内容容器使用 14-20px 圆角，柔和阴影，白色/半透明白色背景，浅灰色边框</strong></li>
              <li><strong>我的页面重构：顶部个人信息卡片，圆形头像，用户名和邮箱左对齐，菜单项卡片化，大号红色退出按钮</strong></li>
              <li><strong>按钮样式统一：所有按钮使用浅蓝色背景（#90CAF9）和蓝色文字（#007AFF），保持视觉一致性</strong></li>
              <li><strong>夜间模式适配：完整适配深色主题，所有页面和组件支持夜间模式切换</strong></li>
              <li><strong>微交互动画：添加悬停和激活状态的轻微缩放动画（150-250ms 过渡），提升交互体验</strong></li>
              <li><strong>移动端优化：优化移动端页面长度，减少底部空白，提升滚动体验</strong></li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🔧 v1.20 功能优化</h3>
            <ul className="version-list">
              <li><strong>新建记事页面全屏化：新建和编辑记事都使用完整全屏页面，提供更好的编辑体验</strong></li>
              <li><strong>快速新建优化：点击快速新建按钮不再预先创建空白记事，避免产生无用条目</strong></li>
              <li><strong>取消逻辑优化：新建记事无内容时点击取消，不会创建空白记事条目</strong></li>
              <li><strong>TopBar 智能隐藏：在新建/编辑记事页面自动隐藏 TopBar 和 TopNav，提供沉浸式编辑体验</strong></li>
              <li><strong>版本号机制：实现乐观锁机制，使用版本号处理并发同步冲突，提升数据一致性</strong></li>
              <li><strong>数据验证增强：添加更严格的 ID、版本号、布尔值、时间戳验证，提升数据安全性</strong></li>
              <li><strong>审计日志：添加安全敏感操作的审计日志记录，包括用户登录、数据同步、权限变更等</strong></li>
              <li><strong>JWT 安全：强制要求 JWT_SECRET 环境变量，生产环境未设置时自动退出，提升安全性</strong></li>
            </ul>
          </div>
          
          <div className="version-section">
            <h3 className="version-section-title">🐛 v1.20 问题修复</h3>
            <ul className="version-list">
              <li><strong>修复移动端新建记事页面被遮挡问题：调整 padding-top，确保内容完整显示</strong></li>
              <li><strong>修复页面过长问题：优化移动端页面底部间距，减少不必要的滚动</strong></li>
              <li><strong>修复空白记事创建问题：优化新建逻辑，避免创建无内容的记事条目</strong></li>
              <li><strong>修复翻译问题：修复新建记事页面中"取消"、"保存"等按钮的翻译</strong></li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;


