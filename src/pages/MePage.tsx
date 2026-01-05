import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useMessageStore } from '../stores/messageStore';
import { useTranslation } from '../i18n/useTranslation';
import { logger } from '../utils/logger';
import ListItem from '../components/ListItem';
import {
  SettingsIcon,
  AccountSecurityIcon,
  TrashIcon,
  HelpFeedbackIcon,
  AboutIcon,
  MessageIcon,
} from '../components/Icons';
import './MePage.css';

const MePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentUser = useUserStore((state) => state.currentUser);
  const logout = useUserStore((state) => state.logout);
  const updateUsername = useUserStore((state) => state.updateUsername);
  const messages = useMessageStore((state) => state.messages);
  const unreadCount = messages.filter((m) => !m.isRead).length;
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const menuItems = [
    {
      icon: <MessageIcon />,
      title: t('messageCenter'),
      onClick: () => {
        navigate('/messages');
      },
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      icon: <SettingsIcon />,
      title: t('settings'),
      onClick: () => {
        navigate('/settings');
      },
    },
    {
      icon: <AccountSecurityIcon />,
      title: t('accountSecurity'),
      onClick: () => {
        navigate('/account-security');
      },
    },
    {
      icon: <TrashIcon />,
      title: t('trash'),
      onClick: () => {
        navigate('/trash');
      },
    },
    {
      icon: <HelpFeedbackIcon />,
      title: t('helpAndFeedback'),
      onClick: () => {
        navigate('/help-feedback');
      },
    },
    {
      icon: <AboutIcon />,
      title: t('about'),
      onClick: () => {
        navigate('/about');
      },
    },
  ];

  return (
    <div className="me-page">
      <h1 className="page-title">{t('me')}</h1>
      <div className="user-info">
        {currentUser && (
          <div className="account-info">
            <div className="account-item">
              <span className="account-label">{t('username')}</span>
              <span className="account-value">
                {currentUser.username}
                <button
                  className="username-edit-btn"
                  onClick={() => {
                    setNewUsername(currentUser.username);
                    setIsEditingUsername(true);
                  }}
                >
                  {t('modify')}
                </button>
              </span>
            </div>
            {currentUser.email && (
              <div className="account-item">
                <span className="account-label">{t('email')}</span>
                <span className="account-value">{currentUser.email}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="menu-list">
        {menuItems.map((item, index) => {
          return (
            <ListItem
              key={index}
              icon={item.icon}
              title={item.title}
              onClick={item.onClick}
              badge={item.badge}
            />
          );
        })}
        <div className="logout-section">
          <button className="logout-button" onClick={logout}>
            {t('logout')}
          </button>
        </div>
      </div>
      {isEditingUsername && (
        <div
          className="me-username-modal-mask"
          onClick={() => setIsEditingUsername(false)}
        >
          <div
            className="me-username-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="me-username-title">{t('editUsername')}</h2>
            <input
              className="me-username-input"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={t('enterNewUsername')}
            />
            <div className="me-username-actions">
              <button
                className="me-username-cancel"
                onClick={() => setIsEditingUsername(false)}
              >
                {t('cancel')}
              </button>
              <button
                className="me-username-confirm"
                onClick={async () => {
                  const name = newUsername.trim();
                  if (!name) {
                    alert(t('usernameRequired'));
                    return;
                  }
                  try {
                    await updateUsername(name);
                    // 只有成功时才关闭编辑模态框
                    setIsEditingUsername(false);
                  } catch (error) {
                    // 错误已经在updateUsername中处理了，这里不需要额外处理
                    logger.error('更新用户名失败:', error);
                  }
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MePage;





