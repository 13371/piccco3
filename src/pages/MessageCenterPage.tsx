import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import ListItem from '../components/ListItem';
import { useMessageStore } from '../stores/messageStore';
import { useTranslation } from '../i18n/useTranslation';
import './MessageCenterPage.css';

const MessageCenterPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const messages = useMessageStore((state) => state.messages);
  const markAsRead = useMessageStore((state) => state.markAsRead);
  const markAllAsRead = useMessageStore((state) => state.markAllAsRead);
  
  useEffect(() => {
    // 只在组件挂载时加载一次
    const loadMessages = useMessageStore.getState().loadMessagesFromServer;
    loadMessages();
  }, []);

  const handleItemClick = (id: string) => {
    markAsRead(id);
  };

  const hasUnread = messages.some((m) => !m.isRead);

  return (
    <div className="message-page">
      <div className="page-header with-right-action">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="page-back-button" onClick={() => navigate(-1)}>
            {t('back')}
          </button>
          <h1 className="page-title">{t('messages')}</h1>
        </div>
        {hasUnread && (
          <button className="message-mark-all" onClick={markAllAsRead}>
            全部已读
          </button>
        )}
      </div>
      <div className="message-list">
        {messages.length === 0 && (
          <div className="message-empty">暂无消息</div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-item-wrapper ${msg.isRead ? 'read' : 'unread'}`}
            onClick={() => handleItemClick(msg.id)}
          >
            <ListItem
              icon="📩"
              title={msg.title}
              subtitle={format(msg.createdAt, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
              rightIcon={
                !msg.isRead ? <span className="message-dot" /> : undefined
              }
            />
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessageCenterPage;




