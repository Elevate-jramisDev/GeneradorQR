const { redis } = require('../../lib/store');

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return res.status(404).send('Este QR no existe.');
  let entry = null;
  try { entry = await redis().get(`qr:${id}`); } catch { /* QR aún no activado o almacenamiento temporalmente no disponible. */ }
  if (!entry || !/^https?:\/\//i.test(entry.url)) return res.redirect(302, `/activar/${encodeURIComponent(id)}`);
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, entry.url);
};
