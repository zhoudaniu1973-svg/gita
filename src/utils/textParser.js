/**
 * 智能文本解析器
 * 从任意粘贴内容中提取并清洗吉他谱
 * 
 * 支持输入类型：
 * - 网页全文（带 HTML 标签）
 * - ChordPro 格式
 * - 纯文本和弦谱
 * - 六线谱 Tab
 */

/**
 * 主解析函数 - 从任意文本中提取吉他谱
 * @param {string} rawText - 用户粘贴的原始文本
 * @returns {Object} 解析结果
 */
export function parseRawText(rawText) {
    if (!rawText || !rawText.trim()) {
        return {
            title: '',
            artist: '',
            content: '',
            tags: [],
            type: 'Unknown',
            success: false
        };
    }

    // 第一步：剥离 HTML（如果存在）
    let text = stripHtml(rawText);

    // 第二步：尝试提取 ChordPro 元数据
    const chordProMeta = extractChordProMeta(text);

    // 第三步：猜测标题和艺术家
    let title = chordProMeta.title || guessTitle(text);
    let artist = chordProMeta.artist || guessArtist(text, title);

    // 第四步：清洗内容
    let content = cleanContent(text);

    // 第五步：检测类型
    const type = detectType(content);

    // 第六步：生成自动标签
    const tags = generateTags(content, type);

    return {
        title: title.trim(),
        artist: artist.trim(),
        content: content.trim(),
        tags,
        type,
        success: content.length > 20
    };
}

/**
 * 剥离 HTML 标签和无用元素
 */
function stripHtml(text) {
    return text
        // 移除 script 和 style 标签及其内容
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        // 移除 HTML 注释
        .replace(/<!--[\s\S]*?-->/g, '')
        // 将 <br> 转换为换行
        .replace(/<br\s*\/?>/gi, '\n')
        // 将 </p>, </div>, </tr> 等转换为换行
        .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
        // 移除所有其他 HTML 标签
        .replace(/<[^>]+>/g, '')
        // 转换 HTML 实体
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&copy;/g, '©')
        // 清理多余空白
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
}

/**
 * 提取 ChordPro 格式的元数据
 */
function extractChordProMeta(text) {
    let title = '';
    let artist = '';

    // {title: xxx} 或 {t: xxx}
    const titleMatch = text.match(/\{title:\s*(.+?)\}/i) || text.match(/\{t:\s*(.+?)\}/i);
    if (titleMatch) {
        title = titleMatch[1].trim();
    }

    // {artist: xxx} 或 {a: xxx}
    const artistMatch = text.match(/\{artist:\s*(.+?)\}/i) || text.match(/\{a:\s*(.+?)\}/i);
    if (artistMatch) {
        artist = artistMatch[1].trim();
    }

    return { title, artist };
}

/**
 * 猜测歌曲标题
 */
function guessTitle(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 策略1：查找常见的标题模式
    for (const line of lines.slice(0, 10)) {
        // "歌名 - 艺术家" 模式（最常见）
        const dashMatch = line.match(/^([^-–]+)\s*[-–]\s*([^-–]+)$/);
        if (dashMatch) {
            const part1 = dashMatch[1].trim();
            const part2 = dashMatch[2].trim();

            // 如果第二部分包含"吉他谱"、"和弦"等，取第一部分
            if (/和弦|吉他|コード|chord|tab|guitar/i.test(part2)) {
                return part1;
            }
            // 如果第一部分包含"吉他谱"等，取第二部分
            if (/和弦|吉他|コード|chord|tab|guitar/i.test(part1)) {
                return part2;
            }

            // 默认：第一部分是歌名（"Song - Artist" 是最常见格式）
            return part1;
        }

        // "Song by Artist" 模式
        const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);
        if (byMatch) {
            return byMatch[1].trim();
        }
    }

    // 策略2：使用第一个有意义的非空行
    for (const line of lines.slice(0, 5)) {
        // 跳过纯和弦行
        if (isChordOnlyLine(line)) continue;
        // 跳过六线谱行
        if (isTabLine(line)) continue;
        // 跳过太长的行（可能是歌词）
        if (line.length > 50) continue;
        // 跳过包含过多标点的行
        if ((line.match(/[,.!?;:]/g) || []).length > 3) continue;

        return line;
    }

    return '';
}

/**
 * 猜测艺术家
 */
function guessArtist(text, knownTitle) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 策略1：查找 "Artist - Song" 模式
    for (const line of lines.slice(0, 10)) {
        // 如果已知标题，尝试从同一行提取艺术家
        if (knownTitle && line.includes(knownTitle)) {
            const dashMatch = line.match(/^([^-–]+)\s*[-–]\s*([^-–]+)$/);
            if (dashMatch) {
                const part1 = dashMatch[1].trim();
                const part2 = dashMatch[2].trim();
                // 返回不是标题的那部分
                if (part1.includes(knownTitle) || part1 === knownTitle) {
                    return part2.replace(/和弦|吉他|コード|chord|tab/gi, '').trim();
                }
                if (part2.includes(knownTitle) || part2 === knownTitle) {
                    return part1;
                }
            }
        }

        // "Song by Artist" 模式
        const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);
        if (byMatch) {
            return byMatch[2].trim();
        }
    }

    // 策略2：查找日文格式 "歌：XXX"
    for (const line of lines.slice(0, 15)) {
        const singMatch = line.match(/歌[：:]\s*(.+)/);
        if (singMatch) {
            return singMatch[1].split(/[/,、]/)[0].trim();
        }
    }

    return '';
}

