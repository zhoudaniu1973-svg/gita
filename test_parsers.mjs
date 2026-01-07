/**
 * 解析器测试脚本 - 验证 J-Total 和 U-Fret 解析器
 * 运行: node test_parsers.mjs
 */

// 导入解析器（直接复制核心函数进行测试）

/**
 * HTML 片段转纯文本块
 */
function htmlToTextBlock(htmlFragment) {
    let s = htmlFragment
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return s;
}

/**
 * J-Total 解析核心
 */
function parseJTotalCore(html) {
    const candidates = [];

    // 从 <tt> 标签提取
    const ttMatches = html.match(/<tt\b[^>]*>([\s\S]*?)<\/tt>/gi) || [];
    for (const block of ttMatches) {
        const m = block.match(/<tt\b[^>]*>([\s\S]*?)<\/tt>/i);
        if (m?.[1]) candidates.push(htmlToTextBlock(m[1]));
    }

    // 从 <pre> 标签提取
    const preMatches = html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi) || [];
    for (const block of preMatches) {
        const m = block.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);
        if (m?.[1]) candidates.push(htmlToTextBlock(m[1]));
    }

    const content = candidates
        .map(t => t.trim())
        .filter(t => t.length >= 200)
        .sort((a, b) => b.length - a.length)[0] || '';

    return { ok: content.length >= 200, text: content };
}

/**
 * 反转义 JavaScript 字符串
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

/**
 * 判断字符串是否像和弦行
 */
function looksLikeChordLine(s) {
    return /\[[A-G](?:#|b)?(?:m|maj7?|m7|7|sus[24]?|dim|aug|add9?|M7)?(?:\/[A-G](?:#|b)?)?\]/.test(s);
}

/**
 * U-Fret 解析核心
 */
function parseUFretCore(html) {
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

    return { ok: text.length >= 100, text };
}

/**
 * 计算和弦比例
 */
function chordRatio(text) {
    const lines = text.split('\n').filter(l => l.trim().length);
    const chordLines = lines.filter(l => /\[[A-G](?:#|b)?/.test(l));
    return lines.length ? chordLines.length / lines.length : 0;
}

/**
 * 主测试函数
 */
async function run() {
    console.log('🎸 吉他谱解析器测试\n');

    const cases = [
        {
            name: 'J-Total',
            url: 'https://music.j-total.net/data/038yo/019_yonezu_kenshi/005.html',
            encoding: 'shift-jis',
            parser: parseJTotalCore
        },
        {
            name: 'U-Fret',
            url: 'https://www.ufret.jp/song.php?data=41824',
            encoding: 'utf-8',
            parser: parseUFretCore
        }
    ];

    let allPass = true;

    for (const c of cases) {
        console.log(`\n== ${c.name} ==`);
        console.log(`URL: ${c.url}`);

        try {
            const response = await fetch(c.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ja-JP,ja;q=0.9'
                }
            });

            let html;
            if (c.encoding === 'shift-jis') {
                const buffer = await response.arrayBuffer();
                const decoder = new TextDecoder('shift-jis');
                html = decoder.decode(buffer);
            } else {
                html = await response.text();
            }

            console.log(`HTML 长度: ${html.length}`);

            const result = c.parser(html);
            console.log(`解析结果: ${result.ok ? '✅ 成功' : '❌ 失败'}`);

            if (!result.ok) {
                allPass = false;
                continue;
            }

            const lines = result.text.split('\n').filter(l => l.trim().length);
            const ratio = chordRatio(result.text);

            console.log(`内容长度: ${result.text.length} 字符`);
            console.log(`有效行数: ${lines.length}`);
            console.log(`和弦比例: ${(ratio * 100).toFixed(1)}%`);

            // 验证指标
            if (lines.length < 20) {
                console.log('❌ 行数不足 20');
                allPass = false;
            } else if (ratio < 0.05) {
                console.log('❌ 和弦比例不足 5%');
                allPass = false;
            } else {
                console.log('✅ 通过验证');
            }

            // 显示前几行内容
            console.log('\n--- 内容预览 ---');
            console.log(lines.slice(0, 5).join('\n'));
            console.log('...');

        } catch (e) {
            console.log(`❌ 抓取失败: ${e.message}`);
            allPass = false;
        }
    }

    console.log('\n' + '='.repeat(40));
    console.log(allPass ? '✅ ALL PASS' : '❌ SOME TESTS FAILED');
    process.exit(allPass ? 0 : 1);
}

run();
