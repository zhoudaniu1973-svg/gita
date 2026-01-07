/**
 * U-Fret 独立测试
 */

function unescapeJsString(s) {
    return s
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

    // 取所有 script 内容
    const scripts = [];
    html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, body) => {
        if (body && body.length > 50) scripts.push(body);
        return _;
    });
    console.log('Scripts found:', scripts.length);

    // 收集包含和弦标记的字符串
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

    console.log('Chord chunks found:', chunks.length);

    // 去重
    const uniqueChunks = [...new Set(chunks)];
    console.log('Unique chunks:', uniqueChunks.length);

    // 拼接
    const text = uniqueChunks
        .sort((a, b) => b.length - a.length)
        .slice(0, 200)
        .reverse()
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    console.log('Total text length:', text.length);
    console.log('\n--- First 800 chars ---');
    console.log(text.substring(0, 800));
}

testUFret().catch(console.error);
