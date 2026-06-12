/* GET /api/leaderboard?id=<pid>
   Retorna { top:[{id,name,lvl}...30], you:{rank,lvl}|null, total } */
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
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
  if(req.method !== 'GET') return res.status(405).json({ error: 'method' });

  try{
    const id = String(req.query.id || '');
    const [topR, rankR, scoreR, totalR] = await pipe([
      ['ZRANGE', 't3:lb:global', 0, 29, 'REV', 'WITHSCORES'],
      ['ZREVRANK', 't3:lb:global', id],
      ['ZSCORE',  't3:lb:global', id],
      ['ZCARD',   't3:lb:global']
    ]);

    const flat = topR.result || [];
    const ids = [];
    for(let i = 0; i < flat.length; i += 2) ids.push(flat[i]);

    let names = [];
    if(ids.length){
      const [nm] = await pipe([['HMGET', 't3:lb:names', ...ids]]);
      names = nm.result || [];
    }

    const top = ids.map((pid, i) => ({
      id: pid,
      name: String(names[i] || 'Hunter').slice(0, 16),
      lvl: Number(flat[i * 2 + 1])
    }));

    const you = (rankR.result === null || rankR.result === undefined) ? null
      : { rank: Number(rankR.result) + 1, lvl: Number(scoreR.result) };

    return res.status(200).json({ top, you, total: Number(totalR.result || 0) });
  }catch(e){
    return res.status(500).json({ error: 'server' });
  }
};
