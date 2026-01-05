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
  const isTypingRef = useRef(false);
  const lastSavedContentRef = useRef(homeContent);

  // 从独立存储加载内容（只有当内容确实变化且不是用户正在输入时才更新）
  useEffect(() => {
    // 如果用户正在输入，不更新（避免覆盖用户输入）
    if (isTypingRef.current) {
      return;
    }
    
    // 只有当内容确实变化时才更新
    if (homeContent !== lastSavedContentRef.current) {
      const { title: loadedTitle, body: loadedBody } = parseContent(homeContent);
      setTitle(loadedTitle);
      setBody(loadedBody);
      lastSavedContentRef.current = homeContent;
    }
  }, [homeContent]);

  // 自动保存到独立存储（防抖）
  useEffect(() => {
    isTypingRef.current = true;
    const timer = setTimeout(() => {
      // 合并标题和内容，用换行符分隔
      const combinedContent = title ? `${title}\n${body}` : body;
      // 只有当内容确实变化时才保存
      if (combinedContent !== lastSavedContentRef.current) {
        setHomeContent(combinedContent);
        lastSavedContentRef.current = combinedContent;
      }
      // 保存完成后，延迟标记为不在输入状态（给同步留出时间）
      setTimeout(() => {
        isTypingRef.current = false;
      }, 2000); // 延长到2秒，确保同步完成
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, body, setHomeContent]);

  const handleSave = () => {
    const combinedContent = title ? `${title}\n${body}` : body;
    setHomeContent(combinedContent);
    lastSavedContentRef.current = combinedContent;
    // 保存后延迟标记为不在输入状态
    setTimeout(() => {
      isTypingRef.current = false;
    }, 500);
  };

  return (
    <div className="home-page-new">
      <div className="home-panel">
        <textarea
          ref={contentRef}
          className="home-content-input"
          placeholder="输入内容..."
          value={body}
          onChange={(e) => {
            isTypingRef.current = true;
            setBody(e.target.value);
          }}
          onBlur={() => {
            handleSave();
            // 延迟标记为不在输入状态，避免立即被同步覆盖
            setTimeout(() => {
              isTypingRef.current = false;
            }, 500);
          }}
        />
        <div className="home-sync-indicator">
          <SyncIndicator />
        </div>
      </div>
    </div>
  );
};

export default HomePageNew;

