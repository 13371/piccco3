import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ListItem from '../components/ListItem';
import Modal from '../components/Modal';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../i18n/useTranslation';
import './SettingsPage.css';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sortMode = useSettingsStore((state) => state.sortMode);
  const setSortMode = useSettingsStore((state) => state.setSortMode);
  const [showSortModal, setShowSortModal] = useState(false);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const [showFontModal, setShowFontModal] = useState(false);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const nightMode = useSettingsStore((state) => state.nightMode);
  const setNightMode = useSettingsStore((state) => state.setNightMode);
  const [showNightModal, setShowNightModal] = useState(false);

  const settingSubItems = [
    {
      icon: '📱',
      title: t('deviceManagementTitle'),
      onClick: () => {
        navigate('/devices');
      },
    },
    {
      icon: '📂',
      title: t('sortManagementTitle'),
      onClick: () => {
        setShowSortModal(true);
      },
    },
    {
      icon: '🔤',
      title: t('fontSizeTitle'),
      onClick: () => {
        setShowFontModal(true);
      },
    },
    {
      icon: '🌙',
      title: t('nightModeTitle'),
      onClick: () => {
        setShowNightModal(true);
      },
    },
    {
      icon: '🌐',
      title: t('languageTitle'),
      onClick: () => {
        setShowLanguageModal(true);
      },
    },
    {
      icon: '📜',
      title: t('userAgreementTitle'),
      onClick: () => {
        navigate('/user-agreement');
      },
    },
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <button className="page-back-button" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h1 className="page-title">{t('settings')}</h1>
      </div>
      <div className="settings-list">
        {settingSubItems.map((item, index) => (
          <ListItem
            key={index}
            icon={item.icon}
            title={item.title}
            onClick={item.onClick}
          />
        ))}
      </div>
      <Modal
        isOpen={showSortModal}
        onClose={() => setShowSortModal(false)}
        title={t('sortManagementTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="sortMode"
                value="updatedAt"
                checked={sortMode === 'updatedAt'}
                onChange={() => setSortMode('updatedAt')}
              />
              {t('sortByTime')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="sortMode"
                value="name"
                checked={sortMode === 'name'}
                onChange={() => setSortMode('name')}
              />
              {t('sortByName')}
            </label>
          </div>
          <p className="sort-tip">
            {t('sortTip')}
          </p>
        </div>
      </Modal>
      <Modal
        isOpen={showFontModal}
        onClose={() => setShowFontModal(false)}
        title={t('fontSizeTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="fontSize"
                value="small"
                checked={fontSize === 'small'}
                onChange={() => setFontSize('small')}
              />
              {t('fontSizeSmall')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="fontSize"
                value="medium"
                checked={fontSize === 'medium'}
                onChange={() => setFontSize('medium')}
              />
              {t('fontSizeMedium')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="fontSize"
                value="large"
                checked={fontSize === 'large'}
                onChange={() => setFontSize('large')}
              />
              {t('fontSizeLarge')}
            </label>
          </div>
          <p className="sort-tip">
            {t('fontSizeTip')}
          </p>
        </div>
      </Modal>
      <Modal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title={t('languageTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="language"
                value="zh"
                checked={language === 'zh'}
                onChange={() => setLanguage('zh')}
              />
              {t('languageZh')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="language"
                value="en"
                checked={language === 'en'}
                onChange={() => setLanguage('en')}
              />
              {t('languageEn')}
            </label>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={showNightModal}
        onClose={() => setShowNightModal(false)}
        title={t('nightModeTitle')}
      >
        <div className="sort-settings-body">
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="nightMode"
                value="day"
                checked={nightMode === 'day'}
                onChange={() => setNightMode('day')}
              />
              {t('nightModeDay')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="nightMode"
                value="night"
                checked={nightMode === 'night'}
                onChange={() => setNightMode('night')}
              />
              {t('nightModeNight')}
            </label>
          </div>
          <div className="sort-option">
            <label>
              <input
                type="radio"
                name="nightMode"
                value="auto"
                checked={nightMode === 'auto'}
                onChange={() => setNightMode('auto')}
              />
              {t('nightModeAuto')}
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;


