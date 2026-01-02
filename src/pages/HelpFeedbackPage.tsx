import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import './HelpFeedbackPage.css';

const HelpFeedbackPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleEmailClick = () => {
    window.location.href = 'mailto:z13371@qq.com?subject=piccco反馈';
  };

  return (
    <div className="help-feedback-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('helpAndFeedback')}</h1>
      </div>

      <div className="help-content">
        <section className="help-section">
          <h2 className="help-section-title">{t('helpBasicUsage')}</h2>
          <div className="help-item">
            <h3 className="help-item-title">首页内容</h3>
            <p className="help-item-content">首页的大白框用于快速记录内容，内容会独立保存，不会与其他文件夹关联。适合记录临时想法、待办事项等。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpCreateNote')}</h3>
            <p className="help-item-content">点击顶部导航栏的"+"按钮或"全部"页面的"新建记事"按钮，会打开全屏编辑页面。输入标题和内容后点击"保存"即可。记事会自动保存并同步。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">编辑记事</h3>
            <p className="help-item-content">点击记事条目右侧的菜单按钮，选择"编辑"，会打开全屏编辑页面。编辑完成后点击"保存"即可更新内容。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpCreateFolder')}</h3>
            <p className="help-item-content">{t('helpCreateFolderDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpAddUrl')}</h3>
            <p className="help-item-content">{t('helpAddUrlDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpStarItem')}</h3>
            <p className="help-item-content">{t('helpStarItemDesc')}</p>
          </div>
        </section>

        <section className="help-section">
          <h2 className="help-section-title">{t('helpPrivacyFolder')}</h2>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpPrivacyFolderTitle')}</h3>
            <p className="help-item-content">{t('helpPrivacyFolderDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpSetPassword')}</h3>
            <p className="help-item-content">{t('helpSetPasswordDesc')}</p>
          </div>
        </section>

        <section className="help-section">
          <h2 className="help-section-title">{t('helpSettings')}</h2>
          <div className="help-item">
            <h3 className="help-item-title">导航栏</h3>
            <p className="help-item-content">导航栏位于页面顶部，包含"首页"、"全部"、"网址"、"分类"和"我的"五个标签。点击不同标签可以快速切换页面。当前页面会以蓝色背景高亮显示。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpSortMode')}</h3>
            <p className="help-item-content">{t('helpSortModeDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpFontSize')}</h3>
            <p className="help-item-content">{t('helpFontSizeDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpNightMode')}</h3>
            <p className="help-item-content">{t('helpNightModeDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpLanguage')}</h3>
            <p className="help-item-content">{t('helpLanguageDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">版本更新说明</h3>
            <p className="help-item-content">在"设置"页面可以查看"版本更新说明"，了解最新版本的新功能、优化和问题修复。当前版本为 v1.15（测试版）。</p>
          </div>
        </section>

        <section className="help-section">
          <h2 className="help-section-title">{t('helpSync')}</h2>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpSyncTitle')}</h3>
            <p className="help-item-content">{t('helpSyncDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpSyncStatus')}</h3>
            <p className="help-item-content">在"设置"页面可以看到数据同步状态和最后同步时间。同步状态会显示为：已同步（显示时间）、待同步、同步中、同步成功或同步失败。点击"同步"按钮可以手动触发同步。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpSyncAuto')}</h3>
            <p className="help-item-content">系统会在以下情况自动同步：登录时自动下载数据、新建或编辑记事保存后自动上传。你也可以在设置页面点击"同步"按钮手动触发同步。</p>
          </div>
        </section>

        <section className="help-section">
          <h2 className="help-section-title">{t('helpData')}</h2>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpDataStorage')}</h3>
            <p className="help-item-content">{t('helpDataStorageDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpTrash')}</h3>
            <p className="help-item-content">{t('helpTrashDesc')}</p>
          </div>
        </section>

        <section className="help-section">
          <h2 className="help-section-title">{t('helpAccount')}</h2>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpLogin')}</h3>
            <p className="help-item-content">{t('helpLoginDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpDevice')}</h3>
            <p className="help-item-content">{t('helpDeviceDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpMessage')}</h3>
            <p className="help-item-content">{t('helpMessageDesc')}</p>
          </div>
        </section>

        <section className="feedback-section">
          <h2 className="help-section-title">{t('feedbackTitle')}</h2>
          <p className="feedback-content">{t('feedbackDesc')}</p>
          <p className="feedback-tips">{t('feedbackTips')}</p>
          <button className="feedback-email-button" onClick={handleEmailClick}>
            📧 {t('feedbackEmail')}: z13371@qq.com
          </button>
        </section>
      </div>
    </div>
  );
};

export default HelpFeedbackPage;









