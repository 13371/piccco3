import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useUserStore } from '../stores/userStore';
import { useTranslation } from '../i18n/useTranslation';
import Modal from '../components/Modal';
import './AccountSecurityPage.css';

const AccountSecurityPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const folders = useDataStore((state) => state.folders);
  const updateFolder = useDataStore((state) => state.updateFolder);
  const verifyFolderPassword = useDataStore((state) => state.verifyFolderPassword);
  const currentUser = useUserStore((state) => state.currentUser);
  const sendRegisterCode = useUserStore((state) => state.sendRegisterCode);
  const changePassword = useUserStore((state) => state.changePassword);
  const deleteAccount = useUserStore((state) => state.deleteAccount);
  const isBanned = useUserStore((state) => state.isBanned());

  const privacyFolder = useMemo(
    () => folders.find((f) => f.type === 'privacy'),
    [folders]
  );

  // 隐私文件夹密码相关状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 登录密码相关状态
  const [emailForChange, setEmailForChange] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginConfirmPassword, setLoginConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [codeCountdown, setCodeCountdown] = useState(0);

  // 注销账户相关状态
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (currentUser?.email) {
      setEmailForChange(currentUser.email);
    }
  }, [currentUser]);

  if (!privacyFolder) {
    return (
      <div className="account-security-page">
        <div className="page-header">
          <button className="page-back-button" onClick={() => navigate(-1)}>
            {t('back')}
          </button>
          <h1 className="page-title">{t('accountSecurity')}</h1>
        </div>
        <div className="account-security-content">
          <div className="account-security-card">
            <div className="account-security-empty">暂无隐私文件夹</div>
          </div>
        </div>
      </div>
    );
  }

  const hasPassword = !!privacyFolder.password;

  // 验证码倒计时
  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [codeCountdown]);

  const handleSendCode = async () => {
    if (!emailForChange) {
      setLoginError('请输入要验证的邮箱');
      return;
    }
    setLoginError('');
    const result = await sendRegisterCode(emailForChange);
    if (result.ok) {
      setCodeCountdown(60);
      setLoginSuccess('验证码已发送到您的邮箱');
      setTimeout(() => setLoginSuccess(''), 3000);
    } else {
      setLoginError(result.message || '发送验证码失败');
    }
  };

  const handleChangeLoginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');

    if (!emailForChange) {
      setLoginError('请输入要修改密码的账号邮箱');
      return;
    }

    if (!loginPassword || !loginConfirmPassword) {
      setLoginError('请输入新密码并确认');
      return;
    }

    if (loginPassword !== loginConfirmPassword) {
      setLoginError('两次输入的新密码不一致');
      return;
    }

    if (!verificationCode) {
      setLoginError('请输入邮箱验证码');
      return;
    }

    const result = await changePassword(emailForChange, loginPassword, verificationCode);
    if (result.ok) {
      setLoginSuccess('登录密码修改成功');
      setLoginPassword('');
      setLoginConfirmPassword('');
      setVerificationCode('');
    } else {
      setLoginError(result.message || '修改密码失败');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('请输入新密码并确认');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    // 已有密码时需要校验旧密码
    if (hasPassword) {
      if (!oldPassword) {
        setError('请输入当前密码');
        return;
      }
      const ok = verifyFolderPassword(privacyFolder.id, oldPassword);
      if (!ok) {
        setError('当前密码错误');
        return;
      }
    }

    updateFolder(privacyFolder.id, { password: newPassword });
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess('隐私文件夹密码已更新');
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError('');
    
    const result = await deleteAccount();
    
    if (result.ok) {
      // 注销成功，跳转到登录页
      navigate('/login', { replace: true });
    } else {
      setDeleteError(result.message || '注销账户失败');
      setIsDeleting(false);
    }
  };

  return (
    <div className="account-security-page">
      <div className="account-security-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <h1 className="page-title">账号与安全</h1>
      </div>
      <div className="account-security-content">
        {/* 修改登录密码 */}
        <div className="account-security-card">
          <div className="account-security-title">修改登录密码</div>
          <form onSubmit={handleChangeLoginPassword} className="account-security-form">
            <input
              type="email"
              className="security-input"
              placeholder="登录邮箱"
              value={emailForChange}
              onChange={(e) => setEmailForChange(e.target.value)}
            />
            <div className="code-row">
              <input
                type="text"
                className="security-input code-input"
                placeholder="邮箱验证码"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
              />
              <button
                type="button"
                className="send-code-btn"
                onClick={handleSendCode}
                disabled={codeCountdown > 0 || !emailForChange}
              >
                {codeCountdown > 0 ? `重新发送(${codeCountdown}s)` : '发送验证码'}
              </button>
            </div>
            <input
              type="password"
              className="security-input"
              placeholder="新密码"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <input
              type="password"
              className="security-input"
              placeholder="确认新密码"
              value={loginConfirmPassword}
              onChange={(e) => setLoginConfirmPassword(e.target.value)}
            />
            {loginError && <div className="security-error">{loginError}</div>}
            {loginSuccess && <div className="security-success">{loginSuccess}</div>}
            <button type="submit" className="security-button">
              修改登录密码
            </button>
          </form>
        </div>

        {/* 隐私文件夹密码 */}
        <div className="account-security-card">
          <div className="account-security-title">
            隐私文件夹密码（{privacyFolder.name}）
          </div>
          <form onSubmit={handleSubmit} className="account-security-form">
            {hasPassword && (
              <input
                type="password"
                className="security-input"
                placeholder="当前密码"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            )}
            <input
              type="password"
              className="security-input"
              placeholder={hasPassword ? '新密码' : '设置新密码'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              className="security-input"
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <div className="security-error">{error}</div>}
            {success && <div className="security-success">{success}</div>}
            <button type="submit" className="security-button">
              {hasPassword ? '修改密码' : '设置密码'}
            </button>
          </form>
        </div>

        {/* 注销账户 */}
        <div className="account-security-card">
          <div className="account-security-title" style={{ color: '#ef4444' }}>
            注销账户
          </div>
          {isBanned ? (
            <>
              <div className="security-error" style={{ marginBottom: '12px' }}>
                您的账号已被封禁，无法注销账户{currentUser?.banReason ? `，原因：${currentUser.banReason}` : ''}。
              </div>
              <button
                className="security-button"
                disabled
                style={{
                  backgroundColor: '#9ca3af',
                  marginTop: '0',
                  cursor: 'not-allowed',
                  opacity: 0.6,
                }}
              >
                注销账户（已禁用）
              </button>
            </>
          ) : (
            <>
              <div className="security-info" style={{ marginBottom: '12px' }}>
                注销账户后，您的所有数据将被永久删除，且无法恢复。此操作不可撤销。
              </div>
              <button
                className="security-button"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  backgroundColor: '#ef4444',
                  marginTop: '0',
                }}
              >
                注销账户
              </button>
            </>
          )}
        </div>
      </div>

      {/* 注销确认对话框 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeleteError('');
          }
        }}
        title="确认注销账户"
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '20px' }}>⚠️</div>
          <p style={{ fontSize: '16px', color: '#333', marginBottom: '10px', lineHeight: '1.6', textAlign: 'center' }}>
            您确定要注销账户吗？
          </p>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px', lineHeight: '1.6', textAlign: 'center' }}>
            此操作将永久删除您的所有数据，包括文件夹、笔记、网址和消息等，且无法恢复。
          </p>
          {deleteError && (
            <div style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center', marginBottom: '15px' }}>
              {deleteError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteError('');
              }}
              disabled={isDeleting}
              style={{
                padding: '10px 30px',
                backgroundColor: '#e5e7eb',
                color: '#333',
                border: 'none',
                borderRadius: '8px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              取消
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              style={{
                padding: '10px 30px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              {isDeleting ? '注销中...' : '确认注销'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AccountSecurityPage;


