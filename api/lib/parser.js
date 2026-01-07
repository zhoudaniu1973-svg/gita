/**
 * 谱面解析器 - 从 HTML 提取吉他谱文本
 * 支持多站点规则，识别谱类型和元信息
 * 
 * 解析策略按成功率分级：
 * - 第一梯队：j-total.net, chordwiki.jpn.org（服务端解析，最高权重）
 * - 第二梯队：ufret.jp（服务端解析，失败即降权）
 * - 第三梯队：ultimate-guitar.com, songsterr.com（仅跳转）
 */

import { getSiteConfig, ParseMode, validateContent } from './siteConfig.js';

/**
 * 谱类型枚举
 */
export const TabType = {
    CHORD: 'Chord',
    FINGERSTYLE: 'Fingerstyle',
    TAB: 'Tab',
    UNKNOWN: 'Unknown'
};

/**
 * 和弦正则 - 识别常见和弦格式
 */
const CHORD_REGEX = /\b[A-G][#b]?(m|maj|min|dim|aug|sus|add|M)?[0-9]?(\([^)]*\))?(\/[A-G][#b]?)?\b/g;

/**
 * 从 HTML 提取吉他谱文本
 * @param {string} html - 原始 HTML
 * @param {string} url - 来源 URL
 * @returns {Object} 解析结果
 */
export function parseTabFromHtml(html, url) {
    const domain = new URL(url).hostname.replace('www.', '');
    const siteConfig = getSiteConfig(url);

    // 如果是仅跳转模式，返回空结果
    if (siteConfig?.parseMode === ParseMode.REDIRECT) {
        return {
            title: extractTitleFromHtml(html),
            artist: '',
            type: TabType.UNKNOWN,
            content: '',
            capo: null,
            key: null,
            parseable: false,
            redirectOnly: true,
            message: '此站点需要在原网页查看'
        };
    }

    // 根据域名选择解析策略
    // 按成功率排序：第一梯队 > 第二梯队 > 通用
    const parsers = {
        // 第一梯队：强烈推荐
        'j-total.net': parseJTotal,
        'chordwiki.jpn.org': parseChordWiki,
        // 第二梯队：可用但要容错
        'ufret.jp': parseUFret,
        'gakufu.gakki.me': parseGeneric,
        // 英文站点
        'ultimate-guitar.com': parseUltimateGuitar,
        'songsterr.com': parseSongsterr,
        'chordify.net': parseChordify,
        'guitartabs.cc': parseGuitarTabsCc,
    };

    // 优先精确匹配
    let parser = parsers[domain];

    // 子域名匹配（如 music.j-total.net）
    if (!parser) {
        for (const [key, fn] of Object.entries(parsers)) {
            if (domain.includes(key)) {
                parser = fn;
                break;
            }
        }
    }

    const result = (parser || parseGeneric)(html, url);

    // 添加内容验证信息
    result.validation = validateContent(result.content);

    return result;
}

/**
 * 通用解析器 - 尝试从 <pre>、<code> 或 monospace 元素提取
 */
function parseGeneric(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 提取标题
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        const titleParts = titleMatch[1].split(/[-–|]/);
        title = titleParts[0]?.trim() || '';
        artist = titleParts[1]?.trim() || '';
    }

    // 优先从 <pre> 标签提取
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
    if (preMatch && preMatch.length > 0) {
        content = preMatch
            .map(p => p.replace(/<\/?pre[^>]*>/gi, ''))
            .map(p => stripHtml(p))
            .join('\n\n');
    }

    // 如果没有 <pre>，尝试 <code>
    if (!content) {
        const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/gi);
        if (codeMatch && codeMatch.length > 0) {
            content = codeMatch
                .map(c => c.replace(/<\/?code[^>]*>/gi, ''))
                .map(c => stripHtml(c))
                .join('\n\n');
        }
    }

    // 检测 ChordPro 格式
    if (content.includes('{title:') || /\[[A-G][#b]?[^\]]*\]/.test(content)) {
        // 是 ChordPro 格式，保持原样
    }

    const type = detectTabType(content);
    const capo = extractCapo(content + ' ' + html);
    const key = extractKey(content);

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type,
        content: content.trim(),
        capo,
        key,
        parseable: content.length > 50
    };
}

