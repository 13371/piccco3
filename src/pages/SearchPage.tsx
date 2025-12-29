import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { format } from 'date-fns';
import { optimizeUrl, extractTitleFromUrl } from '../utils/urlOptimizer';
import ListItem from '../components/ListItem';
import ContextMenu from '../components/ContextMenu';
import Modal from '../components/Modal';
import './SearchPage.css';
import './AllPage.css';

const SearchPage = () => {
  const navigate = useNavigate();
  const notes = useDataStore((state) => state.getAllNotes(true)); // 排除隐私文件夹
  const urls = useDataStore((state) => state.urls);
  const folders = useDataStore((state) => state.folders.filter((f) => f.type === 'privacy'));
  const privacyFolderIds = folders.map((f) => f.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; type: 'note' | 'url'; x: number; y: number } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; type: 'note' | 'url' } | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const deleteNote = useDataStore((state) => state.deleteNote);
  const toggleNoteStar = useDataStore((state) => state.toggleNoteStar);
  const updateNote = useDataStore((state) => state.updateNote);
  const deleteUrl = useDataStore((state) => state.deleteUrl);
  const toggleUrlStar = useDataStore((state) => state.toggleUrlStar);
  const updateUrl = useDataStore((state) => state.updateUrl);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 过滤掉隐私文件夹中的记事
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (!note.folderId) return true;
      return !privacyFolderIds.includes(note.folderId);
    });
  }, [notes, privacyFolderIds]);

  // 搜索结果
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { notes: [], urls: [] };

    const query = searchQuery.toLowerCase();
    
    const matchedNotes = filteredNotes
      .filter((note) => note.content.toLowerCase().includes(query))
      .sort((a, b) => {
        // 星标置顶，然后按更新时间倒序
        if (a.isStarred !== b.isStarred) {
          return a.isStarred ? -1 : 1;
        }
        return b.updatedAt - a.updatedAt;
      });

    const matchedUrls = urls
      .filter(
        (url) =>
          url.title.toLowerCase().includes(query) ||
          url.url.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // 星标置顶，然后按更新时间倒序
        if (a.isStarred !== b.isStarred) {
          return a.isStarred ? -1 : 1;
        }
        return b.updatedAt - a.updatedAt;
      });

    return { notes: matchedNotes, urls: matchedUrls };
  }, [searchQuery, filteredNotes, urls]);

  const handleContextMenu = (e: React.MouseEvent, id: string, type: 'note' | 'url') => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({ 
      id, 
      type,
      x: rect.right - 150,
      y: rect.bottom + 4
    });
  };

  const handleEdit = (id: string, type: 'note' | 'url') => {
    if (type === 'note') {
      const note = filteredNotes.find((n) => n.id === id);
      if (note) {
        setEditingItem({ id, type });
        setEditContent(note.content);
        setShowEditModal(true);
        setContextMenu(null);
      }
    } else {
      const urlItem = urls.find((u) => u.id === id);
      if (urlItem) {
        setEditingItem({ id, type });
        setEditTitle(urlItem.title);
        setEditUrl(urlItem.url);
        setShowEditModal(true);
        setContextMenu(null);
      }
    }
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    
    if (editingItem.type === 'note') {
      if (editContent.trim()) {
        updateNote(editingItem.id, editContent);
        setShowEditModal(false);
        setEditingItem(null);
        setEditContent('');
      }
    } else {
      if (editUrl.trim()) {
        const optimized = optimizeUrl(editUrl);
        const finalTitle = editTitle.trim() || extractTitleFromUrl(optimized);
        updateUrl(editingItem.id, {
          title: finalTitle,
          url: optimized,
        });
        setShowEditModal(false);
        setEditingItem(null);
        setEditTitle('');
        setEditUrl('');
      }
    }
  };

  const contextNote = contextMenu && contextMenu.type === 'note' 
    ? filteredNotes.find((n) => n.id === contextMenu.id) 
    : null;
  const contextUrl = contextMenu && contextMenu.type === 'url'
    ? urls.find((u) => u.id === contextMenu.id)
    : null;

  return (
    <div className="search-page">
      <div className="search-header">
        <button className="search-back-btn" onClick={() => navigate(-1)}>
          取消
        </button>
        <input
          type="text"
          className="search-input"
          placeholder="搜索记事和URL..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="search-results">
        {searchQuery.trim() ? (
          <>
            {searchResults.notes.length === 0 && searchResults.urls.length === 0 ? (
              <div className="empty-state">未找到相关内容</div>
            ) : (
              <>
                {searchResults.notes.length > 0 && (
                  <div className="results-section">
                    <h3 className="results-title">记事</h3>
                    {searchResults.notes.map((note) => (
                      <div key={note.id} onClick={() => handleEdit(note.id, 'note')}>
                        <ListItem
                          title={note.content.substring(0, 50) + (note.content.length > 50 ? '...' : '')}
                          subtitle={format(new Date(note.updatedAt), 'yyyy-MM-dd HH:mm')}
                          isStarred={note.isStarred}
                          onMenuClick={(e) => handleContextMenu(e, note.id, 'note')}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.urls.length > 0 && (
                  <div className="results-section">
                    <h3 className="results-title">网址</h3>
                    {searchResults.urls.map((url) => (
                      <div key={url.id} onClick={() => window.open(url.url, '_blank')}>
                        <ListItem
                          icon="🌐"
                          title={url.title}
                          subtitle={`${url.url} · ${format(new Date(url.updatedAt), 'yyyy-MM-dd HH:mm')}`}
                          isStarred={url.isStarred}
                          onMenuClick={(e) => handleContextMenu(e, url.id, 'url')}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="empty-state">输入关键词开始搜索</div>
        )}
      </div>

      {contextNote && contextMenu && contextMenu.type === 'note' && (
        <ContextMenu
          isOpen={true}
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: '编辑',
              icon: '✏️',
              onClick: () => handleEdit(contextNote.id, 'note'),
            },
            {
              label: '删除',
              icon: '🗑️',
              onClick: () => deleteNote(contextNote.id),
              danger: true,
            },
            {
              label: contextNote.isStarred ? '取消星标' : '添加星标',
              icon: '⭐',
              onClick: () => toggleNoteStar(contextNote.id),
            },
          ]}
        />
      )}

      {contextUrl && contextMenu && contextMenu.type === 'url' && (
        <ContextMenu
          isOpen={true}
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: '编辑',
              icon: '✏️',
              onClick: () => handleEdit(contextUrl.id, 'url'),
            },
            {
              label: '删除',
              icon: '🗑️',
              onClick: () => deleteUrl(contextUrl.id),
              danger: true,
            },
            {
              label: contextUrl.isStarred ? '取消星标' : '添加星标',
              icon: '⭐',
              onClick: () => toggleUrlStar(contextUrl.id),
            },
          ]}
        />
      )}

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
          setEditContent('');
          setEditTitle('');
          setEditUrl('');
        }}
        title={editingItem?.type === 'note' ? '编辑记事' : '编辑网址'}
      >
        {editingItem?.type === 'note' ? (
          <div className="edit-note-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="edit-note-input"
              rows={10}
            />
            <button onClick={handleSaveEdit} className="form-button" disabled={!editContent.trim()}>
              保存
            </button>
          </div>
        ) : (
          <div className="add-url-form">
            <input
              type="text"
              placeholder="标题（可选）"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="form-input"
            />
            <input
              type="text"
              placeholder="URL"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              className="form-input"
            />
            <button onClick={handleSaveEdit} className="form-button" disabled={!editUrl.trim()}>
              保存
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SearchPage;



