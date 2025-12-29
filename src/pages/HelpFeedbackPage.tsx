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
            <h3 className="help-item-title">{t('helpCreateNote')}</h3>
            <p className="help-item-content">{t('helpCreateNoteDesc')}</p>
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

        <section className="feedback-section">
          <h2 className="help-section-title">{t('feedbackTitle')}</h2>
          <p className="feedback-content">{t('feedbackDesc')}</p>
          <button className="feedback-email-button" onClick={handleEmailClick}>
            📧 {t('feedbackEmail')}: z13371@qq.com
          </button>
        </section>
      </div>
    </div>
  );
};

export default HelpFeedbackPage;









