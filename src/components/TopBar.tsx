import { useNavigate } from 'react-router-dom';
import { AddIcon, SearchIcon } from './Icons';
import { USE_NEW_UI } from '../config/ui';
import './TopBar.css';

const TopBar = () => {
  const navigate = useNavigate();

  const handleAdd = () => {
    // 直接跳转到新建记事页面，不预先创建空白记事
    navigate('/new-note');
  };

  const handleSearch = () => {
    // 打开搜索页面
    navigate('/search');
  };

  return (
    <div className={`top-bar ${USE_NEW_UI ? 'top-bar-new' : ''}`}>
      <div className="top-bar-row single-row">
        <button className="add-btn" onClick={handleAdd}>
          <AddIcon />
        </button>
        <h1 className="app-title">piccco</h1>
        <div className="top-bar-right">
          <button className="search-btn" onClick={handleSearch}>
            <SearchIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;

