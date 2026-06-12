/* POST /api/score  { id, name, level }
   Grava no Upstash (prefixo t3:) — ZADD GT só deixa o score subir. */
const URL_  = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function pipe(cmds){
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if(!r.ok) throw new Error('upstash ' + r.status);
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST')    return res.status(405).json({ error: 'method' });

  try{
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const id    = String(b.id || '');
    let   name  = String(b.name || '').replace(/[<>&"'`]/g, '').trim().slice(0, 16);
    const level = Math.floor(Number(b.level));

    if(!/^p[a-z0-9]{8,30}$/.test(id))            return res.status(400).json({ error: 'id' });
    if(!name)                                     name = 'Hunter';
    if(!Number.isFinite(level) || level < 1 || level > 5000)
                                                  return res.status(400).json({ error: 'level' });

    await pipe([
      ['ZADD', 't3:lb:global', 'GT', level, id],
      ['HSET', 't3:lb:names', id, name]
    ]);
    return res.status(200).json({ ok: true });
  }catch(e){
    return res.status(500).json({ error: 'server' });
  }
};
