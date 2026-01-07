/**
 * J-Total 独立测试
 */

async function testJTotal() {
    const url = 'https://music.j-total.net/data/038yo/019_yonezu_kenshi/005.html';

    console.log('Fetching J-Total...');
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('shift-jis');
    const html = decoder.decode(buffer);

    console.log('HTML length:', html.length);

    // 测试 <tt> 标签
    const ttMatches = html.match(/<tt\b[^>]*>([\s\S]*?)<\/tt>/gi) || [];
    console.log('<tt> tags found:', ttMatches.length);

    // 测试 <pre> 标签
    const preMatches = html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi) || [];
    console.log('<pre> tags found:', preMatches.length);

    if (ttMatches.length > 0) {
        const firstTt = ttMatches[0].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
        console.log('\nFirst <tt> content length:', firstTt.length);
        console.log('First 500 chars:', firstTt.substring(0, 500));
    }
}

testJTotal().catch(console.error);
