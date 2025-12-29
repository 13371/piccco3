import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import { format } from 'date-fns';
import { optimizeUrl, extractTitleFromUrl } from '../utils/urlOptimizer';
import ListItem from '../components/ListItem';
import ContextMenu from '../components/ContextMenu';
import Modal from '../components/Modal';
import './UrlPage.css';

const FolderUrlsPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();

  const folder = useDataStore((state) =>
    state.getFolderById(folderId || '')
  );
  const urls = useDataStore((state) =>
    state.getUrlsByFolder(folderId)
  );
  const addUrl = useDataStore((state) => state.addUrl);
  const updateUrl = useDataStore((state) => state.updateUrl);
  const deleteUrl = useDataStore((state) => state.deleteUrl);
  const toggleUrlStar = useDataStore((state) => state.toggleUrlStar);
  const sortMode = useSettingsStore((state) => state.sortMode);

  const [showEditor, setShowEditor] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const sortedUrls = useMemo(
    () =>
      [...urls].sort((a, b) => {
        if (a.isStarred !== b.isStarred) {
          return a.isStarred ? -1 : 1;
        }
        if (sortMode === 'name') {
          const nameA = (a.title || '').toLowerCase();
          const nameB = (b.title || '').toLowerCase();
          return nameA.localeCompare(nameB, 'zh-CN');
        }
        return b.updatedAt - a.updatedAt;
      }),
    [urls, sortMode]
  );

  const handleContextMenu = (e: React.MouseEvent, urlId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({ 
      id: urlId, 
      x: rect.right - 150,
      y: rect.bottom + 4
    });
  };

  const handleEdit = (urlId: string) => {
    const urlItem = urls.find((u) => u.id === urlId);
    if (urlItem) {
      setEditingUrl(urlId);
      setEditTitle(urlItem.title);
      setEditUrl(urlItem.url);
      setShowEditModal(true);
      setContextMenu(null);
    }
  };

  const handleSaveEdit = () => {
    if (editingUrl && editUrl.trim()) {
      const optimized = optimizeUrl(editUrl);
      const finalTitle = editTitle.trim() || extractTitleFromUrl(optimized);
      updateUrl(editingUrl, {
        title: finalTitle,
        url: optimized,
      });
      setShowEditModal(false);
      setEditingUrl(null);
      setEditTitle('');
      setEditUrl('');
    }
  };

  const urlItem = contextMenu ? urls.find((u) => u.id === contextMenu.id) : null;

  if (!folderId || !folder) {
    navigate('/url');
    return null;
  }

  return (
    <div className="url-page">
      <div className="folder-header-row">
        <button className="folder-back-btn" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <h1 className="page-title">{folder.name}</h1>
        <div className="folder-header-spacer" />
      </div>

      <button
        className="add-url-button"
        onClick={() => {
          setShowEditor(true);
          setTimeout(() => {
            const textarea = document.getElementById(
              'folder-url-input'
            ) as HTMLInputElement | null;
            textarea?.focus();
          }, 0);
        }}
      >
        ➕ 新建网址
      </button>

      <div className="url-list">
        {sortedUrls.length === 0 ? (
          <div className="empty-state">暂无网址</div>
        ) : (
          sortedUrls.map((item) => (
            <div key={item.id} onClick={() => window.open(item.url, '_blank')}>
              <ListItem
                icon="🌐"
                title={item.title}
                subtitle={`${item.url} · ${format(new Date(item.updatedAt), 'yyyy-MM-dd HH:mm')}`}
                isStarred={item.isStarred}
                onMenuClick={(e) => handleContextMenu(e, item.id)}
              />
            </div>
          ))
        )}
      </div>

      {urlItem && contextMenu && (
        <ContextMenu
          isOpen={true}
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: '编辑',
              icon: '✏️',
              onClick: () => handleEdit(urlItem.id),
            },
            {
              label: '删除',
              icon: '🗑️',
              onClick: () => deleteUrl(urlItem.id),
              danger: true,
            },
            {
              label: urlItem.isStarred ? '取消星标' : '添加星标',
              icon: '⭐',
              onClick: () => toggleUrlStar(urlItem.id),
            },
          ]}
        />
      )}

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUrl(null);
          setEditTitle('');
          setEditUrl('');
        }}
        title="编辑网址"
      >
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
      </Modal>

      <Modal
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false);
          setTitle('');
          setUrl('');
        }}
        title="添加网址"
      >
        <div className="add-url-form">
          <input
            type="text"
            placeholder="标题（可选）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
          />
          <input
            id="folder-url-input"
            type="text"
            placeholder="URL（例如：example.com 或 https://example.com）"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="form-input"
          />
          <button onClick={() => {
            if (!url.trim()) return;
            const optimized = optimizeUrl(url);
            const finalTitle = title.trim() || extractTitleFromUrl(optimized);
            addUrl(finalTitle, optimized, folderId);
            setTitle('');
            setUrl('');
            setShowEditor(false);
          }} className="form-button" disabled={!url.trim()}>
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default FolderUrlsPage;