/**
 * 清洗内容，保留有意义的谱内容
 */
function cleanContent(text) {
    const lines = text.split('\n');
    const cleanedLines = [];
    let inContentSection = false;
    let emptyLineCount = 0;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // 跳过 ChordPro 指令行
        if (/^\{.*\}$/.test(line)) continue;

        // 跳过常见的导航/广告文字
        if (shouldSkipLine(line)) continue;

        // 检测是否进入谱内容区域
        if (!inContentSection) {
            if (isChordOnlyLine(line) || isTabLine(line) || hasInlineChords(line)) {
                inContentSection = true;
            }
        }

        // 处理空行
        if (line === '') {
            emptyLineCount++;
            // 最多保留2个连续空行
            if (emptyLineCount <= 2 && inContentSection) {
                cleanedLines.push('');
            }
            continue;
        }

        emptyLineCount = 0;

        // 如果在内容区域，或者这行看起来像谱内容
        if (inContentSection || isChordOnlyLine(line) || isTabLine(line) || hasInlineChords(line)) {
            inContentSection = true;
            cleanedLines.push(rawLine); // 保留原始缩进
        }
    }

    // 移除开头和结尾的空行
    while (cleanedLines.length > 0 && cleanedLines[0].trim() === '') {
        cleanedLines.shift();
    }
    while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
        cleanedLines.pop();
    }

    return cleanedLines.join('\n');
}

/**
 * 判断是否应该跳过这一行
 */
function shouldSkipLine(line) {
    const lowerLine = line.toLowerCase();
    const skipPatterns = [
        // 导航/链接
        /^(home|menu|search|login|sign up|register)/i,
        /click here/i,
        /はこちら/,
        /クリック/,
        // 广告/提示
        /advertisement/i,
        /sponsored/i,
        /プレミアム/,
        /行削除/,
        // 版权
        /copyright/i,
        /©/,
        /all rights reserved/i,
        /剽窃/,
        /禁止/,
        // 网站名称
        /ultimate-?guitar/i,
        /u-?fret/i,
        /j-total/i,
        /chordwiki/i,
        // 评论/评分
        /^\d+ (rating|comment|view)/i,
        /^★+/,
        // 太短且无意义
        /^ver\.?\s*\d*$/i
    ];

    return skipPatterns.some(pattern => pattern.test(line));
}

/**
 * 判断是否是纯和弦行
 */
function isChordOnlyLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // 移除所有和弦后，检查是否只剩空白
    const withoutChords = trimmed
        .replace(/\b[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|7|9|11|13)*\d*\b/g, '')
        .replace(/\s+/g, '');

    // 如果原文有和弦，且移除后几乎为空，则是纯和弦行
    const hasChords = /\b[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|7|9|11|13)*\d*\b/.test(trimmed);
    return hasChords && withoutChords.length < 5;
}

/**
 * 判断是否是六线谱行
 */
function isTabLine(line) {
    // e|---0---2---| 格式
    return /^[eEBGDA]\|[-0-9~hpbr\/\\()\s]+\|?$/.test(line.trim());
}

/**
 * 判断是否有行内和弦 [Am] 或行首和弦
 */
function hasInlineChords(line) {
    // ChordPro 格式 [Am]
    if (/\[[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|7|9|11|13)*\d*\]/.test(line)) {
        return true;
    }
    return false;
}

/**
 * 检测谱的类型
 */
function detectType(content) {
    if (!content) return 'Unknown';

    // 检测六线谱
    const tabLines = content.match(/^[eEBGDA]\|[-0-9~hpbr\/\\()\s]+\|?$/gm) || [];
    if (tabLines.length >= 6) {
        return 'Tab';
    }

    // 检测和弦谱
    const chordMatches = content.match(/\b[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|7|9|11|13)*\d*\b/g) || [];
    if (chordMatches.length >= 5) {
        return 'Chord';
    }

    // 检测 ChordPro 格式
    if (/\[[A-G][#b]?[^\]]*\]/.test(content)) {
        return 'Chord';
    }

    return 'Unknown';
}

/**
 * 生成自动标签
 */
function generateTags(content, type) {
    const tags = [];

    // 基于类型
    if (type === 'Tab') {
        tags.push('tab');
    } else if (type === 'Chord') {
        tags.push('chords');
    }

    // 检测风格
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('fingerstyle') || lowerContent.includes('指弾') || lowerContent.includes('ソロ')) {
        tags.push('fingerstyle');
    }
    if (lowerContent.includes('acoustic') || lowerContent.includes('アコギ')) {
        tags.push('acoustic');
    }
    if (lowerContent.includes('capo') || lowerContent.includes('カポ')) {
        tags.push('capo');
    }

    // 最多返回 2 个标签
    return tags.slice(0, 2);
}
