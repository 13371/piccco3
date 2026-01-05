import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useTranslation } from '../i18n/useTranslation';
import './NewNotePage.css';

const NewNotePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const addNote = useDataStore((state) => state.addNote);
  const updateNote = useDataStore((state) => state.updateNote);
  const deleteNote = useDataStore((state) => state.deleteNote);
  const getAllNotes = useDataStore((state) => state.getAllNotes);
  const getFolderById = useDataStore((state) => state.getFolderById);
  const allFolders = useDataStore((state) => state.folders);
  
  // 从URL参数获取folderId和noteId
  const folderIdFromUrl = searchParams.get('folderId') || undefined;
  const noteIdFromUrl = searchParams.get('noteId') || undefined;
  const isEditMode = !!noteIdFromUrl;
  
  // 获取当前选中的文件夹信息（用于判断是否在隐私文件夹中）
  const currentFolder = useMemo(() => {
    if (folderIdFromUrl) {
      return getFolderById(folderIdFromUrl);
    }
    return undefined;
  }, [folderIdFromUrl, getFolderById]);
  
  const isInPrivacyFolder = currentFolder?.type === 'privacy';
  
  // 文件夹列表：
  // 1. 如果在隐私文件夹中新建记事：只显示当前隐私文件夹（不能选择其他分类）
  // 2. 如果在隐私文件夹中编辑记事：显示所有非url类型的文件夹（允许移动到其他文件夹）
  // 3. 否则（新建模式且不在隐私文件夹中）：只显示普通文件夹（不包括隐私文件夹）
  const folders = useMemo(() => {
    const availableFolders = allFolders.filter((f) => f.type !== 'url' && !f.isDeleted);
    if (isInPrivacyFolder && !isEditMode) {
      // 在隐私文件夹中新建记事：只显示当前隐私文件夹（不能选择其他分类）
      return availableFolders.filter((f) => f.id === folderIdFromUrl);
    } else if (isInPrivacyFolder && isEditMode) {
      // 在隐私文件夹中编辑记事：显示所有非url类型的文件夹（允许移动到其他文件夹）
      return availableFolders;
    } else {
      // 新建模式且不在隐私文件夹中：只显示普通文件夹
      return availableFolders.filter((f) => f.type !== 'privacy');
    }
  }, [allFolders, isInPrivacyFolder, isEditMode, folderIdFromUrl]);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(folderIdFromUrl);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // 跟踪标题输入框是否正在被使用（移动端优化）
  const [isTitleInputActive, setIsTitleInputActive] = useState(false);
  
  // 保存原始内容，用于比较是否有变化
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalFolderId, setOriginalFolderId] = useState<string | undefined>(undefined);
  
  // 禁用背景滚动，确保全屏页面体验
  useEffect(() => {
    // 保存原始样式
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const originalHeight = document.body.style.height;
    
    // 禁用背景滚动
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    // 清理函数：恢复原始样式
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.height = originalHeight;
    };
  }, []);

  // 如果是编辑模式，加载记事内容
  useEffect(() => {
    if (noteIdFromUrl) {
      // 编辑模式：获取所有记事（包括隐私文件夹中的记事），这样才能正确加载
      const allNotes = getAllNotes(false);
      const note = allNotes.find((n) => n.id === noteIdFromUrl);
      if (note) {
        // 解析标题和内容
        const lines = note.content.split('\n');
        let noteTitle = '';
        let noteContent = '';
        if (lines.length > 2 && lines[1].trim() === '') {
          // 有标题的情况：第一行是标题，第三行开始是内容
          noteTitle = lines[0];
          noteContent = lines.slice(2).join('\n');
        } else {
          // 没有标题的情况：全部是内容
          noteTitle = '';
          noteContent = note.content;
        }
        setTitle(noteTitle);
        setContent(noteContent);
        setSelectedFolderId(note.folderId);
        // 保存原始值
        setOriginalTitle(noteTitle);
        setOriginalContent(noteContent);
        setOriginalFolderId(note.folderId);
        
        // 编辑模式：内容加载完成后，滚动到顶部
        setTimeout(() => {
          if (wrapperRef.current) {
            wrapperRef.current.scrollTop = 0;
          }
          window.scrollTo(0, 0);
          if (contentRef.current) {
            contentRef.current.scrollTop = 0;
            contentRef.current.setSelectionRange(0, 0);
          }
        }, 150);
      }
    } else {
      // 新建模式，重置原始值
      setOriginalTitle('');
      setOriginalContent('');
      setOriginalFolderId(folderIdFromUrl);
    }
  }, [noteIdFromUrl, getAllNotes, folderIdFromUrl]);
  
  // 当URL参数变化时，更新selectedFolderId
  // 在隐私文件夹中新建记事时，强制设置为隐私文件夹ID，不能更改
  useEffect(() => {
    if (folderIdFromUrl && !isEditMode) {
      setSelectedFolderId(folderIdFromUrl);
    }
    // 在隐私文件夹中新建记事时，确保始终使用隐私文件夹ID（防止用户通过其他方式修改）
    if (isInPrivacyFolder && !isEditMode && folderIdFromUrl) {
      setSelectedFolderId(folderIdFromUrl);
    }
  }, [folderIdFromUrl, isEditMode, isInPrivacyFolder]);

  // 移动端：确保光标可见的辅助函数
  const handleCursorScroll = useCallback(() => {
    setTimeout(() => {
      if (contentRef.current && wrapperRef.current) {
        const textarea = contentRef.current;
        const selectionStart = textarea.selectionStart;
        
        // 计算光标所在的行
        const textBeforeCursor = textarea.value.substring(0, selectionStart);
        const linesBefore = textBeforeCursor.split('\n');
        const currentLine = linesBefore.length;
        const totalLines = textarea.value.split('\n').length;
        
        // 如果光标在底部附近（最后3行），需要滚动
        if (currentLine >= totalLines - 3) {
          // 获取textarea的样式信息
          const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
          const paddingTop = parseFloat(window.getComputedStyle(textarea).paddingTop) || 16;
          
          // 计算光标在textarea中的位置
          const cursorLineInTextarea = currentLine - 1;
          const cursorYInTextarea = cursorLineInTextarea * lineHeight + paddingTop;
          
          // 获取textarea的可见区域
          const textareaScrollTop = textarea.scrollTop;
          const textareaClientHeight = textarea.clientHeight;
          const textareaVisibleTop = textareaScrollTop;
          const textareaVisibleBottom = textareaScrollTop + textareaClientHeight;
          
          // 如果光标不在可见区域内，滚动textarea
          if (cursorYInTextarea < textareaVisibleTop || cursorYInTextarea > textareaVisibleBottom - lineHeight * 2) {
            textarea.scrollTop = Math.max(0, cursorYInTextarea - textareaClientHeight / 2);
          }
          
          // 确保textarea本身在视口中可见（考虑键盘遮挡）
          const textareaRect = textarea.getBoundingClientRect();
          const viewportHeight = window.visualViewport?.height || window.innerHeight;
          const safeArea = 100; // 保留的安全区域（避免被键盘完全遮挡）
          
          // 如果textarea底部超出可用视口，滚动wrapper
          if (textareaRect.bottom > viewportHeight - safeArea) {
            // 计算需要滚动的距离
            const scrollOffset = textareaRect.bottom - viewportHeight + safeArea;
            const currentScrollTop = wrapperRef.current.scrollTop;
            wrapperRef.current.scrollTop = currentScrollTop + scrollOffset;
          }
        }
      }
    }, 100); // 稍微延迟，确保DOM已更新
  }, []);

  // 光标默认在内容框第一行，并确保页面滚动到顶部
  // 只在页面初始加载时执行，不在内容变化时执行（避免干扰用户输入标题）
  useEffect(() => {
    // 延迟执行，确保DOM已完全渲染
    const timer = setTimeout(() => {
      // 确保页面滚动到顶部（移动端优化）
      if (wrapperRef.current) {
        wrapperRef.current.scrollTop = 0;
      }
      // 确保窗口滚动到顶部
      window.scrollTo(0, 0);
      
      // 检查当前焦点是否在标题输入框，如果是则不强制聚焦到内容框
      // 同时检查状态标记，确保移动端也能正常工作
      const activeElement = document.activeElement;
      const isTitleFocused = activeElement === titleRef.current || isTitleInputActive;
      
      // 只有在标题输入框没有焦点时，才聚焦内容框
      if (!isTitleFocused) {
        // 聚焦内容框
        contentRef.current?.focus();
        
        // 将光标移到第一行（位置0）
        if (contentRef.current) {
          contentRef.current.setSelectionRange(0, 0);
          // 确保 textarea 滚动到顶部
          contentRef.current.scrollTop = 0;
        }
      }
    }, 100); // 稍微延迟，确保内容已加载
    
    return () => clearTimeout(timer);
  }, [isEditMode, noteIdFromUrl]); // 只在编辑模式或记事ID变化时触发（页面加载时），不在内容变化时触发

  // 检查内容是否有变化
  const hasChanges = useMemo(() => {
    const currentFullContent = title.trim()
      ? `${title.trim()}\n\n${content.trim()}`
      : content.trim();
    const originalFullContent = originalTitle.trim()
      ? `${originalTitle.trim()}\n\n${originalContent.trim()}`
      : originalContent.trim();
    
    // 比较内容和文件夹ID
    return currentFullContent !== originalFullContent || selectedFolderId !== originalFolderId;
  }, [title, content, originalTitle, originalContent, selectedFolderId, originalFolderId]);

  const handleSave = () => {
    if (!content.trim() && !title.trim()) return;
    if (!hasChanges) return; // 如果没有变化，不执行保存
    
    const fullContent = title.trim()
      ? `${title.trim()}\n\n${content.trim()}`
      : content.trim();
    
    if (isEditMode && noteIdFromUrl) {
      // 编辑模式：更新记事（包括内容和文件夹）
      updateNote(noteIdFromUrl, fullContent, selectedFolderId);
      // 更新原始值
      setOriginalTitle(title);
      setOriginalContent(content);
      setOriginalFolderId(selectedFolderId);
    } else {
      // 新建模式：添加记事
      addNote(fullContent, selectedFolderId);
    }
    
    // 立即返回上一页面，同步操作由 addNote/updateNote 中的 debouncedUploadSync 自动处理
    navigate(-1);
  };

  return (
    <div className="new-note-page">
      <div className="note-editor-wrapper" ref={wrapperRef}>
        <div className="note-editor">
          <div className="page-header-row">
            <button
              className="header-back"
              onClick={() => {
                // 如果是编辑模式，且内容为空，且原始内容也为空，删除这个空白记事
                if (isEditMode && noteIdFromUrl) {
                  const isEmpty = !title.trim() && !content.trim();
                  const wasEmpty = !originalTitle.trim() && !originalContent.trim();
                  if (isEmpty && wasEmpty) {
                    // 删除空白记事
                    deleteNote(noteIdFromUrl);
                  }
                }
                navigate(-1);
              }}
            >
              {t('cancel')}
            </button>
            <select
              className="header-folder-select"
              value={selectedFolderId || ''}
              onChange={(e) => setSelectedFolderId(e.target.value || undefined)}
              disabled={isInPrivacyFolder && !isEditMode} // 在隐私文件夹中新建记事时禁用选择
            >
              <option value="">{t('all')}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <button
              className="header-save"
              onClick={handleSave}
              disabled={(!content.trim() && !title.trim()) || !hasChanges}
            >
              {t('save')}
            </button>
          </div>

          <div className="note-title-wrapper">
            <input
              ref={titleRef}
              type="text"
              className="note-title-input"
              placeholder={t('noTitle')}
              value={title}
              maxLength={10}
              onFocus={() => {
                // 标记标题输入框正在使用（移动端优化）
                setIsTitleInputActive(true);
              }}
              onBlur={() => {
                // 延迟清除标记，避免与useEffect冲突
                setTimeout(() => {
                  setIsTitleInputActive(false);
                }, 200);
              }}
              onChange={(e) => {
                const newValue = e.target.value;
                // 确保不超过10个字符
                if (newValue.length <= 10) {
                  setTitle(newValue);
                }
              }}
            />
            <span className="title-char-count">{title.length}/10</span>
          </div>
          <div className="note-divider"></div>
          <textarea
            ref={contentRef}
            className="note-content-input"
            placeholder="输入内容..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyUp={() => {
              // 移动端：确保光标可见（处理换行等情况）
              handleCursorScroll();
            }}
            onClick={() => {
              // 移动端：点击时确保光标可见
              handleCursorScroll();
            }}
            onInput={() => {
              // 移动端：输入时确保光标可见
              handleCursorScroll();
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NewNotePage;

