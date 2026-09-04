import fs from 'fs';

const jsFile = fs.readFileSync('js/config.js', 'utf8');
const supabaseUrlMatch = jsFile.match(/const SUPABASE_URL = '(.*?)'/);
const supabaseKeyMatch = jsFile.match(/const SUPABASE_ANON_KEY = '(.*?)'/);

if (supabaseUrlMatch && supabaseKeyMatch) {
  const url = `${supabaseUrlMatch[1]}/rest/v1/pedidos?select=*&order=created_at.desc&limit=5`;
  fetch(url, {
    headers: {
      apikey: supabaseKeyMatch[1],
      Authorization: `Bearer ${supabaseKeyMatch[1]}`,
    },
  })
    .then((r) => r.json())
    .then((data) => {
      console.log(JSON.stringify(data, null, 2));
    })
    .catch((err) => {
      console.error('FETCH ERROR', err);
    });
} else {
  console.log('NO MATCH', supabaseUrlMatch, supabaseKeyMatch);
}
