import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { FolderColor } from '../types';
import { eventEmitter } from '../utils/events';
import ListItem from '../components/ListItem';
import FolderIcon from '../components/FolderIcon';
import Modal from '../components/Modal';
import ContextMenu from '../components/ContextMenu';
import PasswordModal from '../components/PasswordModal';
import { useTranslation } from '../i18n/useTranslation';
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
  
  // 分类页面只显示普通文件夹和隐私文件夹，不显示网址文件夹
  const folders = useDataStore((state) => state.folders.filter((f) => f.type !== 'url'));
  const addFolder = useDataStore((state) => state.addFolder);
  const updateFolder = useDataStore((state) => state.updateFolder);
  const deleteFolder = useDataStore((state) => state.deleteFolder);
  const toggleFolderStar = useDataStore((state) => state.toggleFolderStar);
  const changeFolderColor = useDataStore((state) => state.changeFolderColor);
  const reorderFolder = useDataStore((state) => state.reorderFolder);
  const verifyFolderPassword = useDataStore((state) => state.verifyFolderPassword);
  const navigate = useNavigate();

  const colors: FolderColor[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

  const getNextColor = (current: FolderColor): FolderColor => {
    const index = colors.indexOf(current);
    const nextIndex = index === -1 ? 0 : (index + 1) % colors.length;
    return colors[nextIndex];
  };

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

  // 初始化默认文件夹（如果不存在）
  useEffect(() => {
    const currentFolders = folders;
    const hasPrivacy = currentFolders.some((f) => f.id === 'folder_privacy_default');
    const hasCategory1 = currentFolders.some((f) => f.id === 'folder_category1_default');
    const hasCategory2 = currentFolders.some((f) => f.id === 'folder_category2_default');

    if (!hasPrivacy || !hasCategory1 || !hasCategory2) {
      if (!hasPrivacy) {
        // 隐私文件夹首次打开时由用户自行设置密码
        addFolder(t('privacyFolder'), 'privacy', 'purple', undefined);
      }
      if (!hasCategory1) {
        addFolder(t('category1Default'), 'normal', 'blue');
      }
      if (!hasCategory2) {
        addFolder(t('category2Default'), 'normal', 'green');
      }
    }
  }, []);

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      if (editingFolder) {
        const updates: any = {
          name: newFolderName,
        };
        // 只有在新密码不为空时才更新密码
        if (newFolderType === 'privacy' && newFolderPassword.trim()) {
          updates.password = newFolderPassword;
        }
        updateFolder(editingFolder, updates);
        setEditingFolder(null);
      } else {
        addFolder(
          newFolderName,
          newFolderType,
          'blue',
          newFolderType === 'privacy' ? newFolderPassword : undefined
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
        ➕ {t('newFolder')}
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
              icon: '⭐',
              onClick: () => toggleFolderStar(folder.id),
            },
            {
              label: t('rename'),
              icon: '✏️',
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
                    icon: '🗑️',
                    onClick: () => deleteFolder(folder.id),
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
          onClose={() => setShowPasswordModal(null)}
          onConfirm={(password) => handlePasswordConfirm(showPasswordModal, password)}
          title={passwordMode === 'set' ? t('setPrivacyPassword') : t('enterPassword')}
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
          {!editingFolder && (
            <select
              value={newFolderType}
              onChange={(e) => setNewFolderType(e.target.value as any)}
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
    </div>
  );
};

export default CategoryPage;

