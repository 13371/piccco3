import { useState } from 'react';
import Modal from './Modal';
import './PasswordModal.css';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title?: string;
}

const PasswordModal = ({ isOpen, onClose, onConfirm, title = '输入密码' }: PasswordModalProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    onConfirm(password);
    setPassword('');
    setError('');
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="password-form">
        <input
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          className="password-input"
          autoFocus
        />
        {error && <div className="password-error">{error}</div>}
        <button type="submit" className="password-button">
          确认
        </button>
      </form>
    </Modal>
  );
};

export default PasswordModal;










