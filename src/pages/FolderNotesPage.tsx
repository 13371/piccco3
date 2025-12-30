import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import { format } from 'date-fns';
import ListItem from '../components/ListItem';
import ContextMenu from '../components/ContextMenu';
import Modal from '../components/Modal';
import './AllPage.css';

const FolderNotesPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();

  const folder = useDataStore((state) =>
    state.getFolderById(folderId || '')
  );
  const notes = useDataStore((state) =>
    state.getNotesByFolder(folderId)
  );
  const addNote = useDataStore((state) => state.addNote);
  const updateNote = useDataStore((state) => state.updateNote);
  const deleteNote = useDataStore((state) => state.deleteNote);
  const toggleNoteStar = useDataStore((state) => state.toggleNoteStar);
  const sortMode = useSettingsStore((state) => state.sortMode);

  const [showEditor, setShowEditor] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.isStarred !== b.isStarred) {
          return a.isStarred ? -1 : 1;
        }
        if (sortMode === 'name') {
          const nameA = (a.content.split('\n')[0] || '').toLowerCase();
          const nameB = (b.content.split('\n')[0] || '').toLowerCase();
          return nameA.localeCompare(nameB, 'zh-CN');
        }
        return b.updatedAt - a.updatedAt;
      }),
    [notes, sortMode]
  );

  const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({ 
      id: noteId, 
      x: rect.right - 150,
      y: rect.bottom + 4
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

  const note = contextMenu ? notes.find((n) => n.id === contextMenu.id) : null;

  if (!folderId || !folder) {
    navigate('/category');
    return null;
  }

  return (
    <div className="all-page">
      <div className="folder-header-row">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <h1 className="page-title">{folder.name}</h1>
        <div className="folder-header-spacer" />
      </div>

      <button
        className="add-note-button"
        onClick={() => {
          setShowEditor(true);
          setTimeout(() => {
            const textarea = document.getElementById(
              'note-content-textarea'
            ) as HTMLTextAreaElement | null;
            textarea?.focus();
          }, 0);
        }}
      >
        ➕ 新建记事
      </button>

      <div className="notes-list">
        {sortedNotes.length === 0 ? (
          <div className="empty-state">暂无记事</div>
        ) : (
          sortedNotes.map((noteItem) => (
            <div key={noteItem.id} onClick={() => handleEdit(noteItem.id)}>
              <ListItem
                title={
                  noteItem.content.substring(0, 50) +
                  (noteItem.content.length > 50 ? '...' : '')
                }
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
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false);
          setTitle('');
          setContent('');
        }}
      >
        <div className="edit-note-form">
          <input
            type="text"
            placeholder="无标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
          />
          <textarea
            id="note-content-textarea"
            placeholder="输入内容..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="edit-note-input"
            rows={10}
          />
          <button
            onClick={() => {
              if (!content.trim() && !title.trim()) return;
              const fullContent = title.trim()
                ? `${title.trim()}\n\n${content.trim()}`
                : content.trim();
              addNote(fullContent, folderId);
              setTitle('');
              setContent('');
              setShowEditor(false);
            }}
            className="form-button"
            disabled={!content.trim() && !title.trim()}
          >
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default FolderNotesPage;



