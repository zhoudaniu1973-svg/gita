/**
 * 和弦解析与转调工具
 * 支持常见和弦格式：C, Cm, C7, Cmaj7, C#dim, G/B, F(add9) 等
 */

// 音符序列（用于转调计算）
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// 等价音符映射（将 Db 转为 C# 等）
const NOTE_ALIASES = {
    'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
    'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B',
    'E#': 'F', 'B#': 'C'
};

/**
 * 和弦正则表达式
 * 匹配格式：根音 + 可选修饰符 + 可选斜杠低音
 * 例如：C, Cm, Cmaj7, C#dim, G/B, F(add9), Am7/G
 */
const CHORD_REGEX = /\b([A-G][#b]?)(m|maj|min|dim|aug|sus|add|M)?(\d+)?(\([^)]*\))?(\/[A-G][#b]?)?\b/g;

/**
 * 归一化音符名称（将降号转为升号）
 * @param {string} note - 音符名称
 * @returns {string} 归一化后的音符
 */
function normalizeNote(note) {
    return NOTE_ALIASES[note] || note;
}

/**
 * 转调单个音符
 * @param {string} note - 原音符
 * @param {number} semitones - 半音数（正数升调，负数降调）
 * @returns {string} 转调后的音符
 */
function transposeNote(note, semitones) {
    const normalized = normalizeNote(note);
    const index = NOTES.indexOf(normalized);
    if (index === -1) return note; // 无法识别的音符，返回原值

    const newIndex = (index + semitones + NOTES.length * 12) % NOTES.length;
    return NOTES[newIndex];
}

/**
 * 转调单个和弦
 * @param {string} chord - 原和弦
 * @param {number} semitones - 半音数
 * @returns {string} 转调后的和弦
 */
export function transposeChord(chord, semitones) {
    if (semitones === 0) return chord;

    return chord.replace(CHORD_REGEX, (match, root, modifier = '', degree = '', parenthetical = '', bass = '') => {
        // 转调根音
        const newRoot = transposeNote(root, semitones);

        // 转调低音（如果有）
        let newBass = '';
        if (bass) {
            const bassNote = bass.substring(1); // 去掉 '/'
            newBass = '/' + transposeNote(bassNote, semitones);
        }

        return newRoot + modifier + degree + parenthetical + newBass;
    });
}

/**
 * 转调整行文本（只转调和弦，保留歌词）
 * @param {string} text - 包含和弦的文本
 * @param {number} semitones - 半音数
 * @returns {string} 转调后的文本
 */
export function transposeLine(text, semitones) {
    if (semitones === 0) return text;

    return text.replace(CHORD_REGEX, (match) => transposeChord(match, semitones));
}

/**
 * 解析文本中的和弦，返回和弦位置和内容
 * @param {string} text - 包含和弦的文本行
 * @returns {Array<{start: number, end: number, chord: string}>} 和弦位置数组
 */
export function parseChords(text) {
    const chords = [];
    let match;
    const regex = new RegExp(CHORD_REGEX.source, 'g');

    while ((match = regex.exec(text)) !== null) {
        chords.push({
            start: match.index,
            end: match.index + match[0].length,
            chord: match[0]
        });
    }

    return chords;
}

/**
 * 判断一行是否主要是和弦行（和弦占比高）
 * @param {string} line - 文本行
 * @returns {boolean} 是否为和弦行
 */
export function isChordLine(line) {
    if (!line.trim()) return false;

    const chords = parseChords(line);
    if (chords.length === 0) return false;

    // 计算和弦字符占比
    const chordChars = chords.reduce((sum, c) => sum + (c.end - c.start), 0);
    const nonSpaceChars = line.replace(/\s/g, '').length;

    // 如果和弦字符占非空白字符的 50% 以上，认为是和弦行
    return chordChars / nonSpaceChars > 0.5;
}

/**
 * 归一化文本（用于搜索）
 * - 转小写
 * - 去除多余空白
 * - 保留和弦 token（如 G/B）
 * @param {string} text - 原始文本
 * @returns {string} 归一化后的文本
 */
export function normalizeText(text) {
    if (!text) return '';

    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')  // 多个空白合并为单个空格
        .trim();
}

/**
 * 获取转调描述文本
 * @param {number} semitones - 半音数
 * @returns {string} 描述文本
 */
export function getTransposeLabel(semitones) {
    if (semitones === 0) return 'Original';
    const sign = semitones > 0 ? '+' : '';
    return `${sign}${semitones}`;
}
