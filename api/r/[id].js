const { redis } = require('../../lib/store');

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  const entry = id ? await redis().get(`qr:${id}`) : null;
  if (!entry || !/^https?:\/\//i.test(entry.url)) {
    return res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Este QR no existe o ha sido eliminado.');
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, entry.url);
};
