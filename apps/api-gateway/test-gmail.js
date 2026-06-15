import 'dotenv/config';
import nodemailer from 'nodemailer';

const TO_EMAIL = process.argv[2] || 'thec1rcle.host123@gmail.com';

console.log('Testing Gmail SMTP...');
console.log('To:', TO_EMAIL);

async function testGmail() {
  try {
    // For Gmail, you need either:
    // 1. App Password (if 2FA is enabled)
    // 2. OAuth2 credentials
    // The API key alone won't work

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'thec1rcle.host123@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || '', // App password needed
      },
    });

    const info = await transporter.sendMail({
      from: '"THE C1RCLE" <thec1rcle.host123@gmail.com>',
      to: TO_EMAIL,
      subject: 'Test Email from C1RCLE',
      html: `
        <div style="background-color:#000;color:#fff;padding:40px;font-family:sans-serif;text-align:center;">
          <h1 style="color:#FF5A00;text-transform:uppercase;letter-spacing:5px;">THE C1RCLE</h1>
          <p>Test email!</p>
        </div>
      `,
    });

    console.log('Message sent:', info.messageId);
    console.log('✅ SUCCESS');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testGmail();
