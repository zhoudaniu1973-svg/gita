import { parseChords, isChordLine, transposeLine } from '../utils/chordParser';

/**
 * 和弦行渲染组件
 * 支持和弦高亮和转调
 */
export default function ChordLine({ line, transpose = 0 }) {
    // 应用转调
    const displayLine = transpose !== 0 ? transposeLine(line, transpose) : line;

    // 判断是否为和弦行
    const isChord = isChordLine(displayLine);

    if (!isChord) {
        // 普通歌词行，直接返回
        return <div className="lyrics-line">{displayLine}</div>;
    }

    // 和弦行，高亮和弦
    const chords = parseChords(displayLine);

    if (chords.length === 0) {
        return <div className="chord-line">{displayLine}</div>;
    }

    // 构建高亮后的内容
    const parts = [];
    let lastIndex = 0;

    chords.forEach((chord, index) => {
        // 添加和弦前的普通文本
        if (chord.start > lastIndex) {
            parts.push(
                <span key={`text-${index}`}>
                    {displayLine.slice(lastIndex, chord.start)}
                </span>
            );
        }
        // 添加高亮的和弦
        parts.push(
            <span key={`chord-${index}`} className="chord">
                {chord.chord}
            </span>
        );
        lastIndex = chord.end;
    });

    // 添加剩余文本
    if (lastIndex < displayLine.length) {
        parts.push(
            <span key="text-end">{displayLine.slice(lastIndex)}</span>
        );
    }

    return <div className="chord-line">{parts}</div>;
}
