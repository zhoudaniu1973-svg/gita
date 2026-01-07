/**
 * 测试 J-Total 解析
 */
import fs from 'fs';

const url = 'https://music.j-total.net/data/038yo/019_yonezu_kenshi/005.html';

console.log('Fetching J-Total...');

try {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja-JP,ja;q=0.9'
        }
    });

    // J-Total 使用 Shift-JIS 编码
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('shift-jis');
    const html = decoder.decode(buffer);

    console.log('长度:', html.length);
    console.log('包含 <tt>:', html.includes('<tt'));
    console.log('包含 <pre>:', html.includes('<pre'));

    // 提取 <tt> 内容
    const ttMatch = html.match(/<tt[^>]*>([\s\S]*?)<\/tt>/gi);
    console.log('\n<tt> 标签数量:', ttMatch?.length);

    if (ttMatch && ttMatch.length > 0) {
        console.log('\n=== 第一个 <tt> 内容 ===');
        console.log(ttMatch[0].substring(0, 1000));
    }

    // 保存到文件方便后续分析
    fs.writeFileSync('jtotal_dump.html', html);
    console.log('\n已保存到 jtotal_dump.html');

} catch (e) {
    console.error('Error:', e);
}
