import { useNavigate } from 'react-router-dom';
import './TopBar.css';

const TopBar = () => {
  const navigate = useNavigate();

  const handleAdd = () => {
    // 快速新建记事，跳转到新建记事页面
    navigate('/new-note');
  };

  const handleSearch = () => {
    // 打开搜索页面
    navigate('/search');
  };

  return (
    <div className="top-bar">
      <div className="top-bar-row single-row">
        <button className="add-btn" onClick={handleAdd}>
          ➕
        </button>
        <h1 className="app-title">piccco</h1>
        <button className="search-btn" onClick={handleSearch}>🔍</button>
      </div>
    </div>
  );
};

export default TopBar;

