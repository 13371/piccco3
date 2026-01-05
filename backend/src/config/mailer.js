const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn(
    '[mailer] SMTP 配置不完整，发送验证码邮件会失败，请在 backend/.env 中配置 SMTP_HOST/SMTP_USER/SMTP_PASS'
  );
} else {
  console.log('[mailer] SMTP 配置已加载:', {
    host: SMTP_HOST,
    port: SMTP_PORT || 465,
    user: SMTP_USER,
    pass: SMTP_PASS ? '***已配置***' : '未配置'
  });
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 465,
  secure: String(SMTP_SECURE) === 'false' ? false : true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function sendVerificationCodeEmail(to, code) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // 开发环境或未设置 NODE_ENV：将验证码输出到控制台，方便测试
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    if (isDev) {
      // 使用更醒目的格式输出验证码
      console.log('\n\n');
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║          📧 验证码邮件（开发模式 - 未配置 SMTP）          ║');
      console.log('╠═══════════════════════════════════════════════════════════╣');
      console.log(`║  收件人: ${to.padEnd(47)} ║`);
      console.log(`║  验证码: ${code.padEnd(47)} ║`);
      console.log('║  有效期: 10 分钟                                        ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('\n');
      logger.info('mailer', `[开发模式] 验证码已输出到控制台: ${code} (收件人: ${to})`);
      return; // 开发环境直接返回，不抛出错误
    }
    throw new Error('SMTP 未配置，无法发送邮件。请在 backend/.env 文件中配置 SMTP_HOST、SMTP_USER 和 SMTP_PASS');
  }

  const mailOptions = {
    from: `"piccco" <${SMTP_USER}>`,
    to,
    subject: '您的 piccco 注册验证码',
    text: `您的验证码是：${code}，有效期 10 分钟。请不要泄露给他人。`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">piccco 验证码</h2>
        <p style="font-size: 16px; color: #666;">您的验证码是：</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #999;">有效期 10 分钟，请不要泄露给他人。</p>
        <p style="font-size: 12px; color: #ccc; margin-top: 30px;">此邮件由 piccco 系统自动发送，请勿回复。</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('mailer', `验证码已发送到 ${to}`);
  } catch (error) {
    logger.error('mailer', '发送邮件失败:', error);
    throw new Error(`发送邮件失败: ${error.message}`);
  }
}

module.exports = {
  sendVerificationCodeEmail,
};






