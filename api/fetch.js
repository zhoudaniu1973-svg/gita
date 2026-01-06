/**
 * 网页抓取 API
 * 抓取目标 URL，解析并提取吉他谱文本
 */

import { parseTabFromHtml } from './lib/parser.js';

export default async function handler(req, res) {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL' });
    }

    // 验证 URL 格式
    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
        // 抓取网页
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8,zh;q=0.7'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch: ${response.statusText}`
            });
        }

        const html = await response.text();

        // 解析 HTML 提取吉他谱
        const result = parseTabFromHtml(html, url);

        if (!result.content || result.content.length < 50) {
            return res.status(200).json({
                ...result,
                parseable: false,
                error: 'Could not extract tab content from this page'
            });
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('Fetch error:', error);
        return res.status(500).json({
            error: 'Failed to fetch page',
            details: error.message
        });
    }
}
