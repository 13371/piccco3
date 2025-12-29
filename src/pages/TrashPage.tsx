import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../stores/dataStore';
import { useTranslation } from '../i18n/useTranslation';
import { format } from 'date-fns';
import ListItem from '../components/ListItem';
import './TrashPage.css';

const TrashPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const trash = useDataStore((state) => state.trash);
  const restoreFromTrash = useDataStore((state) => state.restoreFromTrash);
  const permanentlyDelete = useDataStore((state) => state.permanentlyDelete);
  const cleanExpiredTrash = useDataStore((state) => state.cleanExpiredTrash);

  useEffect(() => {
    // 自动清理过期文件
    cleanExpiredTrash();
  }, []);

  const getTrashItemTitle = (item: any) => {
    if (item.type === 'note') {
      return item.data.content.substring(0, 50) + (item.data.content.length > 50 ? '...' : '');
    } else if (item.type === 'url') {
      return item.data.title;
    } else {
      return item.data.name;
    }
  };

  const getTrashItemSubtitle = (item: any) => {
    const deletedDate = format(new Date(item.deletedAt), 'yyyy-MM-dd HH:mm');
    const daysLeft = Math.ceil((30 * 24 * 60 * 60 * 1000 - (Date.now() - item.deletedAt)) / (24 * 60 * 60 * 1000));
    return `删除于 ${deletedDate} · 剩余 ${daysLeft} 天`;
  };

  const getTrashItemIcon = (item: any) => {
    if (item.type === 'note') return '📝';
    if (item.type === 'url') return '🌐';
    return '📁';
  };

  return (
    <div className="trash-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('trash')}</h1>
      </div>
      <div className="trash-list">
        {trash.length === 0 ? (
          <div className="empty-state">回收站为空</div>
        ) : (
          trash.map((item) => (
            <div key={item.id} className="trash-item">
              <ListItem
                icon={getTrashItemIcon(item)}
                title={getTrashItemTitle(item)}
                subtitle={getTrashItemSubtitle(item)}
              />
              <div className="trash-actions">
                <button
                  className="restore-btn"
                  onClick={() => restoreFromTrash(item.id)}
                >
                  恢复
                </button>
                <button
                  className="delete-btn"
                  onClick={() => permanentlyDelete(item.id)}
                >
                  永久删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TrashPage;

