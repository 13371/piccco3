import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../i18n/useTranslation';
import { format } from 'date-fns';
import ListItem from '../components/ListItem';
import ContextMenu from '../components/ContextMenu';
import { EditIcon, TrashIcon, StarIcon, AddIcon } from '../components/Icons';
import './AllPage.css';

const FolderNotesPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const folder = useDataStore((state) =>
    state.getFolderById(folderId || '')
  );
  const notes = useDataStore((state) =>
    state.getNotesByFolder(folderId)
  );
  const deleteNote = useDataStore((state) => state.deleteNote);
  const toggleNoteStar = useDataStore((state) => state.toggleNoteStar);
  const sortMode = useSettingsStore((state) => state.sortMode);

  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

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
    // 跳转到编辑页面
    navigate(`/new-note?noteId=${noteId}`);
    setContextMenu(null);
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
          {t('back')}
        </button>
        <h1 className="page-title">{folder.name}</h1>
        <div className="folder-header-spacer" />
      </div>

      <button
        className="add-note-button"
        onClick={() => {
          navigate(`/new-note?folderId=${folderId}`);
        }}
      >
        <AddIcon /> <span>{t('newNote')}</span>
      </button>

      <div className="notes-list">
        {sortedNotes.length === 0 ? (
          <div className="empty-state">{t('noNotes')}</div>
        ) : (
          sortedNotes.map((noteItem) => {
            // 防止缺失时间导致显示 1970：优先 updatedAt，其次 createdAt，最后用当前时间兜底
            const ts = noteItem.updatedAt || noteItem.createdAt || Date.now();
            const subtitle = format(new Date(ts), 'yyyy-MM-dd HH:mm');
            return (
            <div key={noteItem.id} onClick={() => handleEdit(noteItem.id)}>
              <ListItem
                title={
                  noteItem.content.substring(0, 50) +
                  (noteItem.content.length > 50 ? '...' : '')
                }
                subtitle={subtitle}
                isStarred={noteItem.isStarred}
                onMenuClick={(e) => handleContextMenu(e, noteItem.id)}
              />
            </div>
          );
          })
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
              label: t('edit'),
              icon: <EditIcon />,
              onClick: () => handleEdit(note.id),
            },
            {
              label: t('delete'),
              icon: <TrashIcon />,
              onClick: () => deleteNote(note.id),
              danger: true,
            },
            {
              label: note.isStarred ? t('unstar') : t('star'),
              icon: <StarIcon filled={note.isStarred} />,
              onClick: () => toggleNoteStar(note.id),
            },
          ]}
        />
      )}
    </div>
  );
};

export default FolderNotesPage;



