/**
 * 详细分析 U-Fret 的 my-chord-data 属性
 */
import fs from 'fs';

const html = fs.readFileSync('ufret_dump.html', 'utf8');

// 提取 my-chord-data 内容
const dataMatch = html.match(/id="my-chord-data"[^>]*data-content="([^"]*)"/i);
if (!dataMatch) {
    // 尝试其他格式
    const altMatch = html.match(/my-chord-data[^>]*>([^<]*)</i);
    console.log('Alternative match:', altMatch ? altMatch[1].substring(0, 500) : 'not found');
}

// 查找隐藏的 textarea 或 input 包含和弦数据
const textareaMatch = html.match(/<textarea[^>]*id="[^"]*chord[^"]*"[^>]*>([\s\S]*?)<\/textarea>/gi);
console.log('Chord textarea:', textareaMatch?.length);

const inputMatch = html.match(/<input[^>]*id="[^"]*chord[^"]*"[^>]*value="([^"]*)"/gi);
console.log('Chord input:', inputMatch?.length);

// 精确查找 my-chord-data 的上下文
const idx = html.indexOf('my-chord-data');
if (idx > 0) {
    console.log('\n=== my-chord-data 上下文 ===');
    console.log(html.substring(idx - 50, idx + 500));
}

// 查找任何包含和弦标记 [X] 的内容
const chordProMatch = html.match(/\[[A-G][#b]?[^\]]*\][^\[]{0,50}/g);
console.log('\n=== ChordPro 格式示例 ===');
console.log(chordProMatch?.slice(0, 20));
