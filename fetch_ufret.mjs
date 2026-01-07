import fs from 'fs';
import https from 'https';

const url = 'https://www.ufret.jp/song.php?data=175119';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

console.log(`Fetching ${url}...`);

try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
        console.error(`Status: ${response.status} ${response.statusText}`);
        process.exit(1);
    }
    const text = await response.text();
    fs.writeFileSync('ufret_dump.html', text);
    console.log(`Saved ${text.length} bytes to ufret_dump.html`);
} catch (e) {
    console.error('Fetch error:', e);
}
