import fs from 'fs';
import https from 'https';

const url = 'https://www.ufret.jp/song.php?data=175119';

const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

console.log(`Fetching ${url} with Mobile UA...`);

try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
        console.error(`Status: ${response.status} ${response.statusText}`);
        process.exit(1);
    }
    const text = await response.text();
    fs.writeFileSync('ufret_mobile_dump.html', text);
    console.log(`Saved ${text.length} bytes to ufret_mobile_dump.html`);
} catch (e) {
    console.error('Fetch error:', e);
}
