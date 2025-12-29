import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import './BottomNav.css';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/', label: t('home'), icon: '🏠' },
    { path: '/all', label: t('all'), icon: '📋' },
    { path: '/url', label: t('url'), icon: '🌐' },
    { path: '/category', label: t('category'), icon: '📁' },
    { path: '/me', label: t('me'), icon: '👤' },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => handleNavClick(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;








