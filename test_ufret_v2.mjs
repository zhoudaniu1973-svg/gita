/**
 * U-Fret 测试 - 验证 Unicode 解码
 */

function unescapeJsString(s) {
    return s
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
}

function looksLikeChordLine(s) {
    return /\[[A-G](?:#|b)?(?:m|maj7?|m7|7|sus[24]?|dim|aug|add9?|M7)?(?:\/[A-G](?:#|b)?)?\]/.test(s);
}

async function testUFret() {
    const url = 'https://www.ufret.jp/song.php?data=41824';

    console.log('Fetching U-Fret...');
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const html = await response.text();
    console.log('HTML length:', html.length);

    const scripts = [];
    html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, body) => {
        if (body && body.length > 50) scripts.push(body);
        return _;
    });

    const chunks = [];

    for (const sc of scripts) {
        const strMatches = sc.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g) || [];
        for (const raw of strMatches) {
            const inner = raw.slice(1, -1);
            const s = unescapeJsString(inner);
            if (s.length < 20) continue;
            if (looksLikeChordLine(s)) chunks.push(s);
        }
    }

    const uniqueChunks = [...new Set(chunks)];

    const text = uniqueChunks
        .sort((a, b) => b.length - a.length)
        .slice(0, 200)
        .reverse()
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    console.log('Total text length:', text.length);
    console.log('Lines:', text.split('\n').length);
    console.log('\n--- First 1000 chars ---');
    console.log(text.substring(0, 1000));
}

testUFret().catch(console.error);
