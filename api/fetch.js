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
        const domain = new URL(url).hostname;

        // 针对日本站点使用更真实的请求头
        const isJapaneseSite = ['j-total.net', 'chordwiki.jpn.org', 'ufret.jp', 'gakufu.gakki.me']
            .some(d => domain.includes(d));

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': isJapaneseSite ? 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9,ja;q=0.8,zh;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        };

        // 抓取网页
        const response = await fetch(url, {
            headers,
            redirect: 'follow'
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch: ${response.statusText}`
            });
        }

        // 获取原始二进制数据以处理编码
        const buffer = await response.arrayBuffer();

        // 检测编码（日本站点常用 Shift-JIS 或 EUC-JP）
        let html = '';
        const contentType = response.headers.get('content-type') || '';

        // 从响应头检测编码
        let encoding = 'utf-8';
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

