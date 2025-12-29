import { ReactNode } from 'react';
import './ListItem.css';

interface ListItemProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  rightIcon?: ReactNode;
  isStarred?: boolean;
  onMenuClick?: (e: React.MouseEvent) => void;
}

const ListItem = ({ icon, title, subtitle, onClick, rightIcon, isStarred, onMenuClick }: ListItemProps) => {
  return (
    <div className="list-item" onClick={onClick}>
      {icon && <div className="list-item-icon">{icon}</div>}
      <div className="list-item-content">
        <div className="list-item-title">
          {title}
          {isStarred && <span className="star-icon">⭐</span>}
        </div>
        {subtitle && <div className="list-item-subtitle">{subtitle}</div>}
      </div>
      <div className="list-item-right">
        {onMenuClick && (
          <button
            className="list-item-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick(e);
            }}
            title="菜单"
          >
            ⋮
          </button>
        )}
        {rightIcon || <div className="list-item-arrow">›</div>}
      </div>
    </div>
  );
};

export default ListItem;