/**
 * Ultimate Guitar 解析器
 */
function parseUltimateGuitar(html) {
    let content = '';
    let title = '';
    let artist = '';

    // UG 使用 JSON 数据嵌入页面
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
    if (jsonMatch) {
        try {
            // 简化处理：直接从 HTML 提取
        } catch (e) {
            // JSON 解析失败，使用通用方法
        }
    }

    // 从 <pre> 提取
    const preMatch = html.match(/<pre[^>]*class="[^"]*tK8GG[^"]*"[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) {
        content = stripHtml(preMatch[1]);
    }

    // 提取标题
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
        title = stripHtml(titleMatch[1]);
    }

    // 提取艺术家
    const artistMatch = html.match(/by\s*<a[^>]*>([^<]+)<\/a>/i);
    if (artistMatch) {
        artist = stripHtml(artistMatch[1]);
    }

    // 如果上面没提取到，用通用方法
    if (!content) {
        return parseGeneric(html);
    }

    const type = detectTabType(content);
    const capo = extractCapo(html);
    const key = extractKey(content);

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type,
        content: content.trim(),
        capo,
        key,
        parseable: content.length > 50
    };
}

/**
 * Songsterr 解析器（通常需要 JavaScript 渲染，简化处理）
 */
function parseSongsterr(html) {
    // Songsterr 使用 Canvas 渲染，难以提取文本
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    let title = '';
    let artist = '';

    if (titleMatch) {
        const parts = titleMatch[1].split(/[-–]/);
        artist = parts[0]?.trim().replace(' Tab', '') || '';
        title = parts[1]?.trim() || '';
    }

    return {
        title,
        artist,
        type: TabType.TAB,
        content: '',
        capo: null,
        key: null,
        parseable: false // Songsterr 需要交互式查看
    };
}

/**
 * Chordify 解析器
 */
function parseChordify(html) {
    // Chordify 使用动态渲染
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    let title = '';
    let artist = '';

    if (titleMatch) {
        const parts = titleMatch[1].split(/[-–|]/);
        title = parts[0]?.trim() || '';
        artist = parts[1]?.replace('Chords', '').trim() || '';
    }

    return {
        title,
        artist,
        type: TabType.CHORD,
        content: '',
        capo: null,
        key: null,
        parseable: false
    };
}

/**
 * J-Total Music 解析器（日文站）
 */
function parseJTotal(html) {
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

    // J-Total 使用 <pre> 存放谱
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
    if (preMatch) {
        content = preMatch
            .map(p => stripHtml(p.replace(/<\/?pre[^>]*>/gi, '')))
            .join('\n\n');
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: detectTabType(content),
        content: content.trim(),
        capo: extractCapo(html),
        key: extractKey(content),
        parseable: content.length > 50
    };
}

/**
 * ChordWiki 解析器 (chordwiki.jpn.org)
 * 第一梯队站点 - 日文和弦谱 Wiki，DOM 稳定，文本清晰
 */
