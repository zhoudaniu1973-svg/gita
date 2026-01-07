/**
 * 本地开发服务器
 * 同时运行 Vite 前端和 Express API
 */
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ===== API 端点 =====

// 搜索 API
app.get('/api/search', async (req, res) => {
    const { q } = req.query;

    if (!q || !q.trim()) {
        return res.status(400).json({ error: 'Missing search query' });
    }

    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;

        if (!apiKey || !cx) {
            return res.status(500).json({ error: 'Missing API configuration' });
        }

        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q + ' guitar tab OR guitar chords')}&num=10`;

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.error) {
            console.error('Google API error:', data.error);
            return res.status(500).json({ error: 'Search API error', details: data.error.message });
        }

        // 解析结果
        const results = (data.items || []).map(item => {
            const url = item.link;
            const domain = new URL(url).hostname.replace('www.', '');
            const { title, artist } = extractTitleArtist(item.title);
            const type = inferType(item.title, item.snippet || '');
            const info = extractInfo(item.snippet || '', type);
            const parseable = isParseableDomain(domain);

            return {
                title,
                artist,
                type,
                info,
                source: domain,
                url,
                parseable,
                score: calculateScore(type, parseable, domain)
            };
        });

        // 排序
        results.sort((a, b) => b.score - a.score);
        const cleanResults = results.map(({ score, ...rest }) => rest);

        res.json({ results: cleanResults });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 抓取 API
app.post('/api/fetch', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL' });
    }

    try {
        const domain = new URL(url).hostname;

        // 针对日本站点使用更真实的请求头
        const isJapaneseSite = ['j-total.net', 'chordwiki.jpn.org', 'ufret.jp', 'gakufu.gakki.me']
            .some(d => domain.includes(d));

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': isJapaneseSite ? 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Fetch failed: ${response.statusText}` });
        }

        // 获取原始二进制数据以处理编码
        const buffer = await response.arrayBuffer();

        // 检测编码
        let encoding = 'utf-8';
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('shift_jis') || contentType.includes('shift-jis')) {
            encoding = 'shift-jis';
        } else if (contentType.includes('euc-jp')) {
            encoding = 'euc-jp';
        }

        // j-total.net 默认使用 Shift-JIS
        if (domain.includes('j-total.net')) {
            encoding = 'shift-jis';
        }

        // 使用 TextDecoder 解码
        let html = '';
        try {
            const decoder = new TextDecoder(encoding);
            html = decoder.decode(buffer);
        } catch (e) {
            // 如果解码失败，尝试从 HTML meta 标签检测
            const decoder = new TextDecoder('utf-8', { fatal: false });
            html = decoder.decode(buffer);

            // 检查 meta charset
            const charsetMatch = html.match(/<meta[^>]*charset=["']?([^"'\s>]+)/i);
            if (charsetMatch) {
                const detectedEncoding = charsetMatch[1].toLowerCase();
                if (detectedEncoding !== 'utf-8' && detectedEncoding !== 'utf8') {
                    try {
                        const newDecoder = new TextDecoder(detectedEncoding);
                        html = newDecoder.decode(buffer);
                    } catch {
                        // 保持 UTF-8 解码结果
                    }
                }
            }
        }

        const result = parseHtml(html, url);
        res.json(result);

    } catch (error) {
        console.error('Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch page' });
    }
});

// ===== 辅助函数 =====

function extractTitleArtist(rawTitle) {
    let title = rawTitle;
    let artist = '';

    title = title.replace(/\s*[-–|]\s*(Ultimate Guitar|Songsterr|Chordify|Tabs|Tab|Chords?).*$/i, '');

    const byMatch = title.match(/(.+?)\s+by\s+(.+)/i);
    if (byMatch) {
        title = byMatch[1].trim();
        artist = byMatch[2].trim();
    } else {
        const dashMatch = title.match(/(.+?)\s*[-–]\s*(.+)/);
        if (dashMatch) {
            artist = dashMatch[1].trim();
            title = dashMatch[2].trim();
        }
    }

    title = title.replace(/\s*(chord|chords|tab|tabs|guitar|acoustic|fingerstyle)\s*/gi, ' ').trim();
    return { title, artist };
}

function inferType(title, snippet) {
    const text = (title + ' ' + snippet).toLowerCase();
    if (text.includes('fingerstyle') || text.includes('solo')) return 'Fingerstyle';
    if (text.includes('tab') && !text.includes('chord')) return 'Tab';
    if (text.includes('chord')) return 'Chord';
    return 'Unknown';
}

