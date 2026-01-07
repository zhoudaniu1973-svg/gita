/**
 * 深入分析 U-Fret HTML 结构
 */
import fs from 'fs';

const html = fs.readFileSync('ufret_dump.html', 'utf8');

console.log('=== 查找 my-chord-data 内容 ===');
const chordDataMatch = html.match(/id="my-chord-data"[^>]*>([\s\S]*?)<\/[^>]+>/i);
if (chordDataMatch) {
    console.log('找到 my-chord-data:', chordDataMatch[0].substring(0, 500));
}

console.log('\n=== 查找歌词+和弦内容 ===');
// U-Fret 通常把歌词放在 script 里动态渲染
const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
console.log('Script 标签数量:', scriptMatch?.length);

// 查找包含和弦数据的 script
const chordScripts = scriptMatch?.filter(s =>
    s.includes('chord') || s.includes('lyric') || s.includes('append_dom')
);
console.log('包含和弦的 script 数量:', chordScripts?.length);

if (chordScripts && chordScripts.length > 0) {
    // 找最可能的那个
    for (const script of chordScripts.slice(0, 3)) {
        if (script.includes('append_dom') || script.includes('hiragana')) {
            console.log('\n=== 和弦渲染脚本片段 ===');
            console.log(script.substring(0, 2000));
            break;
        }
    }
}

// 检查是否有纯文本歌词区域
console.log('\n=== 查找其他可能的内容区域 ===');
const divMatches = html.match(/<div[^>]*class="[^"]*(?:song|lyric|content)[^"]*"[^>]*>/gi);
console.log('Song/Lyric/Content div:', divMatches?.slice(0, 5));