function parseChordWiki(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 提取标题（通常在 <title> 或 <h1>）
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        // ChordWiki 格式通常是 "歌名 - 艺术家 - ChordWiki" 或类似
        const parts = titleMatch[1].split(/[-–]/);
        title = parts[0]?.trim() || '';
        artist = parts[1]?.trim().replace(/ChordWiki.*$/i, '').trim() || '';
    }

    // 尝试从 <h1> 提取更精确的标题
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
        title = stripHtml(h1Match[1]);
    }

    // ChordWiki 的和弦谱通常在 <pre> 标签或特定 class 的 div 中
    // 方法1: 从 <pre> 提取
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
    if (preMatch && preMatch.length > 0) {
        content = preMatch
            .map(p => stripHtml(p.replace(/<\/?pre[^>]*>/gi, '')))
            .join('\n\n');
    }

    // 方法2: 如果没有 <pre>，尝试从 wiki 内容区域提取
    if (!content) {
        const wikiMatch = html.match(/<div[^>]*class="[^"]*(?:wiki|content|chord)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
        if (wikiMatch) {
            content = wikiMatch
                .map(w => stripHtml(w))
                .filter(text => {
                    // 过滤掉太短的内容
                    return text.split('\n').length > 5;
                })
                .join('\n\n');
        }
    }

    // 方法3: 提取所有看起来像和弦行的内容
    if (!content) {
        // 匹配包含和弦的行
        const lines = html.replace(/<br\s*\/?>/gi, '\n').split('\n');
        const chordLines = lines.filter(line => {
            const stripped = stripHtml(line);
            return /[A-G][#b]?(m|maj|min|dim|aug|sus)?[0-9]?/.test(stripped);
        });
        if (chordLines.length > 10) {
            content = chordLines.map(l => stripHtml(l)).join('\n');
        }
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: detectTabType(content) || TabType.CHORD, // 默认和弦谱
        content: content.trim(),
        capo: extractCapo(html),
        key: extractKey(content),
        parseable: content.length > 50,
        source: 'chordwiki.jpn.org'
    };
}

/**
 * U-Fret 解析器（日文站）
 * 第二梯队 - 新歌多，但广告多/DOM 易变，失败即降权
 */