function extractInfo(snippet, type) {
    const parts = [type];
    const capoMatch = snippet.match(/capo[:\s]*(\d+)/i);
    if (capoMatch) parts.push(`Capo ${capoMatch[1]}`);
    const keyMatch = snippet.match(/key[:\s]*([A-G][#b]?m?)/i);
    if (keyMatch) parts.push(keyMatch[1]);
    return parts.join(' · ');
}

// 可解析域名白名单（按成功率排序）
// 第一梯队：j-total.net, chordwiki.jpn.org
// 第二梯队：ufret.jp
const PARSEABLE_DOMAINS = [
    'j-total.net',
    'chordwiki.jpn.org',
    'ufret.jp',
    'guitartabs.cc'
];

const DOMAIN_PRIORITY = {
    'j-total.net': 100,
    'chordwiki.jpn.org': 95,
    'ufret.jp': 70,
    'guitartabs.cc': 45,
    'ultimate-guitar.com': 60  // 仅跳转，但有时能解析
};

function isParseableDomain(domain) {
    return PARSEABLE_DOMAINS.some(d => domain.includes(d));
}

function calculateScore(type, parseable, domain) {
    let score = parseable ? 100 : 0;
    if (type === 'Chord') score += 40;
    else if (type === 'Fingerstyle') score += 30;
    else if (type === 'Tab') score += 20;

    // 使用优先级配置
    for (const [d, priority] of Object.entries(DOMAIN_PRIORITY)) {
        if (domain.includes(d)) {
            score += priority;
            break;
        }
    }

    return score;
}

function parseHtml(html, url) {
    const domain = new URL(url).hostname.replace('www.', '');

    // 第一梯队：最高优先
    if (domain.includes('j-total.net')) {
        return parseJapaneseTab(html);
    }
    if (domain.includes('chordwiki.jpn.org')) {
        return parseChordWikiTab(html);
    }

    // 第二梯队
    if (domain.includes('ufret.jp')) {
        return parseUFretTab(html);
    }

    // Ultimate Guitar 专用解析
    if (domain.includes('ultimate-guitar.com')) {
        return parseUltimateGuitar(html);
    }

    // 通用解析
    return parseGeneric(html);
}

/**
 * Ultimate Guitar 解析器
 * 从页面的 js-store 或 UGAPP JSON 中提取数据
 */
function parseUltimateGuitar(html) {
    let content = '';
    let title = '';
    let artist = '';
    let capo = null;
    let type = 'Chord';

    // 方法1: 从 .js-store data-content 属性提取 JSON
    const jsStoreMatch = html.match(/class="js-store"[^>]*data-content="([^"]+)"/);
    if (jsStoreMatch) {
        try {
            // 解码 HTML 实体
            const jsonStr = jsStoreMatch[1]
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');

            const data = JSON.parse(jsonStr);
            const tabView = data?.store?.page?.data?.tab_view;

            if (tabView) {
                // 提取内容
                content = tabView.wiki_tab?.content || '';

                // 提取元信息
                const tabInfo = data?.store?.page?.data?.tab;
                if (tabInfo) {
                    title = tabInfo.song_name || '';
                    artist = tabInfo.artist_name || '';
                }

                // 提取 Capo
                const meta = tabView.meta;
                if (meta?.capo !== undefined) {
                    capo = meta.capo;
                }

                // 判断类型
                const tabType = data?.store?.page?.data?.tab?.type_name;
                if (tabType) {
                    if (tabType.toLowerCase().includes('tab')) type = 'Tab';
                    else if (tabType.toLowerCase().includes('chord')) type = 'Chord';
                }
            }
        } catch (e) {
            console.error('UG JSON parse error:', e.message);
        }
    }

    // 方法2: 如果 JSON 解析失败，尝试从 <pre> 提取
    if (!content) {
        const preMatch = html.match(/<pre[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi);
        if (preMatch) {
            content = preMatch
                .map(p => p.replace(/<\/?pre[^>]*>/gi, ''))
                .map(stripHtml)
                .join('\n\n');
        }
    }

    // 处理 [ch]Am[/ch] 格式的和弦标记
    content = content
        .replace(/\[ch\]/g, '')
        .replace(/\[\/ch\]/g, '')
        .replace(/\[tab\]/g, '')
        .replace(/\[\/tab\]/g, '');

    // 如果还没有标题，从 <title> 提取
    if (!title) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
            const extracted = extractTitleArtist(titleMatch[1]);
            title = extracted.title;
            artist = extracted.artist;
        }
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type,
        content: content.trim(),
        capo,
        parseable: content.length > 50
    };
}

/**
 * 日文站点解析器 (J-Total)
 * 第一梯队 - 最高优先，纯文本和弦谱
 * 
 * J-Total 页面结构（2024 分析）：
 * - 标题在 div.box2 h1 或 <title> 中
 * - 艺术家/词曲信息在 h2 中
 * - 和弦谱内容在 <tt> 标签中（关键选择器）
 */
function parseJapaneseTab(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 提取标题（格式：歌名（艺术家）/ コード譜 / ギター - J-Total Music）
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        const fullTitle = titleMatch[1];
        // 尝试提取歌名和艺术家
        const nameMatch = fullTitle.match(/^([^（(]+)[（(]([^）)]+)[）)]/);
        if (nameMatch) {
            title = nameMatch[1].trim();
            artist = nameMatch[2].trim();
        } else {
            const parts = fullTitle.split(/[-–/]/);
            title = parts[0]?.trim() || '';
        }
    }

    // 尝试从 h2 提取艺术家（更精确）
    // 格式：歌：XXX / 词：XXX / 曲：XXX
    const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    if (h2Match) {
        const h2Text = h2Match[1];
        const singMatch = h2Text.match(/歌[：:]([^/]+)/);
        if (singMatch) {
            artist = singMatch[1].trim();
        }
    }

    // ★★★ 方法1（最优先）: 从 <tt> 标签提取 ★★★
    // J-Total 的和弦谱核心内容在 <tt> 标签中
    const ttMatch = html.match(/<tt[^>]*>([\s\S]*?)<\/tt>/gi);
    if (ttMatch && ttMatch.length > 0) {
        content = ttMatch
            .map(tt => {
                // 移除 <tt> 标签
                let text = tt.replace(/<\/?tt[^>]*>/gi, '');
                // 处理 <br> 换行
                text = text.replace(/<br\s*\/?>/gi, '\n');
                // 移除其他 HTML 标签但保留文本
                text = stripHtml(text);
                return text;
            })
            .join('\n\n')
            // 过滤掉引导链接行
            .split('\n')
            .filter(line => !line.includes('はこちら') && !line.includes('クリック'))
            .join('\n')
            .trim();
    }

    // 方法2: 从 <pre> 提取（老版本格式）
    if (!content) {
        const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
        if (preMatch && preMatch.length > 0) {
            content = preMatch
                .map(p => p.replace(/<\/?pre[^>]*>/gi, ''))
                .map(stripHtml)
                .join('\n\n');
        }
    }

    // 方法3: 从 table 中提取
    if (!content) {
        const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
        if (tableMatch) {
            const tableContent = tableMatch
                .map(table => {
                    const rows = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
                    return rows.map(row => {
                        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
                        return cells.map(cell => stripHtml(cell)).join(' ');
                    }).join('\n');
                })
                .filter(t => t.length > 50 && /[A-G][#b]?(m|7|M)?/.test(t))
                .join('\n\n');

            if (tableContent) {
                content = tableContent;
            }
        }
    }

    // ========================
    // 内容清理（打磨输出质量）
    // ========================
    if (content) {
        content = content
            // 1. 去除开头的引导文字（更宽松的匹配）
            .replace(/「?動画sync.*$/gm, '')
            .replace(/「?初心者向け.*$/gm, '')
            .replace(/「?簡単Ver.*$/gm, '')
            .replace(/^Ver\.?\d*\s*$/gm, '')
            // 2. 去除结尾的版权声明
            .replace(/剽窃（採譜[\s\S]*$/g, '')
            .replace(/※.*禁止.*$/gm, '')
            .replace(/Copyright[\s\S]*$/gi, '')
            // 3. 去除站点广告/提示
            .replace(/→.*歌詞はこちら.*$/gm, '')
            .replace(/★.*おすすめ.*$/gm, '')
            .replace(/▼.*$/gm, '')
            // 4. 压缩连续空行（3个以上 → 2个）
            .replace(/\n{3,}/g, '\n\n')
            // 5. 修剪首尾空白
            .trim();
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: detectType(content),
        content: content.trim(),
        capo: extractCapo(html),
        parseable: content.length > 50,
        source: 'j-total.net'
    };
}

/**
 * ChordWiki 解析器 (chordwiki.jpn.org)
 * 第一梯队 - 日文和弦谱 Wiki，DOM 稳定，文本清晰
 */
function parseChordWikiTab(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 提取标题
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        const parts = titleMatch[1].split(/[-–]/);
        title = parts[0]?.trim() || '';
        artist = parts[1]?.trim().replace(/ChordWiki.*$/i, '').trim() || '';
    }

    // 尝试从 <h1> 提取更精确的标题
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
        title = stripHtml(h1Match[1]);
    }

    // 从 <pre> 提取
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
    if (preMatch && preMatch.length > 0) {
        content = preMatch
            .map(p => p.replace(/<\/?pre[^>]*>/gi, ''))
            .map(stripHtml)
            .join('\n\n');
    }

    // 如果没有 <pre>，尝试从 wiki 内容区域提取
    if (!content) {
        const wikiMatch = html.match(/<div[^>]*class="[^"]*(?:wiki|content|chord)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
        if (wikiMatch) {
            content = wikiMatch
                .map(w => stripHtml(w))
                .filter(text => text.split('\n').length > 5)
                .join('\n\n');
        }
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: detectType(content) || 'Chord',
        content: content.trim(),
        capo: extractCapo(html),
        parseable: content.length > 50,
        source: 'chordwiki.jpn.org'
    };
}

