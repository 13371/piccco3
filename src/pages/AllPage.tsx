import { useMemo, useState, useEffect } from 'react';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import { format } from 'date-fns';
import { optimizeUrl, extractTitleFromUrl } from '../utils/urlOptimizer';
import ListItem from '../components/ListItem';
import ContextMenu from '../components/ContextMenu';
import Modal from '../components/Modal';
import { eventEmitter } from '../utils/events';
import './AllPage.css';

const AllPage = () => {
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isUrl, setIsUrl] = useState(false);
  const [urlFolderId, setUrlFolderId] = useState<string | undefined>(undefined);

  const notes = useDataStore((state) => state.getAllNotes(true));
  const folders = useDataStore((state) => state.folders.filter((f) => f.type === 'url'));
  const deleteNote = useDataStore((state) => state.deleteNote);
  const toggleNoteStar = useDataStore((state) => state.toggleNoteStar);
  const updateNote = useDataStore((state) => state.updateNote);
  const addNote = useDataStore((state) => state.addNote);
  const addUrl = useDataStore((state) => state.addUrl);
  const sortMode = useSettingsStore((state) => state.sortMode);

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

  // 排序：星标置顶，然后根据设置（更新时间 / 名称）
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.isStarred !== b.isStarred) {
        return a.isStarred ? -1 : 1;
      }
      if (sortMode === 'name') {
        const nameA = (a.content.split('\n')[0] || '').toLowerCase();
        const nameB = (b.content.split('\n')[0] || '').toLowerCase();
        return nameA.localeCompare(nameB, 'zh-CN');
      }
      // 默认：按最后编辑时间倒序
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, sortMode]);

  const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // 菜单显示在按钮下方，右对齐
    setContextMenu({ 
      id: noteId, 
      x: rect.right - 150, // 右对齐，减去菜单宽度
      y: rect.bottom + 4 // 按钮下方，加一点间距
    });
  };

  const handleEdit = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      setEditingNote(noteId);
      setEditContent(note.content);
      setShowEditModal(true);
      setContextMenu(null);
    }
  };

  const handleSaveEdit = () => {
    if (editingNote && editContent.trim()) {
      updateNote(editingNote, editContent);
      setShowEditModal(false);
      setEditingNote(null);
      setEditContent('');
    }
  };

  const handleAddItem = () => {
    if (newContent.trim()) {
      if (isUrl) {
        // 作为网址保存
        const optimizedUrl = optimizeUrl(newContent);
        const title = extractTitleFromUrl(optimizedUrl);
        addUrl(title, optimizedUrl, urlFolderId);
      } else {
        // 作为记事保存
        addNote(newContent);
      }
      setNewContent('');
      setIsUrl(false);
      setUrlFolderId(undefined);
      setShowAddModal(false);
    }
  };

  const handleContentChange = (value: string) => {
    setNewContent(value);
    // 检测是否是URL格式
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    if (urlPattern.test(value.trim())) {
      setIsUrl(true);
    }
  };

  const note = contextMenu ? notes.find((n) => n.id === contextMenu.id) : null;

  return (
    <div className="all-page">
      <h1 className="page-title">全部</h1>
      <button className="add-note-button" onClick={() => setShowAddModal(true)}>
        ➕ 新建记事
      </button>
      <div className="notes-list">
        {sortedNotes.length === 0 ? (
          <div className="empty-state">暂无记事</div>
        ) : (
          sortedNotes.map((noteItem) => (
            <div
              key={noteItem.id}
              onContextMenu={(e) => handleContextMenu(e, noteItem.id)}
              onClick={() => handleEdit(noteItem.id)}
            >
              <ListItem
                title={noteItem.content.substring(0, 50) + (noteItem.content.length > 50 ? '...' : '')}
                subtitle={format(new Date(noteItem.updatedAt), 'yyyy-MM-dd HH:mm')}
                isStarred={noteItem.isStarred}
                onMenuClick={(e) => handleContextMenu(e, noteItem.id)}
              />
            </div>
          ))
        )}
      </div>

      {note && contextMenu && (
        <ContextMenu
          isOpen={true}
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: '编辑',
              icon: '✏️',
              onClick: () => handleEdit(note.id),
            },
            {
              label: '删除',
              icon: '🗑️',
              onClick: () => deleteNote(note.id),
              danger: true,
            },
            {
              label: note.isStarred ? '取消星标' : '添加星标',
              icon: '⭐',
              onClick: () => toggleNoteStar(note.id),
            },
          ]}
        />
      )}

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingNote(null);
          setEditContent('');
        }}
        title="编辑记事"
      >
        <div className="edit-note-form">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="edit-note-input"
            rows={10}
          />
          <button onClick={handleSaveEdit} className="form-button">
            保存
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewContent('');
          setIsUrl(false);
          setUrlFolderId(undefined);
        }}
        title="新建记事"
      >
        <div className="edit-note-form">
          <textarea
            placeholder={isUrl ? "输入URL（例如：example.com）" : "输入内容..."}
            value={newContent}
            onChange={(e) => handleContentChange(e.target.value)}
            className="edit-note-input"
            rows={6}
          />
          <div className="form-checkbox-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={isUrl}
                onChange={(e) => setIsUrl(e.target.checked)}
              />
              <span>这是网址</span>
            </label>
          </div>
          {isUrl && (
            <div className="form-group">
              <label className="form-label">选择网址文件夹（可选）</label>
              <select
                value={urlFolderId || ''}
                onChange={(e) => setUrlFolderId(e.target.value || undefined)}
                className="form-input"
              >
                <option value="">不分类</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button onClick={handleAddItem} className="form-button">
            添加
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AllPage;

