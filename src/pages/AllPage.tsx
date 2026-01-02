import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useSettingsStore } from '../stores/settingsStore';
import { format } from 'date-fns';
import ListItem from '../components/ListItem';
import ContextMenu from '../components/ContextMenu';
import { eventEmitter } from '../utils/events';
import { AddIcon, StarIcon, EditIcon, TrashIcon } from '../components/Icons';
import './AllPage.css';

const AllPage = () => {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const notes = useDataStore((state) => state.getAllNotes(true));
  const deleteNote = useDataStore((state) => state.deleteNote);
  const toggleNoteStar = useDataStore((state) => state.toggleNoteStar);
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
      navigate('/new-note');
    };
    eventEmitter.on('add-item', handleAddItem);
    return () => {
      eventEmitter.off('add-item', handleAddItem);
    };
  }, [navigate]);

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
    // 跳转到编辑页面
    navigate(`/new-note?noteId=${noteId}`);
    setContextMenu(null);
  };

  const note = contextMenu ? notes.find((n) => n.id === contextMenu.id) : null;

  return (
    <div className="all-page">
      <h1 className="page-title">全部</h1>
      <button className="add-note-button" onClick={() => navigate('/new-note')}>
        <AddIcon /> <span>新建记事</span>
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
              icon: <EditIcon />,
              onClick: () => handleEdit(note.id),
            },
            {
              label: '删除',
              icon: <TrashIcon />,
              onClick: () => deleteNote(note.id),
              danger: true,
            },
            {
              label: note.isStarred ? '取消星标' : '添加星标',
              icon: <StarIcon filled={note.isStarred} />,
              onClick: () => toggleNoteStar(note.id),
            },
          ]}
        />
      )}
    </div>
  );
};

export default AllPage;

