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
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Fetch failed: ${response.statusText}` });
        }

        const html = await response.text();
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

function isParseableDomain(domain) {
    const parseable = ['ultimate-guitar.com', 'music.j-total.net', 'u-fret.com', 'guitartabs.cc'];
    return parseable.some(d => domain.includes(d));
}

function calculateScore(type, parseable, domain) {
    let score = parseable ? 100 : 0;
    if (type === 'Chord') score += 40;
    else if (type === 'Fingerstyle') score += 30;
    else if (type === 'Tab') score += 20;

    const trusted = ['ultimate-guitar.com', 'music.j-total.net', 'u-fret.com'];
    const idx = trusted.findIndex(d => domain.includes(d));
    if (idx !== -1) score += (trusted.length - idx) * 5;

    return score;
}

function parseHtml(html, url) {
    const domain = new URL(url).hostname.replace('www.', '');

    // Ultimate Guitar 专用解析
    if (domain.includes('ultimate-guitar.com')) {
        return parseUltimateGuitar(html);
    }

    // J-Total Music / U-Fret 日文站点
    if (domain.includes('j-total.net') || domain.includes('u-fret.com')) {
        return parseJapaneseTab(html);
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
 * 日文站点解析器 (J-Total, U-Fret)
 */
function parseJapaneseTab(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 提取标题
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        const parts = titleMatch[1].split(/[-–]/);
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

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: detectType(content),
        content: content.trim(),
        capo: extractCapo(html),
        parseable: content.length > 50
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
