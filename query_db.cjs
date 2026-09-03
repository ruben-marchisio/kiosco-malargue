const fs = require('fs');
const https = require('https');
const env = fs.readFileSync('js/config.js', 'utf8');
const urlMatch = env.match(/const SUPABASE_URL\s*=\s*['"](.*?)['"]/);
const keyMatch = env.match(/const SUPABASE_ANON\s*=\s*['"](.*?)['"]/);
if (urlMatch && keyMatch) {
  const url = urlMatch[1] + '/rest/v1/pedidos?select=id,comercio_id,cliente_nombre,estado,monto_envio,monto_productos,liquidacion_id,created_at&order=created_at.desc&limit=5';
  const req = https.request(url, { headers: { 'apikey': keyMatch[1], 'Authorization': 'Bearer ' + keyMatch[1] } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data));
  });
  req.on('error', e => console.error(e));
  req.end();
}
