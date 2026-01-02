import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import './TopNav.css';

const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/', label: t('home') },
    { path: '/all', label: t('all') },
    { path: '/url', label: t('url') },
    { path: '/category', label: t('category') },
    { path: '/me', label: t('me') },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="top-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => handleNavClick(item.path)}
          >
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TopNav;















