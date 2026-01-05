import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import Modal from '../components/Modal';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banMessage, setBanMessage] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordCode, setForgotPasswordCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotPasswordCountdown, setForgotPasswordCountdown] = useState(0);
  const [sendingForgotPasswordCode, setSendingForgotPasswordCode] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const login = useUserStore((state) => state.login);
  const registerWithEmail = useUserStore((state) => state.registerWithEmail);
  const sendRegisterCode = useUserStore((state) => state.sendRegisterCode);
  const changePassword = useUserStore((state) => state.changePassword);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (forgotPasswordCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setForgotPasswordCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [forgotPasswordCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('请输入邮箱');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);

    if (isLogin) {
      const result = await login(email, password);
      if (result.ok) {
        // 登录成功，导航到首页
        navigate('/', { replace: true });
      } else {
        const errorMsg = result.message || '登录失败';
        // 检查是否是封禁错误
        if (errorMsg.includes('封禁') || errorMsg.includes('被封禁')) {
          setBanMessage(errorMsg);
          setShowBanModal(true);
        } else {
          setError(errorMsg);
        }
        setLoading(false);
      }
    } else {
      if (!username) {
        setError('请输入用户名');
        setLoading(false);
        return;
      }
      if (!code) {
        setError('请输入邮箱验证码');
        setLoading(false);
        return;
      }
      if (!agreedToTerms) {
        setError('请先同意用户协议');
        setLoading(false);
        return;
      }
      const result = await registerWithEmail({ email, username, password, code });
      if (result.ok) {
        // 注册成功，导航到首页
        navigate('/', { replace: true });
      } else {
        setError(result.message || '注册失败');
        setLoading(false);
      }
    }
  };

  const handleSendCode = async () => {
    if (!email) {
      setError('请先输入邮箱');
      return;
    }
    if (countdown > 0 || sendingCode) return;

    setError('');
    setSendingCode(true);
    const result = await sendRegisterCode(email);
    setSendingCode(false);

    if (!result.ok) {
      setError(result.message || '发送验证码失败');
      return;
    }

    // 开发模式：如果返回了验证码，显示提示
    if (result.devCode) {
      setError(`验证码已发送！开发模式验证码：${result.devCode}（已显示在控制台）`);
      // 3秒后清除提示
      setTimeout(() => setError(''), 3000);
    }

    setCountdown(60);
  };

  const handleSendForgotPasswordCode = async () => {
    if (!forgotPasswordEmail) {
      setError('请先输入邮箱');
      return;
    }
    if (forgotPasswordCountdown > 0 || sendingForgotPasswordCode) return;

    setError('');
    setSendingForgotPasswordCode(true);
    const result = await sendRegisterCode(forgotPasswordEmail);
    setSendingForgotPasswordCode(false);

    if (!result.ok) {
      setError(result.message || '发送验证码失败');
      return;
    }

    setForgotPasswordCountdown(60);
  };

  const handleResetPassword = async () => {
    setError('');
    
    if (!forgotPasswordEmail) {
      setError('请输入邮箱');
      return;
    }
    if (!forgotPasswordCode) {
      setError('请输入验证码');
      return;
    }
    if (!newPassword) {
      setError('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码长度至少6个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    const result = await changePassword(forgotPasswordEmail, newPassword, forgotPasswordCode);
    setLoading(false);

    if (result.ok) {
      // 重置成功，关闭忘记密码弹窗，显示成功消息
      setShowForgotPassword(false);
      setError('');
      setForgotPasswordEmail('');
      setForgotPasswordCode('');
      setNewPassword('');
      setConfirmPassword('');
      alert('密码重置成功，请使用新密码登录');
    } else {
      setError(result.message || '重置密码失败');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1 className="login-title">piccco</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
          />
          {!isLogin && (
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
            />
          )}
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />
          {!isLogin && (
            <div className="login-code-row">
              <input
                type="text"
                placeholder="邮箱验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="login-input"
              />
              <button
                type="button"
                className="code-button"
                onClick={handleSendCode}
                disabled={sendingCode || countdown > 0}
              >
                {countdown > 0 ? `重新发送(${countdown}s)` : '发送验证码'}
              </button>
            </div>
          )}
          {!isLogin && (
            <div className="login-agreement-row">
              <label className="login-agreement-label">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="login-agreement-checkbox"
                />
                <span>
                  我已阅读并同意{' '}
                  <a
                    href="/user-agreement"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open('/user-agreement', '_blank');
                    }}
                    className="login-agreement-link"
                  >
                    用户协议
                  </a>
                </span>
              </label>
            </div>
          )}
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? '请稍候...' : isLogin ? '登录' : '注册'}
          </button>
        </form>
        {isLogin && (
          <button
            className="login-forgot-password"
            onClick={() => setShowForgotPassword(true)}
          >
            忘记密码？
          </button>
        )}
        <button
          className="login-switch"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
            setAgreedToTerms(false);
          }}
        >
          {isLogin ? '还没有账号？注册' : '已有账号？登录'}
        </button>
      </div>
      
      {/* 封禁提示弹窗 */}
      <Modal
        isOpen={showBanModal}
        onClose={() => setShowBanModal(false)}
        title="账号已被封禁"
      >
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚫</div>
          <p style={{ fontSize: '16px', color: '#333', marginBottom: '10px', lineHeight: '1.6' }}>
            {banMessage || '您的账号已被封禁，无法登录'}
          </p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '20px' }}>
            如有疑问，请联系管理员
          </p>
          <button
            onClick={() => setShowBanModal(false)}
            style={{
              marginTop: '20px',
              padding: '10px 30px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            我知道了
          </button>
        </div>
      </Modal>

      {/* 忘记密码弹窗 */}
      <Modal
        isOpen={showForgotPassword}
        onClose={() => {
          setShowForgotPassword(false);
          setError('');
          setForgotPasswordEmail('');
          setForgotPasswordCode('');
          setNewPassword('');
          setConfirmPassword('');
        }}
        title="重置密码"
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="email"
              placeholder="请输入您的邮箱"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              className="login-input"
              style={{ width: '100%', marginBottom: '8px' }}
            />
            <div className="login-code-row">
              <input
                type="text"
                placeholder="邮箱验证码"
                value={forgotPasswordCode}
                onChange={(e) => setForgotPasswordCode(e.target.value)}
                className="login-input"
              />
              <button
                type="button"
                className="code-button"
                onClick={handleSendForgotPasswordCode}
                disabled={sendingForgotPasswordCode || forgotPasswordCountdown > 0}
              >
                {forgotPasswordCountdown > 0 ? `重新发送(${forgotPasswordCountdown}s)` : '发送验证码'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              placeholder="新密码（至少6个字符）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="login-input"
              style={{ width: '100%', marginBottom: '8px' }}
            />
            <input
              type="password"
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="login-input"
              style={{ width: '100%' }}
            />
          </div>
          {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}
          <button
            type="button"
            className="login-button"
            onClick={handleResetPassword}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? '重置中...' : '重置密码'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default LoginPage;






