import { useState, useEffect, useRef } from 'react';
import { useDataStore } from '../stores/dataStore';
import { useTranslation } from '../i18n/useTranslation';
import './HomePage.css';

const HomePage = () => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addNote = useDataStore((state) => state.addNote);
  const notes = useDataStore((state) => state.getNotesByFolder());
  const updateNote = useDataStore((state) => state.updateNote);
  const { t } = useTranslation();

  // 自动保存
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content.trim()) {
        const existingNote = notes.find((n) => !n.folderId);
        if (existingNote) {
          updateNote(existingNote.id, content);
        } else {
          addNote(content);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, notes, updateNote, addNote]);

  // 加载已有内容
  useEffect(() => {
    const existingNote = notes.find((n) => !n.folderId);
    if (existingNote) {
      setContent(existingNote.content);
    }
  }, [notes]);

  const handleSave = () => {
    if (content.trim()) {
      const existingNote = notes.find((n) => !n.folderId);
      if (existingNote) {
        updateNote(existingNote.id, content);
      } else {
        addNote(content);
      }
    }
  };

  return (
    <div className="home-page">
      <div className="home-input-container">
        <textarea
          ref={textareaRef}
          className="home-input"
          placeholder={t('noteContent')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleSave}
        />
      </div>
    </div>
  );
};

export default HomePage;

