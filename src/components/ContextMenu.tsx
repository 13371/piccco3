import './ContextMenu.css';

interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  x: number;
  y: number;
  items: {
    label: string;
    icon?: string;
    onClick: () => void;
    danger?: boolean;
  }[];
}

const ContextMenu = ({ isOpen, onClose, x, y, items }: ContextMenuProps) => {
  if (!isOpen) return null;

  // 计算菜单位置，确保不超出视口
  const menuWidth = 150; // 最小宽度
  const menuHeight = items.length * 44 + 8; // 估算高度
  const padding = 8;

  let menuX = x;
  let menuY = y;

  // 如果菜单会超出右边界，则右对齐到点击位置
  if (x + menuWidth > window.innerWidth) {
    menuX = x - menuWidth;
  }

  // 如果菜单会超出下边界，则显示在上方
  if (y + menuHeight > window.innerHeight) {
    menuY = y - menuHeight;
  }

  // 确保不超出左边界和上边界
  menuX = Math.max(padding, Math.min(menuX, window.innerWidth - menuWidth - padding));
  menuY = Math.max(padding, Math.min(menuY, window.innerHeight - menuHeight - padding));

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        className="context-menu"
        style={{ left: `${menuX}px`, top: `${menuY}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => (
          <button
            key={index}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};

export default ContextMenu;




