import { useState, useEffect, useRef } from 'react';
import { useHomeContentStore } from '../stores/homeContentStore';
import { useTranslation } from '../i18n/useTranslation';
import './HomePage.css';

const HomePage = () => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const homeContent = useHomeContentStore((state) => state.content);
  const setHomeContent = useHomeContentStore((state) => state.setContent);
  const [content, setContent] = useState(homeContent);
  const { t } = useTranslation();

  // 从独立存储加载内容
  useEffect(() => {
    setContent(homeContent);
  }, [homeContent]);

  // 自动保存到独立存储（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      setHomeContent(content);
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, setHomeContent]);

  const handleSave = () => {
    setHomeContent(content);
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

