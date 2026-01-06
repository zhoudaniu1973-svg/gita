/**
 * 谱面解析器 - 从 HTML 提取吉他谱文本
 * 支持多站点规则，识别谱类型和元信息
 */

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

    // 根据域名选择解析策略
    const parsers = {
        'ultimate-guitar.com': parseUltimateGuitar,
        'songsterr.com': parseSongsterr,
        'chordify.net': parseChordify,
        'music.j-total.net': parseJTotal,
        'u-fret.com': parseUFret,
        'guitartabs.cc': parseGuitarTabsCc,
    };

    const parser = parsers[domain] || parseGeneric;
    return parser(html, url);
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
 * U-Fret 解析器（日文站）
 */
function parseUFret(html) {
    let content = '';
    let title = '';
    let artist = '';

    // 提取标题和艺术家
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
        title = stripHtml(titleMatch[1]);
    }

    const artistMatch = html.match(/<p[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/p>/i);
    if (artistMatch) {
        artist = stripHtml(artistMatch[1]);
    }

    // U-Fret 的谱面在特定 div 中
    const chordMatch = html.match(/<div[^>]*class="[^"]*chord[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
    if (chordMatch) {
        content = chordMatch
            .map(c => stripHtml(c))
            .join('\n');
    }

    if (!content) {
        return parseGeneric(html);
    }

    return {
        title: title || 'Unknown',
        artist: artist || '',
        type: TabType.CHORD,
        content: content.trim(),
        capo: extractCapo(html),
        key: extractKey(content),
        parseable: content.length > 50
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
 * 判断 URL 是否可能可解析
 */
export function isParseable(url) {
    const parseableDomains = [
        'ultimate-guitar.com',
        'music.j-total.net',
        'u-fret.com',
        'guitartabs.cc',
        'azchords.com',
        'chordie.com'
    ];

    const domain = new URL(url).hostname.replace('www.', '');
    return parseableDomains.some(d => domain.includes(d));
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
