import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { Note, Url, Folder } from '../types';
import { useTranslation } from '../i18n/useTranslation';
import { format } from 'date-fns';
import ListItem from '../components/ListItem';
import './TrashPage.css';

type TrashItem = {
  id: string;
  type: 'note' | 'url' | 'folder';
  data: Note | Url | Folder;
  deletedAt: number;
};

const TrashPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const folders = useDataStore((state) => state.folders);
  const notes = useDataStore((state) => state.notes);
  const urls = useDataStore((state) => state.urls);
  const restoreFromTrash = useDataStore((state) => state.restoreFromTrash);
  const permanentlyDelete = useDataStore((state) => state.permanentlyDelete);
  const cleanExpiredTrash = useDataStore((state) => state.cleanExpiredTrash);
  
  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 自动清理过期文件
    cleanExpiredTrash();
    
    // 调试：检查数据
    console.log('[TrashPage] useEffect - 检查数据:', {
      foldersCount: folders.length,
      notesCount: notes.length,
      urlsCount: urls.length,
      allFolders: folders.map(f => ({ id: f.id, name: f.name, isDeleted: f.isDeleted, deletedAt: f.deletedAt })),
      allNotes: notes.map(n => ({ id: n.id, isDeleted: n.isDeleted, deletedAt: n.deletedAt })),
      allUrls: urls.map(u => ({ id: u.id, title: u.title, isDeleted: u.isDeleted, deletedAt: u.deletedAt })),
    });
  }, [folders, notes, urls, cleanExpiredTrash]);

  // 基于 isDeleted 字段构建回收站列表
  const trashItems = useMemo<TrashItem[]>(() => {
    const items: TrashItem[] = [];
    
    // 调试：记录所有数据
    // 修复：只检查 isDeleted，不要求 deletedAt（因为服务器可能返回 deletedAt: null）
    const deletedFolders = folders.filter((f) => f.isDeleted === true);
    const deletedNotes = notes.filter((n) => n.isDeleted === true);
    const deletedUrls = urls.filter((u) => u.isDeleted === true);
    
    // 详细调试：检查每个文件夹的 isDeleted 状态
    const foldersWithDeletedStatus = folders.map((f) => ({
      id: f.id,
      name: f.name,
      isDeleted: f.isDeleted,
      deletedAt: f.deletedAt,
      hasDeletedAt: !!f.deletedAt,
    }));
    
    console.log('[TrashPage] 回收站数据统计:', {
      totalFolders: folders.length,
      deletedFolders: deletedFolders.length,
      totalNotes: notes.length,
      deletedNotes: deletedNotes.length,
      totalUrls: urls.length,
      deletedUrls: deletedUrls.length,
    });
    
    console.log('[TrashPage] 所有文件夹的删除状态:', foldersWithDeletedStatus);
    
    // 如果应该有已删除的项目但没有找到，输出警告
    if (folders.length > 0 && deletedFolders.length === 0 && deletedNotes.length === 0 && deletedUrls.length === 0) {
      console.warn('[TrashPage] ⚠️ 警告：有数据但没有找到已删除的项目！', {
        folders: folders.map(f => ({ id: f.id, name: f.name, isDeleted: f.isDeleted, deletedAt: f.deletedAt })),
        notes: notes.map(n => ({ id: n.id, isDeleted: n.isDeleted, deletedAt: n.deletedAt })),
        urls: urls.map(u => ({ id: u.id, isDeleted: u.isDeleted, deletedAt: u.deletedAt })),
      });
    }
    
    // 添加已删除的文件夹
    deletedFolders.forEach((folder) => {
      items.push({
        id: folder.id,
        type: 'folder',
        data: folder,
        deletedAt: folder.deletedAt || folder.updatedAt || Date.now(), // 如果 deletedAt 为 null，使用 updatedAt 或当前时间
      });
    });
    
    // 添加已删除的笔记
    deletedNotes.forEach((note) => {
      items.push({
        id: note.id,
        type: 'note',
        data: note,
        deletedAt: note.deletedAt || note.updatedAt || Date.now(), // 如果 deletedAt 为 null，使用 updatedAt 或当前时间
      });
    });
    
    // 添加已删除的网址
    deletedUrls.forEach((url) => {
      items.push({
        id: url.id,
        type: 'url',
        data: url,
        deletedAt: url.deletedAt || url.updatedAt || Date.now(), // 如果 deletedAt 为 null，使用 updatedAt 或当前时间
      });
    });
    
    // 按删除时间倒序排列（最近删除的在前）
    return items.sort((a, b) => b.deletedAt - a.deletedAt);
  }, [folders, notes, urls]);

  const getTrashItemTitle = (item: TrashItem) => {
    if (item.type === 'note') {
      const note = item.data as Note;
      return note.content.substring(0, 50) + (note.content.length > 50 ? '...' : '');
    } else if (item.type === 'url') {
      const url = item.data as Url;
      return url.title;
    } else {
      const folder = item.data as Folder;
      return folder.name;
    }
  };

  const getTrashItemSubtitle = (item: TrashItem) => {
    const deletedDate = format(new Date(item.deletedAt), 'yyyy-MM-dd HH:mm');
    const daysLeft = Math.ceil((30 * 24 * 60 * 60 * 1000 - (Date.now() - item.deletedAt)) / (24 * 60 * 60 * 1000));
    return `删除于 ${deletedDate} · 剩余 ${daysLeft} 天`;
  };

  const getTrashItemIcon = (item: TrashItem) => {
    if (item.type === 'note') return '📝';
    if (item.type === 'url') return '🌐';
    return '📁';
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.size === trashItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trashItems.map(item => item.id)));
    }
  };

  // 切换单个项目的选中状态
  const handleToggleSelect = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedIds(newSelectedIds);
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    if (window.confirm(`确定要永久删除选中的 ${selectedIds.size} 个项目吗？此操作不可恢复。`)) {
      // 优化：批量删除时，先收集所有要删除的项，然后一次性删除
      // 这样可以避免多次同步请求造成的竞态条件
      const idsToDelete = Array.from(selectedIds);
      idsToDelete.forEach(id => {
        permanentlyDelete(id);
      });
      setSelectedIds(new Set());
    }
  };

  // 批量恢复
  const handleBatchRestore = () => {
    if (selectedIds.size === 0) return;
    
    selectedIds.forEach(id => {
      restoreFromTrash(id);
    });
    setSelectedIds(new Set());
  };

  const isAllSelected = trashItems.length > 0 && selectedIds.size === trashItems.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="trash-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('trash')}</h1>
      </div>
      
      {trashItems.length > 0 && (
        <div className="trash-toolbar">
          <label className="select-all-checkbox">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
            />
            <span>全选</span>
          </label>
          {hasSelection && (
            <div className="batch-actions">
              <button
                className="batch-restore-btn"
                onClick={handleBatchRestore}
              >
                批量恢复 ({selectedIds.size})
              </button>
              <button
                className="batch-delete-btn"
                onClick={handleBatchDelete}
              >
                批量删除 ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="trash-list">
        {trashItems.length === 0 ? (
          <div className="empty-state">回收站为空</div>
        ) : (
          trashItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div key={item.id} className={`trash-item ${isSelected ? 'selected' : ''}`}>
                <div className="trash-item-content">
                  <label className="item-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.id)}
                    />
                  </label>
                  <div className="item-info" onClick={() => handleToggleSelect(item.id)}>
                    <ListItem
                      icon={getTrashItemIcon(item)}
                      title={getTrashItemTitle(item)}
                      subtitle={getTrashItemSubtitle(item)}
                    />
                  </div>
                </div>
                {!hasSelection && (
                  <div className="trash-actions">
                    <button
                      className="restore-btn"
                      onClick={() => restoreFromTrash(item.id)}
                    >
                      恢复
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => permanentlyDelete(item.id)}
                    >
                      永久删除
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrashPage;

