const { Redis } = require('@upstash/redis');

function redis() {
  // Upstash's Vercel integration can prefix its REST credentials with the
  // integration name. Accept both that naming and the standard Upstash names.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Faltan las variables REST de Upstash para Redis.');
  return new Redis({ url, token });
}

function admin(req) {
  const expected = process.env.QR_ADMIN_TOKEN;
  return Boolean(expected && req.headers.authorization === `Bearer ${expected}`);
}

module.exports = { redis, admin };
