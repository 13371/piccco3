import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import './AboutPage.css';

const AboutPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="about-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('about')}</h1>
      </div>

      <div className="about-content">
        <div className="about-logo">
          <div className="about-logo-icon">📝</div>
          <h2 className="about-app-name">piccco</h2>
        </div>

        <div className="about-info">
          <div className="about-info-item">
            <span className="about-info-label">{t('version')}</span>
            <span className="about-info-value">v1.172（测试版）</span>
          </div>
          <div className="about-info-item">
            <span className="about-info-label">{t('developer')}</span>
            <span className="about-info-value">{t('developerName')}</span>
          </div>
          <div className="about-info-item">
            <span className="about-info-label">{t('updateDate')}</span>
            <span className="about-info-value">2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;








