/**
 * 搜索聚合 API - 指弹谱资产聚合器
 * 调用 Google Custom Search API，返回标注格式类型的结果
 */

import { getSiteConfig, getSitePriority, detectFormat, TabFormat } from './lib/siteConfig.js';

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
 * 针对指弹谱搜索优化
 */
function buildSearchQuery(q) {
    const trimmed = q.trim();
    if (hasJapanese(trimmed)) {
        // 日文：指弹相关关键词
        return `${trimmed} 指弾き ソロギター TAB`;
    } else {
        // 英文/其他：fingerstyle + tab
        return `${trimmed} fingerstyle tab`;
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
        return res.status(400).json({ error: '请输入搜索关键词' });
    }

    try {
        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;

        if (!apiKey || !cx) {
            return res.status(500).json({ error: 'Missing API configuration' });
        }

        // 构建搜索关键词
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
            const format = detectFormat(url, item.title);
            const siteConfig = getSiteConfig(url);

            // 从标题提取歌名和艺术家
            const { title, artist } = extractTitleArtist(item.title);

            // 计算排序分数
            const score = calculateScore(host, format, siteConfig);

            return {
                title,
                artist,
                format,
                source: host,
                url,
                score,
                // 显示信息
                isYouTube: host.includes('youtube'),
                snippet: item.snippet?.substring(0, 100) || ''
            };
        });

        // 按分数排序（高分在前）
        results.sort((a, b) => b.score - a.score);

        // 移除分数字段
        const cleanResults = results.map(({ score, ...rest }) => rest);

        return res.status(200).json({ results: cleanResults });

    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: '搜索出错，请稍后重试' });
    }
}

/**
 * 从标题提取歌名和艺术家
 */
function extractTitleArtist(rawTitle) {
    const cleanText = (text) => {
        if (!text) return '';
        return text
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    let title = cleanText(rawTitle);
    let artist = '';

    // 移除站点名称
    title = title.replace(/\s*[-–|]\s*(YouTube|Guitar|Tab|TAB|ギター|指弾き|ソロギター).*$/i, '');

    // 日文格式: 歌名（艺术家）
    const jpMatch = title.match(/^(.+?)（(.+?)）/);
    if (jpMatch) {
        title = cleanText(jpMatch[1]);
        artist = cleanText(jpMatch[2]);
        return { title, artist };
    }

    // 英文格式: "by Artist"
    const byMatch = title.match(/(.+?)\s+by\s+(.+)/i);
    if (byMatch) {
        title = cleanText(byMatch[1]);
        artist = cleanText(byMatch[2]);
        return { title, artist };
    }

    // 格式: "Artist - Song"
    const dashMatch = title.match(/(.+?)\s*[-–]\s*(.+)/);
    if (dashMatch) {
        artist = cleanText(dashMatch[1]);
        title = cleanText(dashMatch[2]);
    }

    // 清理标题中的类型标记
    title = title.replace(/\s*(fingerstyle|tab|tabs|guitar|acoustic|指弾き|ソロギター|TAB)\s*/gi, ' ').trim();

    return { title: cleanText(title), artist: cleanText(artist) };
}

/**
 * 计算排序分数
 */
function calculateScore(host, format, siteConfig) {
    let score = 0;

    // 1. 站点优先级（最高权重）
    score += siteConfig?.priority || 0;

    // 2. 格式加成
    switch (format) {
        case TabFormat.GP:
            score += 30; // Guitar Pro 最高质量
            break;
        case TabFormat.PDF:
            score += 25;
            break;
        case TabFormat.HTML:
            score += 20;
            break;
        case TabFormat.VIDEO:
            score += 15; // 视频需要手动查看description
            break;
    }

    // 3. YouTube 特殊处理（指弹作者首发地）
    if (host.includes('youtube')) {
        score += 20;
    }

    return score;
}
