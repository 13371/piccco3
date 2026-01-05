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
            <p className="help-item-content">首页的大白框用于快速记录内容，内容会独立保存，不会与其他文件夹关联。适合记录临时想法、待办事项等。内容会自动保存，无需手动操作。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpCreateNote')}</h3>
            <p className="help-item-content">点击顶部导航栏左侧的"+"按钮或"全部"页面的"新建记事"按钮，会打开全屏编辑页面。输入标题（可选，最多10个字符）和内容后点击右上角的"保存"按钮即可。如果内容为空，点击"取消"不会创建记事。记事会自动保存并同步到所有设备。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">编辑记事</h3>
            <p className="help-item-content">点击记事条目右侧的菜单按钮（三个点），选择"编辑"，会打开全屏编辑页面。编辑完成后点击右上角的"保存"按钮即可更新内容。编辑页面支持修改标题、内容和所属分类。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpCreateFolder')}</h3>
            <p className="help-item-content">{t('helpCreateFolderDesc')}</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">删除文件夹</h3>
            <p className="help-item-content">删除文件夹时，如果文件夹内还有记事或网址，系统会提示无法删除。请先删除或移出文件夹内的所有内容后，再删除文件夹。这样可以防止误删重要数据。删除的文件夹会进入回收站，30天后自动永久删除。</p>
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
            <p className="help-item-content">导航栏位于页面顶部，包含"首页"、"全部"、"网址"、"分类"和"我的"五个标签。点击不同标签可以快速切换页面。当前页面会以浅蓝色背景和蓝色文字高亮显示，未选中的标签显示为灰色文字。导航栏采用胶囊形状设计，带有柔和的阴影效果。</p>
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
            <h3 className="help-item-title">{t('versionUpdate')}</h3>
            <p className="help-item-content">
              {t('versionUpdateDesc')}
              <br /><br />
              <strong>v1.20（测试版）主要更新：</strong>
              <br />• 全新 UI 设计：轻量、简洁、干净的风格，白色为主，浅蓝色点缀
              <br />• 导航栏优化：胶囊形状，选中项使用浅蓝色渐变背景
              <br />• 卡片样式统一：所有内容容器使用圆角和柔和阴影
              <br />• 夜间模式适配：完整适配深色主题
              <br />• 新建记事页面全屏化：提供更好的编辑体验
              <br />• 快速新建优化：避免产生空白记事条目
              <br />• 版本号机制：实现乐观锁机制，处理并发同步冲突
              <br />• 审计日志：添加安全敏感操作的审计日志记录
              <br /><br />
              更多详细更新内容，请在"设置"页面查看"版本更新说明"。
            </p>
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
            <p className="help-item-content">在"设置"页面可以看到数据同步状态和最后同步时间。同步状态会显示为：已同步（显示时间）、待同步、同步中、同步成功或同步失败。点击"同步"按钮可以手动触发同步。如果同步卡住，可以点击"重置"按钮重置同步状态。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">{t('helpSyncAuto')}</h3>
            <p className="help-item-content">系统会在以下情况自动同步：登录时自动下载数据（优先使用服务器数据）、新建或编辑记事保存后自动上传（防抖 800-1200ms）、删除操作立即同步、页面可见性变化时自动同步、每3分钟兜底同步一次。你也可以在设置页面点击"同步"按钮手动触发同步。系统采用服务器数据优先策略，确保多设备数据一致性。</p>
          </div>
          <div className="help-item">
            <h3 className="help-item-title">数据同步机制</h3>
            <p className="help-item-content">系统采用服务器数据优先策略，确保多设备数据一致性。当你登录时，系统会自动从服务器下载最新数据。所有数据变更（新建、编辑、删除）都会自动同步到服务器，并在其他设备上同步。删除操作会立即同步，确保数据一致性。系统使用版本号机制（乐观锁）处理并发同步冲突，避免数据丢失。</p>
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
          <div className="feedback-actions">
            <button className="feedback-email-button" onClick={handleEmailClick}>
              📧 {t('feedbackEmail')}: z13371@qq.com
            </button>
            <p className="feedback-note">我们会在收到反馈后尽快回复。感谢您的支持！</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HelpFeedbackPage;









