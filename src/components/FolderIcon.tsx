import { FolderColor } from '../types';
import './FolderIcon.css';

interface FolderIconProps {
  color: FolderColor;
  type?: 'normal' | 'privacy' | 'url';
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}

const FolderIcon = ({ color, type = 'normal', size = 24, onClick }: FolderIconProps) => {
  const getIcon = () => {
    if (type === 'url') return '🌐';
    if (type === 'privacy') return '🔒';
    return '📁';
  };

  return (
    <div
      className={`folder-icon folder-color-${color}`}
      style={{ width: size, height: size, fontSize: size * 0.7 }}
      onClick={onClick}
    >
      {getIcon()}
    </div>
  );
};

export default FolderIcon;



