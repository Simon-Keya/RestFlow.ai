// apps/api/src/config/configuration.ts
export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const jwtSecret = process.env.JWT_SECRET;
  if (isProd && !jwtSecret) {
    throw new Error(
      'JWT_SECRET must be set in production. Refusing to boot with a default secret.',
    );
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: nodeEnv,

    database: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/restflow',
    },

    jwt: {
      // Dev-only fallback; production already failed above if unset
      secret: jwtSecret || 'dev-only-change-me',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    cors: {
      origin: process.env.CORS_ORIGIN || '*',
    },

    mpesa: {
      env: process.env.MPESA_ENV || 'sandbox',
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      shortcode: process.env.MPESA_SHORTCODE,
      passkey: process.env.MPESA_PASSKEY,
    },

    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },

    baseUrl: process.env.BASE_URL,
  };
};