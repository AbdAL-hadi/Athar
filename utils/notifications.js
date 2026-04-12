import nodemailer from 'nodemailer';

const getEnvValue = (key) => String(process.env[key] ?? '').trim();

const buildWelcomeEmailHtml = ({ name, code }) => {
  return `
    <div style="font-family: Georgia, serif; background: #f7f0eb; padding: 32px; color: #2f231d;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 32px; border: 1px solid #ead8d0;">
        <p style="letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px; color: #8b6f60; margin: 0 0 12px;">Athar Verification</p>
        <h1 style="font-size: 34px; margin: 0 0 16px;">Welcome, ${name || 'Athar guest'}.</h1>
        <p style="font-family: Arial, sans-serif; line-height: 1.7; font-size: 16px; margin: 0 0 18px;">
          Thank you for creating your Athar account. Please use the code below to verify your email and complete your sign up.
        </p>
        <div style="margin: 28px 0; padding: 18px 20px; background: #f4e4dc; border-radius: 18px; text-align: center;">
          <p style="font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.24em; font-size: 11px; color: #8b6f60; margin: 0 0 8px;">Verification code</p>
          <p style="font-size: 40px; letter-spacing: 0.24em; margin: 0; font-weight: 700;">${code}</p>
        </div>
        <p style="font-family: Arial, sans-serif; line-height: 1.7; font-size: 14px; color: #6f5a4f; margin: 0;">
          This code expires in 10 minutes. If you did not request this email, you can safely ignore it.
        </p>
      </div>
    </div>
  `;
};

const createSmtpTransporter = () => {
  const host = getEnvValue('SMTP_HOST');
  const port = Number(getEnvValue('SMTP_PORT') || 0);
  const user = getEnvValue('SMTP_USER');
  const pass = getEnvValue('SMTP_PASS');

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

export const sendVerificationEmail = async ({ email, name, code }) => {
  const transporter = createSmtpTransporter();
  const from = getEnvValue('EMAIL_FROM');

  if (!transporter || !from) {
    console.warn(
      `[Athar email] SMTP is not configured. Verification code for ${email}: ${code}`,
    );

    return {
      delivered: false,
      channel: 'console',
    };
  }

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Verification Code',
    html: buildWelcomeEmailHtml({ name, code }),
  });

  return {
    delivered: true,
    channel: 'email',
  };
};

const normalizeWhatsAppPhone = (phone) => String(phone ?? '').replace(/[^\d]/g, '');

const buildOrderWhatsAppMessage = ({ customerName, orderNumber, total }) => {
  return [
    `Welcome to Athar, ${customerName || 'dear customer'}.`,
    'Your order has been confirmed successfully.',
    `Order code: ${orderNumber}`,
    `Total: ${total} JD`,
    'We will keep you updated as your order moves forward.',
  ].join('\n');
};

const sendJsonRequest = async (url, options = {}) => {
  const { timeoutMs = 15000, headers = {}, body, ...restOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error?.message || `Request failed with ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const sendOrderWhatsAppMessage = async ({
  phone,
  customerName,
  orderNumber,
  total,
}) => {
  const accessToken = getEnvValue('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = getEnvValue('WHATSAPP_PHONE_NUMBER_ID');
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const message = buildOrderWhatsAppMessage({ customerName, orderNumber, total });

  if (!normalizedPhone) {
    return {
      delivered: false,
      channel: 'skipped',
      reason: 'missing-phone',
    };
  }

  if (!accessToken || !phoneNumberId) {
    console.warn(
      `[Athar WhatsApp] WhatsApp delivery is not configured. Order message for ${normalizedPhone}: ${message}`,
    );

    return {
      delivered: false,
      channel: 'console',
    };
  }

  await sendJsonRequest(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      messaging_product: 'whatsapp',
      to: normalizedPhone,
      type: 'text',
      text: {
        body: message,
      },
    },
  });

  return {
    delivered: true,
    channel: 'whatsapp',
  };
};