/**
 * U-Fret 解析器 (ufret.jp)
 * 第二梯队 - 新歌多，但广告多/DOM 易变
 * 
 * U-Fret 页面结构（2024 分析）：
 * - 曲谱容器：#my-chord-data
 * - 行容器：.chord-row
 * - 和弦名称：<rt> 标签（ruby 注音）
 * - 歌词片段：.col span
 */
function parseUFretTab(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 首先移除所有 script 和 style 标签内容
    const cleanHtml = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    // 提取标题
    const titleMatch = cleanHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
        title = stripHtml(titleMatch[1]);
    }

    // 尝试从 title 标签提取
    if (!title) {
        const pageTitleMatch = cleanHtml.match(/<title>([^<]+)<\/title>/i);
        if (pageTitleMatch) {
            const parts = pageTitleMatch[1].split(/[\/|]/);
            title = parts[0]?.trim() || '';
            if (!artist && parts[1]) {
                artist = parts[1].trim().replace(/U-?FRET.*$/i, '').replace(/ギターコード.*$/i, '').trim();
            }
        }
    }

    // 提取艺术家
    const artistMatch = cleanHtml.match(/<p[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/p>/i);
    if (artistMatch) {
        artist = stripHtml(artistMatch[1]);
    }

    // 清理艺术家名称
    if (artist) {
        artist = artist.replace(/ギターコード.*$/i, '').trim();
    }

    // ★★★ 方法1（最优先）: 从 #my-chord-data 提取 ★★★
    // U-Fret 使用 ruby 标签，和弦在 <rt> 中
    const chordDataMatch = cleanHtml.match(/<div[^>]*id="my-chord-data"[^>]*>([\s\S]*?)<\/div>/i);
    if (chordDataMatch) {
        const chordDataHtml = chordDataMatch[1];

        // 提取所有 .chord-row 行
        const rows = chordDataHtml.match(/<div[^>]*class="[^"]*chord-row[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || [];

        if (rows.length > 0) {
            const lines = rows.map(row => {
                // 提取和弦（在 <rt> 标签中）
                const chords = [];
                const rtMatches = row.match(/<rt[^>]*>([^<]+)<\/rt>/gi) || [];
                rtMatches.forEach(rt => {
                    const chord = rt.replace(/<\/?rt[^>]*>/gi, '').trim();
                    if (chord && /^[A-G]/.test(chord)) {
                        chords.push(chord);
                    }
                });

                // 提取歌词（在 .col span 中或直接文本）
                let lyrics = stripHtml(row)
                    // 移除和弦，只保留歌词
                    .replace(/\b[A-G][#b]?(m|M|7|add|sus|dim|aug|9|11|13)?\d*\b/g, '')
                    .replace(/\s+/g, '')
                    .trim();

                // 组合和弦和歌词行
                if (chords.length > 0) {
                    return chords.join(' ') + '\n' + lyrics;
                }
                return lyrics;
            }).filter(line => line.trim());

            content = lines.join('\n');
        }
    }

    // 方法2: 从 <rt> 标签直接提取所有和弦
    if (!content) {
        const rtMatches = cleanHtml.match(/<rt[^>]*>([^<]+)<\/rt>/gi) || [];
        if (rtMatches.length >= 5) {
            const chords = rtMatches
                .map(rt => rt.replace(/<\/?rt[^>]*>/gi, '').trim())
                .filter(chord => chord && /^[A-G]/.test(chord));

            if (chords.length >= 5) {
                // 同时提取歌词文本
                const lyricsMatch = cleanHtml.match(/<ruby[^>]*>([\s\S]*?)<\/ruby>/gi) || [];
                const lyrics = lyricsMatch
                    .map(ruby => {
                        // 移除 rt 标签，保留歌词
                        return ruby.replace(/<rt[^>]*>[^<]*<\/rt>/gi, '')
                            .replace(/<\/?ruby[^>]*>/gi, '');
                    })
                    .map(stripHtml)
                    .join('');

                content = chords.join(' ') + '\n\n' + lyrics;
            }
        }
    }

    // 方法3: 从 .chord 类元素提取
    if (!content) {
        const chordElements = cleanHtml.match(/<(?:p|span|div)[^>]*class="[^"]*chord[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span|div)>/gi) || [];
        if (chordElements.length > 0) {
            const validChords = chordElements
                .map(el => stripHtml(el))
                .filter(text => {
                    if (text.includes('function') || text.includes('var ') || text.includes('append_dom')) {
                        return false;
                    }
                    return text.length > 0 && text.length < 100;
                });

            if (validChords.length >= 5) {
                content = validChords.join('\n');
            }
        }
    }

    // 最终清理
    if (content) {
        content = content
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('var ') || trimmed.startsWith('let ') || trimmed.startsWith('const ')) return false;
                if (trimmed.includes('function(') || trimmed.includes('=>')) return false;
                if (trimmed.includes('append_dom') || trimmed.includes('document.')) return false;
                if (trimmed.includes('行削除') || trimmed.includes('プレミアム')) return false;
                return true;
            })
            .join('\n');
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: 'Chord',
        content: content.trim(),
        capo: extractCapo(cleanHtml),
        parseable: content.length > 50,
        source: 'ufret.jp'
    };
}

