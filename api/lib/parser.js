/**
 * 谱面解析器 - 从 HTML 提取吉他谱文本
 * 支持多站点规则，识别谱类型和元信息
 * 
 * 注意：指弹谱资产聚合器主要使用 redirect 模式
 * 大部分站点不再需要服务端解析
 */

import { getSiteConfig, ParseMode } from './siteConfig.js';

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
 * 策略：<tt> + <pre> 双解析，选最长的候选文本块
 */
function parseJTotal(html) {
    let title = '';
    let artist = '';

    // 提取标题
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        const parts = titleMatch[1].split(/[-–]/);
        title = parts[0]?.trim() || '';
        artist = parts[1]?.trim() || '';
    }

    // 从更精确的位置提取标题和艺术家
    // J-Total 格式通常是: 歌名（艺术家） / コード譜 / ギター
    const titleParts = (titleMatch?.[1] || '').split(/[\/|]/);
    if (titleParts.length >= 1) {
        const mainPart = titleParts[0].trim();
        // 匹配 "歌名（艺术家）" 格式
        const parenMatch = mainPart.match(/^(.+?)（(.+?)）$/);
        if (parenMatch) {
            title = parenMatch[1].trim();
            artist = parenMatch[2].trim();
        } else {
            title = mainPart;
        }
    }

    // 收集所有候选文本块
    const candidates = [];

    // 方法1: 从 <tt> 标签提取（J-Total 主要使用这个）
    const ttMatches = html.match(/<tt\b[^>]*>([\s\S]*?)<\/tt>/gi) || [];
    for (const block of ttMatches) {
        const m = block.match(/<tt\b[^>]*>([\s\S]*?)<\/tt>/i);
        if (m?.[1]) {
            candidates.push(htmlToTextBlock(m[1]));
        }
    }

    // 方法2: 从 <pre> 标签提取（兜底）
    const preMatches = html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi) || [];
    for (const block of preMatches) {
        const m = block.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);
        if (m?.[1]) {
            candidates.push(htmlToTextBlock(m[1]));
        }
    }

    // 选择最长且足够长的文本块（至少 200 字符）
    const content = candidates
        .map(t => t.trim())
        .filter(t => t.length >= 200)
        .sort((a, b) => b.length - a.length)[0] || '';

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: detectTabType(content),
        content: content.trim(),
        capo: extractCapo(html),
        key: extractKey(content),
        parseable: content.length > 50,
        source: 'j-total.net'
    };
}

/**
 * HTML 片段转纯文本块（用于 J-Total 解析）
 * br -> 换行，去标签，解实体，压缩空行
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

    // 压缩空行
    s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return s;
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
 * 策略：从 <script> 标签扫描提取 ChordPro 格式数据（[Am]歌詞[G]歌詞）
 * 不依赖具体变量名，只寻找包含和弦标记的字符串
 */
function parseUFret(html) {
    let title = '';
    let artist = '';

    // 从 title 标签提取标题和艺术家
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        // U-Fret 格式: "歌名 / 艺术家 ギターコード/ウクレレコード/ピアノコード - U-フレット"
        const parts = titleMatch[1].split(/[\/|]/);
        title = parts[0]?.trim() || '';
        if (parts[1]) {
            artist = parts[1].trim()
                .replace(/ギター.*$/i, '')
                .replace(/U-?FRET.*$/i, '')
                .replace(/コード.*$/i, '')
                .trim();
        }
    }

    // 从 h1 提取更精确的标题
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
        title = stripHtml(h1Match[1]);
    }

    // 从 script 标签中提取 ChordPro 格式的和弦数据
    const content = extractChordProFromScripts(html);

    if (!content || content.length < 100) {
        // 如果从 script 提取失败，尝试通用解析器
        return parseGeneric(html);
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: TabType.CHORD,
        content: content.trim(),
        capo: extractCapo(html),
        key: extractKey(content),
        parseable: content.length > 50,
        source: 'ufret.jp'
    };
}

/**
 * 从 script 标签中提取 ChordPro 格式的和弦数据
 * 策略：扫描所有 script 内容，寻找包含和弦标记 [A-G] 的字符串
 */
function extractChordProFromScripts(html) {
    // 取所有 script 内容
    const scripts = [];
    html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, body) => {
        if (body && body.length > 50) scripts.push(body);
        return _;
    });

    // 收集包含和弦标记的字符串
    const chunks = [];

    for (const sc of scripts) {
        // 提取双引号字符串（避免 eval）
        const strMatches = sc.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g) || [];
        for (const raw of strMatches) {
            const inner = raw.slice(1, -1); // 去掉外层引号
            const s = unescapeJsString(inner);
            if (s.length < 20) continue;
            if (looksLikeChordLine(s)) chunks.push(s);
        }
    }

    // 去重并按长度排序
    const uniqueChunks = [...new Set(chunks)];

    // 聚合：取最长的若干条拼起来
    const text = uniqueChunks
        .sort((a, b) => b.length - a.length)
        .slice(0, 200)         // 防止把页面所有脚本字符串都吞进来
        .reverse()             // 让顺序更接近原数组
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return text;
}

/**
 * 反转义 JavaScript 字符串中的常见转义序列
 * 包括 Unicode 转义 \uXXXX
 */
function unescapeJsString(s) {
    return s
        // 先处理 Unicode 转义 \uXXXX
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
}

/**
 * 判断字符串是否像和弦行
 * 粗判断：包含 [C] / [Am] / [F#] / [G/B] 这类和弦标记
 */
function looksLikeChordLine(s) {
    // 匹配常见和弦格式: [C], [Am], [F#], [Dm7], [G/B], [Cadd9] 等
    return /\[[A-G](?:#|b)?(?:m|maj7?|m7|7|sus[24]?|dim|aug|add9?|M7)?(?:\/[A-G](?:#|b)?)?\]/.test(s);
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
export { getSiteConfig, getSitePriority } from './siteConfig.js';
