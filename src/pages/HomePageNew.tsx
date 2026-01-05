/**
 * 新UI版本的首页
 * 包含标题输入框和内容输入框
 */
import { useState, useEffect, useRef } from 'react';
import { useHomeContentStore } from '../stores/homeContentStore';
import SyncIndicator from '../components/SyncIndicator';
import './HomePageNew.css';

const HomePageNew = () => {
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const homeContent = useHomeContentStore((state) => state.content);
  const setHomeContent = useHomeContentStore((state) => state.setContent);
  
  // 解析内容：第一行作为标题，其余作为内容
  const parseContent = (content: string) => {
    if (!content) return { title: '', body: '' };
    const lines = content.split('\n');
    const title = lines[0] || '';
    const body = lines.slice(1).join('\n');
    return { title, body };
  };

  const { title: initialTitle, body: initialBody } = parseContent(homeContent);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);

  // 从独立存储加载内容
  useEffect(() => {
    const { title: loadedTitle, body: loadedBody } = parseContent(homeContent);
    setTitle(loadedTitle);
    setBody(loadedBody);
  }, [homeContent]);

  // 自动保存到独立存储（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      // 合并标题和内容，用换行符分隔
      const combinedContent = title ? `${title}\n${body}` : body;
      setHomeContent(combinedContent);
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, body, setHomeContent]);

  const handleSave = () => {
    const combinedContent = title ? `${title}\n${body}` : body;
    setHomeContent(combinedContent);
  };

  return (
    <div className="home-page-new">
      <div className="home-panel">
        <textarea
          ref={contentRef}
          className="home-content-input"
          placeholder="输入内容..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={handleSave}
        />
        <div className="home-sync-indicator">
          <SyncIndicator />
        </div>
      </div>
    </div>
  );
};

export default HomePageNew;

