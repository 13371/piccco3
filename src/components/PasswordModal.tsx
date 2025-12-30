import { useState } from 'react';
import Modal from './Modal';
import './PasswordModal.css';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title?: string;
  mode?: 'verify' | 'set'; // verify: 验证密码, set: 设置新密码
}

const PasswordModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  mode = 'verify' 
}: PasswordModalProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'set') {
      // 设置密码模式：需要输入两次密码
      if (!password.trim()) {
        setError('请输入密码');
        return;
      }
      if (!confirmPassword.trim()) {
        setError('请确认密码');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      if (password.length < 4) {
        setError('密码长度至少为4位');
        return;
      }
    } else {
      // 验证密码模式：只需要输入一次密码
      if (!password.trim()) {
        setError('请输入密码');
        return;
      }
    }

    onConfirm(password);
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    onClose();
  };

  const modalTitle = title || (mode === 'set' ? '设置隐私文件夹密码' : '输入密码');

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="password-form">
        <input
          type="password"
          placeholder={mode === 'set' ? '请输入新密码' : '请输入密码'}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          className="password-input"
          autoFocus
        />
        {mode === 'set' && (
          <input
            type="password"
            placeholder="请再次输入密码"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            className="password-input"
            style={{ marginTop: '12px' }}
          />
        )}
        {error && <div className="password-error">{error}</div>}
        <button type="submit" className="password-button">
          {mode === 'set' ? '确认设置' : '确认'}
        </button>
      </form>
    </Modal>
  );
};

export default PasswordModal;










