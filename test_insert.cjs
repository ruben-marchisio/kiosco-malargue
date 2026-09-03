const fs = require('fs');
const https = require('https');
const env = fs.readFileSync('js/config.js', 'utf8');
const urlMatch = env.match(/const SUPABASE_URL\s*=\s*['"](.*?)['"]/);
const keyMatch = env.match(/const SUPABASE_ANON\s*=\s*['"](.*?)['"]/);
if (urlMatch && keyMatch) {
  const url = urlMatch[1] + '/rest/v1/pedidos';
  const data = JSON.stringify({
    cliente_nombre: 'Prueba Terminal',
    monto_productos: 100,
    monto_envio: 50,
    monto_total: 150,
    metodo_pago: 'efectivo',
    estado: 'pendiente'
  });
  const req = https.request(url, {
    method: 'POST',
    headers: {
      'apikey': keyMatch[1],
      'Authorization': 'Bearer ' + keyMatch[1],
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }, (res) => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, 'Data:', responseData));
  });
  req.on('error', e => console.error(e));
  req.write(data);
  req.end();
}
