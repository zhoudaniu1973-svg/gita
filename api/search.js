/**
 * 搜索聚合 API
 * 调用 Google Custom Search API，返回标注谱类型的结果
 * 
 * 站点优先级（按可解析性分级）：
 * - 第一梯队：j-total.net, ufret.jp（可解析，最高权重）
 * - 第二梯队：chordwiki.jpn.org（需验证，仅跳转）
 * - 第三梯队：ultimate-guitar.com, songsterr.com（仅跳转）
 * 
 * 注意：确保 Google CSE 白名单包含日本站点 (j-total.net/*, ufret.jp/*)
 */

import { inferTypeFromTitle, isParseable, TabType, getSiteConfig, getSitePriority } from './lib/parser.js';
import { SITE_CONFIG, ParseMode } from './lib/siteConfig.js';

// 可解析域名优先级表（分数越高越靠前）
const PARSE_PRIORITY = {
    'j-total.net': 100,
    'ufret.jp': 90,
    'chordwiki.jpn.org': 10,      // 有真人验证：只做跳转
    'ultimate-guitar.com': 5,     // Cloudflare：只跳转
    'songsterr.com': 5
};

/**
 * 从 URL 提取主机名
 */
function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

/**
 * 检测 query 是否包含日文字符
 */
function hasJapanese(text) {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

/**
 * 构建搜索关键词
 * 日文输入：加 "コード" 或 "ギター"
 * 英文输入：加 "chords"
 */
function buildSearchQuery(q) {
    const trimmed = q.trim();
    if (hasJapanese(trimmed)) {
        // 日文：加日文关键词
        return `${trimmed} コード`;
    } else {
        // 英文/其他：加英文关键词
        return `${trimmed} guitar chords`;
    }
}

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

        // 构建搜索关键词（日文/英文自动适配）
        const searchQuery = buildSearchQuery(q);
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}&num=10`;

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.error) {
            console.error('Google API error:', data.error);
            return res.status(500).json({ error: 'Search API error', details: data.error.message });
        }

        // 解析结果
        const results = (data.items || []).map(item => {
            const url = item.link;
            const host = hostOf(url);
            const type = inferTypeFromTitle(item.title, item.snippet || '');
            const parseable = isParseable(url);

            // 从标题提取歌名和艺术家
            const { title, artist } = extractTitleArtist(item.title);

            // 提取关键信息
            const info = extractInfo(item.snippet || '', type);

            // 计算排序分数
            const score = calculateScore(host, type, parseable);

            return {
                title,
                artist,
                type,
                info,
                source: host,
                url,
                parseable,
                score
            };
        });

        // 按分数排序（高分在前 = 可解析优先）
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
    let title = rawTitle;
    let artist = '';

    // 移除站点名称
    title = title.replace(/\s*[-–|]\s*(Ultimate Guitar|Songsterr|Chordify|Tabs|Tab|Chords?|J-Total|U-?Fret).*$/i, '');

    // 日文格式: 歌名（艺术家）
    const jpMatch = title.match(/^(.+?)（(.+?)）/);
    if (jpMatch) {
        title = jpMatch[1].trim();
        artist = jpMatch[2].trim();
        return { title, artist };
    }

    // 英文格式: "by Artist"
    const byMatch = title.match(/(.+?)\s+by\s+(.+)/i);
    if (byMatch) {
        title = byMatch[1].trim();
        artist = byMatch[2].trim();
        return { title, artist };
    }

    // 格式: "Artist - Song"
    const dashMatch = title.match(/(.+?)\s*[-–]\s*(.+)/);
    if (dashMatch) {
        artist = dashMatch[1].trim();
        title = dashMatch[2].trim();
    }

    // 清理标题中的类型标记
    title = title.replace(/\s*(chord|chords|tab|tabs|guitar|acoustic|fingerstyle|コード|ギター)\s*/gi, ' ').trim();

    return { title, artist };
}

/**
 * 从摘要提取关键信息
 */
function extractInfo(snippet, type) {
    const parts = [];

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
 * 可解析域名优先级最高
 */
function calculateScore(host, type, parseable) {
    let score = 0;

    // 1. 域名优先级（最高权重）
    score += PARSE_PRIORITY[host] ?? 0;

    // 2. 可解析性加成
    if (parseable) {
        score += 50;
    }

    // 3. 谱类型加成
    switch (type) {
        case TabType.CHORD:
            score += 20;
            break;
        case TabType.FINGERSTYLE:
            score += 15;
            break;
        case TabType.TAB:
            score += 10;
            break;
    }

    return score;
}
