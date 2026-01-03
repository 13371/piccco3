import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../i18n/useTranslation';
import { eventEmitter } from '../utils/events';
import { FolderColor } from '../types';
import { optimizeUrl, extractTitleFromUrl } from '../utils/urlOptimizer';
import { logger } from '../utils/logger';
import ListItem from '../components/ListItem';
import Modal from '../components/Modal';
import ContextMenu from '../components/ContextMenu';
import FolderIcon from '../components/FolderIcon';
import { AddIcon, StarIcon, EditIcon, TrashIcon } from '../components/Icons';
import './UrlPage.css';

const UrlPage = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const colors: FolderColor[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];
  const folders = useDataStore((state) => state.folders.filter((f) => f.type === 'url' && !f.isDeleted));
  const addUrl = useDataStore((state) => state.addUrl);
  const updateUrl = useDataStore((state) => state.updateUrl);
  const addFolder = useDataStore((state) => state.addFolder);
  const deleteFolder = useDataStore((state) => state.deleteFolder);
  const toggleFolderStar = useDataStore((state) => state.toggleFolderStar);
  const changeFolderColor = useDataStore((state) => state.changeFolderColor);
  const updateFolder = useDataStore((state) => state.updateFolder);
  const reorderFolder = useDataStore((state) => state.reorderFolder);
  const getUrlsByFolder = useDataStore((state) => state.getUrlsByFolder);
  const sortMode = useSettingsStore((state) => state.sortMode);

  const handleAddUrl = () => {
    if (newUrl.trim()) {
      const optimizedUrl = optimizeUrl(newUrl);
      const title = newTitle.trim() || extractTitleFromUrl(optimizedUrl);
      
      if (contextMenu && url) {
        // 编辑模式
        updateUrl(url.id, {
          title,
          url: optimizedUrl,
          folderId: selectedFolderId,
        });
        setContextMenu(null);
      } else {
        // 新建模式
        addUrl(title, optimizedUrl, selectedFolderId);
      }
      setNewTitle('');
      setNewUrl('');
      setSelectedFolderId(undefined);
      setShowAddModal(false);
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const folderId = addFolder(newFolderName, 'url', 'blue');
      setSelectedFolderId(folderId);
      setNewFolderName('');
      setShowFolderModal(false);
    }
  };

  const handleUrlChange = (value: string) => {
    setNewUrl(value);
    // 如果标题为空，自动从URL提取标题
    if (!newTitle.trim() && value.trim()) {
      const optimized = optimizeUrl(value);
      if (optimized !== value) {
        setNewTitle(extractTitleFromUrl(optimized));
      }
    }
  };

  // 根据选中的文件夹过滤网址
  const filteredUrls = selectedFolderId
    ? getUrlsByFolder(selectedFolderId)
    : getUrlsByFolder(undefined); // 未分类的网址

  // 排序：星标置顶，然后根据设置（更新时间 / 名称）
  const sortedUrls = [...filteredUrls].sort((a, b) => {
    if (a.isStarred !== b.isStarred) {
      return a.isStarred ? -1 : 1;
    }
    if (sortMode === 'name') {
      const nameA = (a.title || '').toLowerCase();
      const nameB = (b.title || '').toLowerCase();
      return nameA.localeCompare(nameB, 'zh-CN');
    }
    return b.updatedAt - a.updatedAt;
  });

  // 获取当前选中的 URL（需要在 handleAddUrl 之前定义）
  const url = contextMenu ? sortedUrls.find((u) => u.id === contextMenu.id) : null;

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 初始化默认网址文件夹：常用、购物、工具（仅在没有任何网址文件夹时创建一次）
  useEffect(() => {
    const urlFolders = folders;
    if (urlFolders.length === 0) {
      addFolder('常用', 'url', 'blue');
      addFolder('购物', 'url', 'orange');
      addFolder('工具', 'url', 'green');
    }
  }, [folders.length, addFolder]);

  // 清理重复的默认网址文件夹（同名只保留一个）
  useEffect(() => {
    const urlFolders = folders;
    const targetNames = ['常用', '购物', '工具'];

    targetNames.forEach((name) => {
      const sameName = urlFolders.filter((f) => f.name === name);
      if (sameName.length > 1) {
        // 保留第一个，其余删除
        sameName
          .slice(1)
          .forEach(async (folder) => {
            const result = await deleteFolder(folder.id);
            if (!result.ok) {
              logger.warn('[UrlPage] 删除重复文件夹失败:', result.message);
            }
          });
      }
    });
  }, [folders, deleteFolder]);

  useEffect(() => {
    const handleAddItem = () => {
      setShowAddModal(true);
    };
    eventEmitter.on('add-item', handleAddItem);
    return () => {
      eventEmitter.off('add-item', handleAddItem);
    };
  }, []);

  // 排序文件夹：星标置顶，然后按手动排序（order）
  const sortedFolders = [...folders].sort((a, b) => {
    if (a.isStarred !== b.isStarred) {
      return a.isStarred ? -1 : 1;
    }
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    return orderA - orderB;
  });

  const handleFolderContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // 菜单显示在按钮下方，右对齐
    setContextMenu({ 
      id: folderId, 
      x: rect.right - 150, // 右对齐，减去菜单宽度
      y: rect.bottom + 4 // 按钮下方，加一点间距
    });
  };

  const handleFolderClick = (folderId: string) => {
    navigate(`/url/folder/${folderId}`);
  };

  const folder = contextMenu ? folders.find((f) => f.id === contextMenu.id) : null;

  return (
    <div className="url-page">
      <h1 className="page-title">{t('url')}</h1>
      {/* 添加文件夹的大按钮 */}
      <button className="add-url-button" onClick={() => setShowFolderModal(true)}>
        <AddIcon /> <span>{t('newFolder')}</span>
      </button>
      <div className="folders-list">
        {sortedFolders.length === 0 ? (
          <div className="empty-state">{t('noFolders')}</div>
        ) : (
          sortedFolders.map((folderItem) => (
            <div
              key={folderItem.id}
              className="folder-item-wrapper"
              onContextMenu={(e) => handleFolderContextMenu(e, folderItem.id)}
              draggable
              onDragStart={() => setSelectedFolderId(folderItem.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (selectedFolderId && selectedFolderId !== folderItem.id) {
                  reorderFolder(selectedFolderId, folderItem.id);
                }
                setSelectedFolderId(undefined);
              }}
            >
              <ListItem
                icon={(
                  <FolderIcon
                    color={folderItem.color}
                    type={folderItem.type}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorModal(folderItem.id);
                    }}
                  />
                )}
                title={folderItem.name}
                subtitle={t('urlFolderType')}
                isStarred={folderItem.isStarred}
                onClick={() => handleFolderClick(folderItem.id)}
                onMenuClick={(e) => handleFolderContextMenu(e, folderItem.id)}
              />
            </div>
          ))
        )}
      </div>

      {folder && contextMenu && (
        <ContextMenu
          isOpen={true}
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: folder.isStarred ? t('unstar') : t('star'),
              icon: <StarIcon filled={folder.isStarred} />,
              onClick: () => toggleFolderStar(folder.id),
            },
            {
              label: t('rename'),
              icon: <EditIcon />,
              onClick: () => {
                const newName = window.prompt(t('renameFolder'), folder.name);
                if (newName && newName.trim()) {
                  updateFolder(folder.id, { name: newName.trim() });
                }
              },
            },
            {
              label: t('delete'),
              icon: <TrashIcon />,
              onClick: async () => {
                const result = await deleteFolder(folder.id);
                if (!result.ok) {
                  alert(result.message || t('deleteFailed'));
                }
              },
              danger: true,
            },
          ]}
        />
      )}

      <Modal
        isOpen={showColorModal !== null}
        onClose={() => setShowColorModal(null)}
        title={t('chooseColor')}
      >
        <div className="color-picker">
          {colors.map((color) => (
            <button
              key={color}
              className={`color-option folder-color-${color}`}
              onClick={() => {
                if (showColorModal) {
                  changeFolderColor(showColorModal, color);
                  setShowColorModal(null);
                }
              }}
              title={color}
            />
          ))}
        </div>
      </Modal>
      
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setContextMenu(null);
          setNewTitle('');
          setNewUrl('');
        }}
        title={contextMenu && url ? t('editUrl') : t('addUrl')}
      >
        <div className="add-url-form">
          <input
            type="text"
            placeholder={t('urlTitleAuto')}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="form-input"
          />
          <input
            type="text"
            placeholder={t('urlPlaceholder')}
            value={newUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="form-input"
          />
          <div className="form-group">
            <label className="form-label">{t('selectFolder')}</label>
            <select
              value={selectedFolderId || ''}
              onChange={(e) => setSelectedFolderId(e.target.value || undefined)}
              className="form-input"
            >
              <option value="">{t('noCategory')}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="create-folder-link"
              onClick={() => {
                setShowAddModal(false);
                setShowFolderModal(true);
              }}
            >
              <AddIcon /> {t('newFolder')}
            </button>
          </div>
          <button onClick={handleAddUrl} className="form-button">
            {contextMenu && url ? t('save') : t('add')}
          </button>
        </div>
      </Modal>

      {/* 新建文件夹Modal */}
      <Modal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          setNewFolderName('');
        }}
        title={t('newUrlFolder')}
      >
        <div className="add-url-form">
          <input
            type="text"
            placeholder={t('folderName')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="form-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder();
              }
            }}
          />
          <button onClick={handleCreateFolder} className="form-button">
            {t('create')}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default UrlPage;

