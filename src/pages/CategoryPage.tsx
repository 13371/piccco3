import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { Folder, FolderColor } from '../types';
import { eventEmitter } from '../utils/events';
import ListItem from '../components/ListItem';
import FolderIcon from '../components/FolderIcon';
import Modal from '../components/Modal';
import ContextMenu from '../components/ContextMenu';
import PasswordModal from '../components/PasswordModal';
import { useTranslation } from '../i18n/useTranslation';
import { AddIcon, StarIcon, EditIcon, TrashIcon } from '../components/Icons';
import './CategoryPage.css';

const CategoryPage = () => {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<string | null>(null);
  const [passwordMode, setPasswordMode] = useState<'verify' | 'set' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<'normal' | 'privacy' | 'url'>('normal');
  const [newFolderPassword, setNewFolderPassword] = useState('');
  
  // 分类页面只显示普通文件夹和隐私文件夹，不显示网址文件夹，且不显示已删除的文件夹
  // 使用 Map 去重，确保每个 ID 只显示一次
  // 关键修复：如果同一个ID有多个版本，优先保留未删除的版本，如果都删除或都未删除，保留 updatedAt 最新的
  const folders = useDataStore((state) => {
    const folderMap = new Map<string, typeof state.folders[0]>();
    state.folders
      .filter((f) => f.type !== 'url')
      .forEach((f) => {
        const existing = folderMap.get(f.id);
        if (!existing) {
          // 第一个版本，直接添加（但只添加未删除的）
          if (!f.isDeleted) {
            folderMap.set(f.id, f);
          }
        } else {
          // 已存在，需要判断保留哪个
          if (f.isDeleted && !existing.isDeleted) {
            // 新的是已删除，旧的是未删除，保留未删除的
            // 不更新
          } else if (!f.isDeleted && existing.isDeleted) {
            // 新的是未删除，旧的是已删除，保留未删除的
            folderMap.set(f.id, f);
          } else if ((f.updatedAt || 0) > (existing.updatedAt || 0)) {
            // 两者删除状态相同，保留 updatedAt 更新的
            folderMap.set(f.id, f);
          }
        }
      });
    // 最后过滤掉已删除的（双重保险）
    return Array.from(folderMap.values()).filter((f) => !f.isDeleted);
  });
  const addFolder = useDataStore((state) => state.addFolder);
  const updateFolder = useDataStore((state) => state.updateFolder);
  const deleteFolder = useDataStore((state) => state.deleteFolder);
  const toggleFolderStar = useDataStore((state) => state.toggleFolderStar);
  const changeFolderColor = useDataStore((state) => state.changeFolderColor);
  const reorderFolder = useDataStore((state) => state.reorderFolder);
  const verifyFolderPassword = useDataStore((state) => state.verifyFolderPassword);
  const navigate = useNavigate();
  
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const colors: FolderColor[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleAddItem = () => {
      setShowAddModal(true);
    };
    eventEmitter.on('add-item', handleAddItem);
    return () => {
      eventEmitter.off('add-item', handleAddItem);
    };
  }, []);

  // 移除自动创建默认文件夹的逻辑
  // 默认文件夹应该由 dataStore 的 onRehydrateStorage 统一管理
  // 这里不再自动创建，避免重复创建和ID冲突

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      if (editingFolder) {
        const updates: Partial<Folder> = {
          name: newFolderName,
        };
        // 只有在新密码不为空时才更新密码
        if (newFolderType === 'privacy' && newFolderPassword.trim()) {
          updates.password = newFolderPassword;
        }
        updateFolder(editingFolder, updates);
        setEditingFolder(null);
      } else {
        // 新建模式：只能创建普通文件夹
        addFolder(
          newFolderName,
          'normal',
          'blue',
          undefined
        );
      }
      setNewFolderName('');
      setNewFolderPassword('');
      setNewFolderType('normal');
      setShowAddModal(false);
    }
  };

  const handleFolderClick = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    if (folder.type === 'privacy') {
      setShowPasswordModal(folderId);
      // 如果还没有设置密码，则首次进入时先设置新密码
      if (!folder.password) {
        setPasswordMode('set');
      } else {
        setPasswordMode('verify');
      }
    } else {
      navigate(`/category/${folderId}`);
    }
  };

  const handlePasswordConfirm = (folderId: string, password: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    // 首次设置密码
    if (passwordMode === 'set' || !folder.password) {
      updateFolder(folderId, { password });
      setShowPasswordModal(null);
      setPasswordMode(null);
      navigate(`/category/${folderId}`);
      return;
    }

    // 已有密码时校验
    if (verifyFolderPassword(folderId, password)) {
      setShowPasswordModal(null);
      setPasswordMode(null);
      navigate(`/category/${folderId}`);
    } else {
      alert('密码错误，请重试');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
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

  // 排序：星标置顶，然后按手动排序（order）
  const sortedFolders = [...folders].sort((a, b) => {
    if (a.isStarred !== b.isStarred) {
      return a.isStarred ? -1 : 1;
    }
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    return orderA - orderB;
  });

  const folder = contextMenu ? folders.find((f) => f.id === contextMenu.id) : null;

  return (
    <div className="category-page">
      <h1 className="page-title">{t('category')}</h1>
      <button className="add-folder-button" onClick={() => setShowAddModal(true)}>
        <AddIcon /> <span>{t('newFolder')}</span>
      </button>
      <div className="folders-list">
        {sortedFolders.length === 0 ? (
          <div className="empty-state">暂无文件夹</div>
        ) : (
          sortedFolders.map((folderItem) => (
            <div
              key={folderItem.id}
              className="folder-item-wrapper"
              onContextMenu={(e) => handleContextMenu(e, folderItem.id)}
              draggable
              onDragStart={() => setEditingFolder(folderItem.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (editingFolder && editingFolder !== folderItem.id) {
                  reorderFolder(editingFolder, folderItem.id);
                }
                setEditingFolder(null);
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
                subtitle={
                  folderItem.type === 'privacy'
                    ? t('privacyFolderType')
                    : folderItem.type === 'url'
                    ? t('urlFolderType')
                    : t('normalFolderType')
                }
                isStarred={folderItem.isStarred}
                onClick={() => handleFolderClick(folderItem.id)}
                onMenuClick={(e) => handleContextMenu(e, folderItem.id)}
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
                setEditingFolder(folder.id);
                setNewFolderName(folder.name);
                setNewFolderType(folder.type);
                setShowAddModal(true);
                setContextMenu(null);
              },
            },
            // 隐私文件夹不能被删除
            ...(folder.type !== 'privacy'
              ? [
                  {
                    label: t('delete'),
                    icon: <TrashIcon />,
                    onClick: async () => {
                      const result = await deleteFolder(folder.id);
                      if (!result.ok) {
                        setDeleteError(result.message || '删除失败');
                      }
                    },
                    danger: true,
                  },
                ]
              : []),
          ]}
        />
      )}

      {showPasswordModal && (
        <PasswordModal
          isOpen={true}
          onClose={() => {
            setShowPasswordModal(null);
            setPasswordMode(null);
          }}
          onConfirm={(password) => handlePasswordConfirm(showPasswordModal, password)}
          mode={passwordMode || 'verify'}
          title={passwordMode === 'set' ? '设置隐私文件夹密码' : '输入密码'}
        />
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingFolder(null);
          setNewFolderName('');
          setNewFolderPassword('');
          setNewFolderType('normal');
        }}
        title={editingFolder ? t('editFolder') : t('newFolderTitle')}
      >
        <div className="add-folder-form">
          <input
            type="text"
            placeholder={t('folderName')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="form-input"
          />
          {/* 新建时只能创建普通文件夹，编辑时显示类型选择 */}
          {editingFolder && (
            <select
              value={newFolderType}
              onChange={(e) => setNewFolderType(e.target.value as 'normal' | 'privacy' | 'url')}
              className="form-input"
            >
              <option value="normal">{t('normalFolder')}</option>
              <option value="privacy">{t('privacyFolder')}</option>
              <option value="url">{t('urlFolder')}</option>
            </select>
          )}
          {newFolderType === 'privacy' && (
            <input
              type="password"
              placeholder={editingFolder ? t('keepEmptyNoChange') : t('setPassword')}
              value={newFolderPassword}
              onChange={(e) => setNewFolderPassword(e.target.value)}
              className="form-input"
            />
          )}
          <button onClick={handleAddFolder} className="form-button">
            {editingFolder ? t('save') : t('create')}
          </button>
        </div>
      </Modal>

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
        isOpen={!!deleteError}
        onClose={() => setDeleteError(null)}
        title="无法删除"
      >
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default CategoryPage;

