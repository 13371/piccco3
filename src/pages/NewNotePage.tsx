import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import './NewNotePage.css';

const NewNotePage = () => {
  const navigate = useNavigate();
  const addNote = useDataStore((state) => state.addNote);
  const folders = useDataStore((state) => state.folders.filter((f) => f.type !== 'url' && f.type !== 'privacy'));
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // 光标默认在内容框
  useEffect(() => {
    setTimeout(() => {
      contentRef.current?.focus();
    }, 0);
  }, []);

  const handleSave = () => {
    if (!content.trim() && !title.trim()) return;
    const fullContent = title.trim()
      ? `${title.trim()}\n\n${content.trim()}`
      : content.trim();
    addNote(fullContent, selectedFolderId);
    navigate(-1);
  };

  return (
    <div className="new-note-page">
      <div className="note-editor-wrapper">
        <div className="note-editor">
          <div className="page-header-row">
            <button className="header-back" onClick={() => navigate(-1)}>
              取消
            </button>
            <select
              className="header-folder-select"
              value={selectedFolderId || ''}
              onChange={(e) => setSelectedFolderId(e.target.value || undefined)}
            >
              <option value="">全部</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <button
              className="header-save"
              onClick={handleSave}
              disabled={!content.trim() && !title.trim()}
            >
              保存
            </button>
          </div>

          <input
            type="text"
            className="note-title-input"
            placeholder="无标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="note-divider"></div>
          <textarea
            ref={contentRef}
            className="note-content-input"
            placeholder="输入内容..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          <div className="note-footer">
            <span className="footer-label">附件</span>
            <button className="add-attachment-btn">
              ➕ 添加附件
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewNotePage;

