/**
 * 搜索聚合 API
 * 调用 Google Custom Search API，返回标注谱类型的结果
 */

import { inferTypeFromTitle, isParseable, TabType } from './lib/parser.js';

// 白名单站点（优先排序）
const TRUSTED_DOMAINS = [
    'ultimate-guitar.com',
    'music.j-total.net',
    'u-fret.com',
    'guitartabs.cc',
    'azchords.com',
    'chordie.com',
    'songsterr.com',
    'chordify.net'
];

export default async function handler(req, res) {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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

        // 调用 Google Custom Search API
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q + ' guitar tab OR guitar chords')}&num=10`;

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.error) {
            console.error('Google API error:', data.error);
            return res.status(500).json({ error: 'Search API error', details: data.error.message });
        }

        // 解析并排序结果
        const results = (data.items || []).map(item => {
            const url = item.link;
            const domain = new URL(url).hostname.replace('www.', '');
            const type = inferTypeFromTitle(item.title, item.snippet || '');
            const parseable = isParseable(url);

            // 从标题提取歌名和艺术家
            const { title, artist } = extractTitleArtist(item.title);

            // 提取关键信息（Capo、调性等）
            const info = extractInfo(item.snippet || '', type);

            return {
                title,
                artist,
                type,
                info,
                source: domain,
                url,
                parseable,
                // 用于排序的分数
                score: calculateScore(type, parseable, domain)
            };
        });

        // 按分数排序（高分在前）
        results.sort((a, b) => b.score - a.score);

        // 移除分数字段
        const cleanResults = results.map(({ score, ...rest }) => rest);

        return res.status(200).json({ results: cleanResults });

    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * 从标题提取歌名和艺术家
 */
function extractTitleArtist(rawTitle) {
    // 常见格式：
    // "Song Name by Artist - Site"
    // "Artist - Song Name Tab"
    // "Song Name Chords by Artist"

    let title = rawTitle;
    let artist = '';

    // 移除站点名称
    title = title.replace(/\s*[-–|]\s*(Ultimate Guitar|Songsterr|Chordify|Tabs|Tab|Chords?).*$/i, '');

    // 提取 "by Artist"
    const byMatch = title.match(/(.+?)\s+by\s+(.+)/i);
    if (byMatch) {
        title = byMatch[1].trim();
        artist = byMatch[2].trim();
    } else {
        // 尝试 "Artist - Song" 格式
        const dashMatch = title.match(/(.+?)\s*[-–]\s*(.+)/);
        if (dashMatch) {
            artist = dashMatch[1].trim();
            title = dashMatch[2].trim();
        }
    }

    // 清理标题中的类型标记
    title = title.replace(/\s*(chord|chords|tab|tabs|guitar|acoustic|fingerstyle)\s*/gi, ' ').trim();

    return { title, artist };
}

/**
 * 从摘要提取关键信息
 */
function extractInfo(snippet, type) {
    const parts = [];

    // 添加谱类型
    if (type !== TabType.UNKNOWN) {
        parts.push(type);
    }

    // 提取 Capo 信息
    const capoMatch = snippet.match(/capo[:\s]*(\d+)/i);
    if (capoMatch) {
        parts.push(`Capo ${capoMatch[1]}`);
    }

    // 提取调性
    const keyMatch = snippet.match(/key[:\s]*([A-G][#b]?m?)/i);
    if (keyMatch) {
        parts.push(keyMatch[1]);
    }

    return parts.join(' · ') || type;
}

/**
 * 计算排序分数
 */
function calculateScore(type, parseable, domain) {
    let score = 0;

    // 可解析性（最高权重）
    if (parseable) {
        score += 100;
    }

    // 谱类型
    switch (type) {
        case TabType.CHORD:
            score += 40;
            break;
        case TabType.FINGERSTYLE:
            score += 30;
            break;
        case TabType.TAB:
            score += 20;
            break;
        default:
            score += 0;
    }

    // 来源可信度
    const domainIndex = TRUSTED_DOMAINS.findIndex(d => domain.includes(d));
    if (domainIndex !== -1) {
        score += (TRUSTED_DOMAINS.length - domainIndex) * 5;
    }

    return score;
}
