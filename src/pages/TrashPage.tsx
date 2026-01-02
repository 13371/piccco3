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
  }, []);

  // 基于 isDeleted 字段构建回收站列表
  const trashItems = useMemo<TrashItem[]>(() => {
    const items: TrashItem[] = [];
    
    // 添加已删除的文件夹
    folders
      .filter((f) => f.isDeleted && f.deletedAt)
      .forEach((folder) => {
        items.push({
          id: folder.id,
          type: 'folder',
          data: folder,
          deletedAt: folder.deletedAt!,
        });
      });
    
    // 添加已删除的笔记
    notes
      .filter((n) => n.isDeleted && n.deletedAt)
      .forEach((note) => {
        items.push({
          id: note.id,
          type: 'note',
          data: note,
          deletedAt: note.deletedAt!,
        });
      });
    
    // 添加已删除的网址
    urls
      .filter((u) => u.isDeleted && u.deletedAt)
      .forEach((url) => {
        items.push({
          id: url.id,
          type: 'url',
          data: url,
          deletedAt: url.deletedAt!,
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
      selectedIds.forEach(id => {
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

