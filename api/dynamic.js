const { randomBytes } = require('node:crypto');
const { redis, admin } = require('../lib/store');

const key = (id) => `qr:${id}`;
const validUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch { return false; }
};

module.exports = async (req, res) => {
  if (!admin(req)) return res.status(401).json({ error: 'Clave de administración incorrecta.' });
  const store = redis();
  if (req.method === 'GET') {
    const ids = await store.smembers('qr:ids');
    const entries = await Promise.all(ids.map((id) => store.get(key(id))));
    return res.status(200).json(entries.filter(Boolean));
  }
  if (req.method === 'POST') {
    const { id, url, label } = req.body || {};
    if (!validUrl(url)) return res.status(400).json({ error: 'Introduce una URL http:// o https:// válida.' });
    const entryId = id || randomBytes(6).toString('base64url');
    if (id && !(await store.sismember('qr:ids', id))) return res.status(404).json({ error: 'No se encontró ese QR.' });
    const previous = id ? await store.get(key(id)) : null;
    const entry = { id: entryId, url: url.trim(), label: String(label || '').trim().slice(0, 100), createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    await store.set(key(entryId), entry);
    await store.sadd('qr:ids', entryId);
    return res.status(id ? 200 : 201).json(entry);
  }
  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    await store.del(key(id));
    await store.srem('qr:ids', id);
    return res.status(200).json({ ok: true });
  }
  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).end();
};
