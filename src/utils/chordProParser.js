/**
 * ChordPro 格式解析器
 * ChordPro 格式使用 [Chord] 标记和弦，例如：
 * [Am]On a dark desert [E7]highway
 */

/**
 * 解析 ChordPro 格式文本
 * @param {string} text - ChordPro 格式文本
 * @returns {Object} 解析结果 { title, artist, content }
 */
export function parseChordPro(text) {
    const lines = text.split('\n');
    let title = '';
    let artist = '';
    const contentLines = [];

    for (const line of lines) {
        // 解析元数据指令
        const titleMatch = line.match(/\{title:\s*(.+)\}/i) || line.match(/\{t:\s*(.+)\}/i);
        const artistMatch = line.match(/\{artist:\s*(.+)\}/i) || line.match(/\{a:\s*(.+)\}/i);

        if (titleMatch) {
            title = titleMatch[1].trim();
        } else if (artistMatch) {
            artist = artistMatch[1].trim();
        } else if (!line.match(/^\{.*\}$/)) {
            // 非指令行，转换为普通格式
            contentLines.push(convertChordProLine(line));
        }
    }

    return {
        title,
        artist,
        content: contentLines.join('\n')
    };
}

/**
 * 将 ChordPro 行转换为普通格式（和弦在歌词上方）
 * @param {string} line - ChordPro 格式行
 * @returns {string} 转换后的两行（和弦行 + 歌词行）
 */
function convertChordProLine(line) {
    const chordRegex = /\[([^\]]+)\]/g;
    const chords = [];
    let lyrics = '';
    let lastIndex = 0;
    let match;

    while ((match = chordRegex.exec(line)) !== null) {
        // 添加和弦前的歌词
        lyrics += line.slice(lastIndex, match.index);

        // 记录和弦位置
        chords.push({
            chord: match[1],
            position: lyrics.length
        });

        lastIndex = match.index + match[0].length;
    }

    // 添加剩余歌词
    lyrics += line.slice(lastIndex);

    // 如果没有和弦，直接返回原行
    if (chords.length === 0) {
        return line;
    }

    // 构建和弦行
    let chordLine = '';
    let currentPos = 0;

    for (const { chord, position } of chords) {
        // 填充空格到和弦位置
        while (chordLine.length < position) {
            chordLine += ' ';
        }
        chordLine += chord;
    }

    return chordLine + '\n' + lyrics;
}

/**
 * 检测文本是否为 ChordPro 格式
 * @param {string} text - 待检测文本
 * @returns {boolean}
 */
export function isChordProFormat(text) {
    // 检查是否包含 [Chord] 格式或 {指令}
    return /\[[A-G][#b]?[^\]]*\]/.test(text) || /\{(title|artist|t|a):/i.test(text);
}
