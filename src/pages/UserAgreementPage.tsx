import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import './UserAgreementPage.css';

const UserAgreementPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="user-agreement-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('userAgreementTitle')}</h1>
      </div>

      <div className="agreement-content">
        <div className="agreement-intro">
          <p className="agreement-update-date">{t('agreementUpdateDate')}: 2025年1月1日</p>
          <p className="agreement-intro-text">{t('agreementIntro')}</p>
        </div>

        <section className="agreement-section">
          <h2 className="agreement-section-title">1. {t('agreementAcceptance')}</h2>
          <p className="agreement-text">{t('agreementAcceptanceDesc')}</p>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">2. {t('agreementServiceDescription')}</h2>
          <p className="agreement-text">{t('agreementServiceDescriptionDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementServiceItem1')}</li>
            <li>{t('agreementServiceItem2')}</li>
            <li>{t('agreementServiceItem3')}</li>
            <li>{t('agreementServiceItem4')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">3. {t('agreementUserAccount')}</h2>
          <p className="agreement-text">{t('agreementUserAccountDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementUserAccountItem1')}</li>
            <li>{t('agreementUserAccountItem2')}</li>
            <li>{t('agreementUserAccountItem3')}</li>
            <li>{t('agreementUserAccountItem4')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">4. {t('agreementUserObligations')}</h2>
          <p className="agreement-text">{t('agreementUserObligationsDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementUserObligationsItem1')}</li>
            <li>{t('agreementUserObligationsItem2')}</li>
            <li>{t('agreementUserObligationsItem3')}</li>
            <li>{t('agreementUserObligationsItem4')}</li>
            <li>{t('agreementUserObligationsItem5')}</li>
            <li>{t('agreementUserObligationsItem6')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">5. {t('agreementDataStorage')}</h2>
          <p className="agreement-text">{t('agreementDataStorageDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementDataStorageItem1')}</li>
            <li>{t('agreementDataStorageItem2')}</li>
            <li>{t('agreementDataStorageItem3')}</li>
            <li>{t('agreementDataStorageItem4')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">6. {t('agreementPrivacy')}</h2>
          <p className="agreement-text">{t('agreementPrivacyDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementPrivacyItem1')}</li>
            <li>{t('agreementPrivacyItem2')}</li>
            <li>{t('agreementPrivacyItem3')}</li>
            <li>{t('agreementPrivacyItem4')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">7. {t('agreementIntellectualProperty')}</h2>
          <p className="agreement-text">{t('agreementIntellectualPropertyDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementIntellectualPropertyItem1')}</li>
            <li>{t('agreementIntellectualPropertyItem2')}</li>
            <li>{t('agreementIntellectualPropertyItem3')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">8. {t('agreementServiceAvailability')}</h2>
          <p className="agreement-text">{t('agreementServiceAvailabilityDesc')}</p>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">9. {t('agreementDisclaimer')}</h2>
          <p className="agreement-text">{t('agreementDisclaimerDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementDisclaimerItem1')}</li>
            <li>{t('agreementDisclaimerItem2')}</li>
            <li>{t('agreementDisclaimerItem3')}</li>
            <li>{t('agreementDisclaimerItem4')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">10. {t('agreementTermination')}</h2>
          <p className="agreement-text">{t('agreementTerminationDesc')}</p>
          <ul className="agreement-list">
            <li>{t('agreementTerminationItem1')}</li>
            <li>{t('agreementTerminationItem2')}</li>
            <li>{t('agreementTerminationItem3')}</li>
          </ul>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">11. {t('agreementChanges')}</h2>
          <p className="agreement-text">{t('agreementChangesDesc')}</p>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">12. {t('agreementGoverningLaw')}</h2>
          <p className="agreement-text">{t('agreementGoverningLawDesc')}</p>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">13. {t('agreementContact')}</h2>
          <p className="agreement-text">{t('agreementContactDesc')}</p>
          <p className="agreement-contact-info">
            {t('agreementContactEmail')}: <a href="mailto:z13371@qq.com" className="agreement-link">z13371@qq.com</a>
          </p>
        </section>

        <section className="agreement-section">
          <h2 className="agreement-section-title">14. {t('agreementEntireAgreement')}</h2>
          <p className="agreement-text">{t('agreementEntireAgreementDesc')}</p>
        </section>

        <div className="agreement-footer">
          <p className="agreement-footer-text">{t('agreementFooter')}</p>
        </div>
      </div>
    </div>
  );
};

export default UserAgreementPage;








