const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate plain text version
const generatePlainText = (otp) => `
Welcome to PICME 🎉

You're almost there! Use the OTP below to verify your email address:

OTP: ${otp}

This OTP is valid for the next 60 minutes.

If you didn’t request this, please ignore this email.

© ${new Date().getFullYear()} PICME
`;

// Generate styled HTML (supports light/dark mode)
const generateHtml = (otp) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your PICME OTP Code</title>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f9f9f9;
      color: #333;
      padding: 40px;
    }
    .container {
      max-width: 600px;
      margin: auto;
      background-color: #fff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .otp-box {
      background-color: #6c5ce7;
      color: #fff;
      font-size: 28px;
      text-align: center;
      padding: 14px 32px;
      border-radius: 8px;
      letter-spacing: 8px;
      margin: 30px 0;
    }
    .footer {
      font-size: 12px;
      color: #999;
      text-align: center;
      margin-top: 30px;
    }

    @media (prefers-color-scheme: dark) {
      body {
        background-color: #111;
        color: #eee;
      }
      .container {
        background-color: #1a1a1a;
        color: #eee;
        box-shadow: 0 2px 10px rgba(255,255,255,0.05);
      }
      .otp-box {
        background-color: #00cec9;
        color: #111;
      }
      .footer {
        color: #777;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h2 style="text-align:center;">Welcome to <span style="color:#6c5ce7;">PICME</span> 🎉</h2>
    <p style="font-size: 16px;">You're almost there! Use the OTP below to verify your email address:</p>
    <div class="otp-box">${otp}</div>
    <p style="font-size: 14px; color: #888;">This OTP is valid for the next 60 minutes.</p>
    <p style="font-size: 14px; color: #aaa;">If you didn’t request this, please ignore this email.</p>
    <hr style="margin: 30px 0;">
    <div class="footer">&copy; ${new Date().getFullYear()} PICME. All rights reserved.</div>
  </div>
</body>
</html>
`;

module.exports = async (to, subject, otpCode) => {
  await transporter.sendMail({
    from: `"PICME" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: generatePlainText(otpCode),
    html: generateHtml(otpCode),
  });
};