/**
 * 通用解析器
 */
function parseGeneric(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 提取标题
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        const parts = titleMatch[1].split(/[-–|]/);
        title = parts[0]?.trim() || '';
        artist = parts[1]?.trim() || '';
    }

    // 从 <pre> 提取
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
    if (preMatch) {
        content = preMatch
            .map(p => p.replace(/<\/?pre[^>]*>/gi, ''))
            .map(stripHtml)
            .join('\n\n');
    }

    // 如果没有 <pre>，尝试 <code>
    if (!content) {
        const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/gi);
        if (codeMatch) {
            content = codeMatch
                .map(c => c.replace(/<\/?code[^>]*>/gi, ''))
                .map(stripHtml)
                .join('\n\n');
        }
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: detectType(content),
        content: content.trim(),
        capo: extractCapo(html),
        parseable: content.length > 50
    };
}

function stripHtml(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function detectType(content) {
    if (!content) return 'Unknown';
    const tabRegex = /[eEBGDA]\|[-0-9]+\|/g;
    if (content.match(tabRegex)?.length >= 4) return 'Tab';
    const chordRegex = /\b[A-G][#b]?(m|maj|min|dim)?[0-9]?\b/g;
    if (content.match(chordRegex)?.length >= 3) return 'Chord';
    return 'Unknown';
}

function extractCapo(text) {
    const match = text.match(/capo[:\s]*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
}

// ===== 启动服务器 =====

async function startServer() {
    // 创建 Vite 开发服务器
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
    });

    // 使用 Vite 中间件
    app.use(vite.middlewares);

    app.listen(PORT, () => {
        console.log(`\n  🎸 GuitarTab Dev Server`);
        console.log(`  ➜  Local:   http://localhost:${PORT}/`);
        console.log(`  ➜  API:     http://localhost:${PORT}/api/search?q=test\n`);
    });
}

startServer();