function parseUFret(html) {
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
            // U-Fret 格式: "歌名 / 艺术家"
            const parts = pageTitleMatch[1].split(/[\/|]/);
            title = parts[0]?.trim() || '';
            if (!artist && parts[1]) {
                artist = parts[1].trim().replace(/U-?FRET.*$/i, '').trim();
            }
        }
    }

    // 提取艺术家
    const artistMatch = cleanHtml.match(/<p[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/p>/i);
    if (artistMatch) {
        artist = stripHtml(artistMatch[1]);
    }

    // 尝试从 a 标签提取艺术家
    if (!artist) {
        const artistLinkMatch = cleanHtml.match(/<a[^>]*href="[^"]*artist[^"]*"[^>]*>([^<]+)<\/a>/i);
        if (artistLinkMatch) {
            artist = stripHtml(artistLinkMatch[1]);
        }
    }

    // 方法1: 尝试从 #chord_area 或 .chord-area 提取
    const chordAreaMatch = cleanHtml.match(/<div[^>]*(?:id="chord_area"|class="[^"]*chord[-_]?area[^"]*")[^>]*>([\s\S]*?)<\/div>/i);
    if (chordAreaMatch) {
        content = stripHtml(chordAreaMatch[1]);
    }

    // 方法2: 从包含 .chord 的 div 提取（但过滤掉太短的）
    if (!content) {
        const chordDivs = cleanHtml.match(/<div[^>]*class="[^"]*chord[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || [];
        const validChords = chordDivs
            .map(div => stripHtml(div.replace(/<div[^>]*>/gi, '').replace(/<\/div>/gi, '')))
            .filter(text => {
                // 过滤掉看起来像 JS 代码的内容
                if (text.includes('function') || text.includes('var ') || text.includes('append_dom')) {
                    return false;
                }
                // 过滤掉太短的
                return text.length > 10;
            });

        if (validChords.length > 0) {
            content = validChords.join('\n');
        }
    }

    // 方法3: 从 <pre> 标签提取（如果有）
    if (!content) {
        const preMatch = cleanHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi);
        if (preMatch && preMatch.length > 0) {
            content = preMatch
                .map(p => stripHtml(p.replace(/<\/?pre[^>]*>/gi, '')))
                .filter(text => text.length > 20 && !text.includes('function'))
                .join('\n\n');
        }
    }

    // 方法4: 提取所有看起来像和弦行的内容
    if (!content) {
        const lines = cleanHtml.replace(/<br\s*\/?>/gi, '\n').split('\n');
        const chordLines = lines
            .map(line => stripHtml(line))
            .filter(line => {
                // 检查是否包含和弦
                const hasChord = /[A-G][#b]?(m|maj|min|dim|aug|sus)?[0-9]?/.test(line);
                // 过滤 JS 代码
                const isNotCode = !line.includes('function') && !line.includes('var ') && !line.includes('+=');
                return hasChord && isNotCode && line.length < 200;
            });

        if (chordLines.length > 10) {
            content = chordLines.join('\n');
        }
    }

    // 最终清理：移除任何残留的 JS 代码片段
    content = content
        .split('\n')
        .filter(line => {
            const trimmed = line.trim();
            // 过滤掉 JS 代码行
            if (trimmed.startsWith('var ') || trimmed.startsWith('let ') || trimmed.startsWith('const ')) return false;
            if (trimmed.includes('function(') || trimmed.includes('=>')) return false;
            if (trimmed.includes('append_dom') || trimmed.includes('document.')) return false;
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return false;
            return true;
        })
        .join('\n');

    if (!content || content.length < 30) {
        return parseGeneric(html);
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: TabType.CHORD,
        content: content.trim(),
        capo: extractCapo(cleanHtml),
        key: extractKey(content),
        parseable: content.length > 50,
        source: 'ufret.jp'
    };
}

/**
 * GuitarTabs.cc 解析器
 */
function parseGuitarTabsCc(html) {
    return parseGeneric(html);
}

/**
 * 检测谱类型
 */
function detectTabType(content) {
    if (!content) return TabType.UNKNOWN;

    // 检测 Tab 格式（数字 + 横线）
    const tabLineRegex = /[eEBGDA]\|[-0-9h/\\pbr~()\s]+\|/g;
    const tabLines = content.match(tabLineRegex);
    if (tabLines && tabLines.length >= 4) {
        // 检查是否为 Fingerstyle（复杂的 Tab）
        const hasComplexPatterns = content.includes('h') || content.includes('p') ||
            content.includes('/') || content.includes('\\');
        if (hasComplexPatterns && tabLines.length >= 10) {
            return TabType.FINGERSTYLE;
        }
        return TabType.TAB;
    }

    // 检测和弦格式
    const chords = content.match(CHORD_REGEX);
    if (chords && chords.length >= 3) {
        return TabType.CHORD;
    }

    return TabType.UNKNOWN;
}

/**
 * 提取 Capo 信息
 */
function extractCapo(text) {
    const capoMatch = text.match(/capo[:\s]*(\d+)/i);
    if (capoMatch) {
        return parseInt(capoMatch[1], 10);
    }
    return null;
}

/**
 * 提取调性信息
 */
function extractKey(content) {
    // 尝试从开头的和弦推断
    const firstChord = content.match(/^[A-G][#b]?(m|maj|min)?/m);
    if (firstChord) {
        return firstChord[0];
    }
    return null;
}

/**
 * 去除 HTML 标签
 */
function stripHtml(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

/**
 * 判断 URL 是否可服务端解析
 * 使用站点配置表进行判断
 */
export function isParseable(url) {
    const config = getSiteConfig(url);
    // 只有 server 模式的站点才返回 true
    return config?.parseMode === ParseMode.SERVER;
}

/**
 * 从 HTML 提取标题（简化版，用于 redirect 模式）
 */
function extractTitleFromHtml(html) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        return titleMatch[1].split(/[-–|]/)[0]?.trim() || 'Unknown';
    }
    return 'Unknown';
}

/**
 * 从搜索结果推断谱类型
 */
export function inferTypeFromTitle(title, snippet) {
    const text = (title + ' ' + snippet).toLowerCase();

    if (text.includes('fingerstyle') || text.includes('solo') || text.includes('instrumental')) {
        return TabType.FINGERSTYLE;
    }
    if (text.includes('tab') && !text.includes('chord')) {
        return TabType.TAB;
    }
    if (text.includes('chord') || text.includes('chords')) {
        return TabType.CHORD;
    }

    return TabType.UNKNOWN;
}

// 导出站点配置相关函数供外部使用
export { getSiteConfig, isServerParseable, getSitePriority, V1_WHITELIST } from './siteConfig.js';

