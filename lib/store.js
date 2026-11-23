const { Redis } = require('@upstash/redis');

function redis() {
  return Redis.fromEnv();
}

function admin(req) {
  const expected = process.env.QR_ADMIN_TOKEN;
  return Boolean(expected && req.headers.authorization === `Bearer ${expected}`);
}

module.exports = { redis, admin };
