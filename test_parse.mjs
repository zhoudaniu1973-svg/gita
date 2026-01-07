/**
 * 测试解析器脚本 - 检查各个站点的 HTML 结构
 */
import fs from 'fs';

// 读取 ufret_dump.html 分析结构
const html = fs.readFileSync('ufret_dump.html', 'utf8');

console.log('=== U-Fret HTML 分析 ===');
console.log('长度:', html.length);
console.log('包含 chord_area:', html.includes('chord_area'));
console.log('包含 hiragana:', html.includes('hiragana'));
console.log('包含 furigana:', html.includes('furigana'));

// 查找和弦相关的 DOM 结构
const chordMatch = html.match(/id="[^"]*chord[^"]*"/gi);
console.log('Chord IDs:', chordMatch?.slice(0, 5));

const classMatch = html.match(/class="[^"]*rubychord[^"]*"/gi);
console.log('RubyChord classes:', classMatch?.slice(0, 3));

// 提取一小段和弦内容试试
const sampleMatch = html.match(/<ruby[^>]*>[\s\S]*?<\/ruby>/gi);
console.log('\n和弦 Ruby 标签数量:', sampleMatch?.length);
if (sampleMatch) {
    console.log('示例:', sampleMatch.slice(0, 3));
}

// 检查是否有 JSON 数据
const jsonMatch = html.match(/window\.__NUXT__|window\.__DATA__|const\s+chordData/gi);
console.log('\n内嵌 JSON:', jsonMatch);
