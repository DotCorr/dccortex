/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Email service using Hostnet SMTP
 * In development mode (DEV_MODE=true), logs email content instead of sending
 */

import nodemailer from 'nodemailer';

// Allow real SMTP in development only when explicitly forced.
const forceSmtpInDev = process.env.FORCE_SMTP_IN_DEV === 'true';
const isDevMode = !forceSmtpInDev && (process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development');

// Create transporter only if credentials are available
const getTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS in environment variables.')
  }

  // Strip quotes from password if present (handles .env files that quote values with special chars)
  const password = (process.env.SMTP_PASS || '').replace(/^["']|["']$/g, '')

  return nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostnet.nl',
  port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // STARTTLS (not SSL/TLS)
  auth: {
      user: process.env.SMTP_USER, // Full email address
      pass: password,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000, // 10 seconds
    socketTimeout: 10000, // 10 seconds
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates if needed
  },
});
};

export async function sendInvitationEmail(
  to: string,
  organizationName: string,
  invitationLink: string
) {
  // In development mode, log instead of sending email (security: never log in production)
  if (isDevMode) {
    console.log('\n📧 [DEV MODE] Invitation Email (NOT SENT):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`To: ${to}`)
    console.log(`Subject: Invitation to join ${organizationName} on DCCortex`)
    console.log(`Invitation Link: ${invitationLink}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    return Promise.resolve({ messageId: 'dev-mode-logged' })
  }

  // Production: send real email
  const transporter = getTransporter()
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'cortex@dotcorr.com',
    to,
    subject: `Invitation to join ${organizationName} on DCCortex`,
    html: `
      <div style="margin: 0; padding: 0; background: #ffffff; color: #000000;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
          <tr>
            <td align="center" style="padding: 32px 16px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width: 100%; max-width: 600px; border-collapse: collapse; border: 1px solid #000000;">
                <tr>
                  <td style="padding: 20px 24px; border-bottom: 1px solid #000000; font-size: 12px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase;">
                    DCCORTEX
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 24px 10px 24px; font-size: 28px; line-height: 1.2; font-weight: 700;">
                    You&apos;re invited to ${organizationName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 24px 18px 24px; font-size: 15px; line-height: 1.6; color: #111111;">
                    You&apos;ve been invited to collaborate on DCCortex. Use the button below to accept your invitation.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 24px 22px 24px;">
                    <a href="${invitationLink}" style="display: inline-block; padding: 12px 20px; background: #000000; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; border: 1px solid #000000;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 24px 10px 24px; font-size: 13px; line-height: 1.6; color: #333333;">
                    If the button does not work, copy and paste this URL in your browser:
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 24px 24px 24px; font-size: 12px; line-height: 1.6; word-break: break-all; color: #000000;">
                    ${invitationLink}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 24px; border-top: 1px solid #000000; font-size: 11px; line-height: 1.6; color: #555555;">
                    This invitation expires in 7 days.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
    text: `You have been invited to join ${organizationName} on DCCortex.\n\nAccept invitation: ${invitationLink}\n\nThis invitation expires in 7 days.`,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendWelcomeEmail(to: string, name: string) {
  // In development mode, log instead of sending email (security: never log in production)
  if (isDevMode) {
    console.log('\n📧 [DEV MODE] Welcome Email (NOT SENT):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`To: ${to}`)
    console.log(`Subject: Welcome to DCCortex`)
    console.log(`Name: ${name}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    return Promise.resolve({ messageId: 'dev-mode-logged' })
  }

  // Production: send real email
  const transporter = getTransporter()
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'cortex@dotcorr.com',
    to,
    subject: 'Welcome to DCCortex',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to DCCortex, ${name}!</h2>
        <p>Your account has been created successfully. Start building your apps with our scripting platform.</p>
        <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Go to Dashboard
        </a>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
) {
  // In development mode, log instead of sending email (security: never log in production)
  if (isDevMode) {
    console.log('\n📧 [DEV MODE] Password Reset Email (NOT SENT):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`To: ${to}`)
    console.log(`Subject: Reset your DCCortex password`)
    console.log(`Reset Link: ${resetLink}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    return Promise.resolve({ messageId: 'dev-mode-logged' })
  }

  // Production: send real email
  const transporter = getTransporter()
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'cortex@dotcorr.com',
    to,
    subject: 'Reset your DCCortex password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>You requested to reset your password for your DCCortex account. Click the link below to reset it:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy this link: ${resetLink}</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

