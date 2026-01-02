import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useMessageStore } from '../stores/messageStore';
import { useTranslation } from '../i18n/useTranslation';
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
  const updateAvatar = useUserStore((state) => state.updateAvatar);
  const updateUsername = useUserStore((state) => state.updateUsername);
  const messages = useMessageStore((state) => state.messages);
  const unreadCount = messages.filter((m) => !m.isRead).length;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }
      // 检查文件大小（限制为 5MB）
      if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过 5MB');
        return;
      }
      // 读取文件并转换为 base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          await updateAvatar(base64);
        }
      };
      reader.readAsDataURL(file);
    }
    // 重置 input，以便可以重复选择同一文件
    e.target.value = '';
  };

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
          <>
            <div className="avatar-section">
              <div className="avatar-wrapper">
                <img
                  src={currentUser.avatar || '/default-avatar.png'}
                  alt="avatar"
                  className="avatar"
                  onError={(e) => {
                    // 如果头像加载失败，显示默认头像（使用 emoji 或占位符）
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.avatar-placeholder')) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'avatar-placeholder';
                      placeholder.textContent = currentUser.username.charAt(0).toUpperCase();
                      parent.appendChild(placeholder);
                    }
                  }}
                />
                {!currentUser.avatar && (
                  <div className="avatar-placeholder">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <button className="avatar-edit-btn" onClick={handleAvatarClick}>
                  {t('modify')}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
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
          </>
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
                    console.error('更新用户名失败:', error);
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





