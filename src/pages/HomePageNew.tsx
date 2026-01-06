/**
 * 新UI版本的首页
 * 包含标题输入框和内容输入框
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useHomeContentStore } from '../stores/homeContentStore';
import SyncIndicator from '../components/SyncIndicator';
import './HomePageNew.css';

const HomePageNew = () => {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setIsTyping = useHomeContentStore((state) => state.setIsTyping);
  
  // 立即保存函数（用于移动端切换页面时）
  const saveImmediately = useCallback(() => {
    const combinedContent = title ? `${title}\n${body}` : body;
    if (combinedContent !== lastSavedContentRef.current) {
      setHomeContent(combinedContent);
      lastSavedContentRef.current = combinedContent;
      console.log('[HomePageNew] 立即保存首页内容:', combinedContent.substring(0, 50));
    }
  }, [title, body, setHomeContent]);

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
    setIsTyping(true); // 标记为正在输入
    
    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    saveTimerRef.current = setTimeout(() => {
      // 合并标题和内容，用换行符分隔
      const combinedContent = title ? `${title}\n${body}` : body;
      // 只有当内容确实变化时才保存
      if (combinedContent !== lastSavedContentRef.current) {
        setHomeContent(combinedContent);
        lastSavedContentRef.current = combinedContent;
        console.log('[HomePageNew] 自动保存首页内容:', combinedContent.substring(0, 50));
      }
      // 保存完成后，延迟标记为不在输入状态（给同步留出时间）
      setTimeout(() => {
        isTypingRef.current = false;
        setIsTyping(false); // 标记为不在输入
      }, 2000); // 延长到2秒，确保同步完成
      saveTimerRef.current = null;
    }, 1000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // 如果组件卸载时还在输入，立即保存
      if (isTypingRef.current) {
        saveImmediately();
        isTypingRef.current = false;
        setIsTyping(false);
      }
    };
  }, [title, body, setHomeContent, setIsTyping]);
  
  // 监听路由变化（移动端切换页面时）
  useEffect(() => {
    // 当路由变化时，立即保存（移动端切换页面时）
    return () => {
      // 组件卸载时立即保存
      if (isTypingRef.current || title || body) {
        saveImmediately();
        isTypingRef.current = false;
        setIsTyping(false);
      }
    };
  }, [location.pathname, saveImmediately, title, body]);
  
  // 监听页面可见性变化（移动端切换应用时）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 页面隐藏时，立即保存
        if (isTypingRef.current || title || body) {
          saveImmediately();
          isTypingRef.current = false;
          setIsTyping(false);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveImmediately, title, body]);
  
  // 监听页面卸载（移动端关闭标签页时）
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 页面卸载前，立即保存
      if (isTypingRef.current || title || body) {
        saveImmediately();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveImmediately, title, body]);

  const handleSave = () => {
    const combinedContent = title ? `${title}\n${body}` : body;
    setHomeContent(combinedContent);
    lastSavedContentRef.current = combinedContent;
    // 保存后延迟标记为不在输入状态
    setTimeout(() => {
      isTypingRef.current = false;
      setIsTyping(false);
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
            setIsTyping(true);
            setBody(e.target.value);
          }}
          onBlur={() => {
            // 移动端可能不会触发 onBlur，所以立即保存
            handleSave();
            // 延迟标记为不在输入状态，避免立即被同步覆盖
            setTimeout(() => {
              isTypingRef.current = false;
              setIsTyping(false);
            }, 500);
          }}
          onInput={(e) => {
            // 移动端输入事件，确保标记为正在输入
            isTypingRef.current = true;
            setIsTyping(true);
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

