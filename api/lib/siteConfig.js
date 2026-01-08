/**
 * 站点配置表 - 日本吉他谱聚合器
 * 
 * 站点分类：
 * - 和弦谱站点（可解析）：U-Fret、J-Total
 * - 指弹谱站点（仅链接）：YouTube、博客
 */

/**
 * 解析模式枚举
 */
export const ParseMode = {
    SERVER: 'server',    // 服务器端直接抓取解析
    CLIENT: 'client',    // 客户端解析（浏览器端）
    REDIRECT: 'redirect' // 仅跳转
};

/**
 * 谱类型枚举
 */
export const TabType = {
    CHORD: 'Chord',           // 和弦谱
    FINGERSTYLE: 'Fingerstyle', // 指弹谱
    TAB: 'Tab',               // 六线谱
    UNKNOWN: 'Unknown'
};

/**
 * 站点配置表
 */
export const SITE_CONFIG = {
    // ========================
    // A 类：服务器端可解析
    // ========================
    'j-total.net': {
        parseMode: ParseMode.SERVER,
        priority: 100,
        type: TabType.CHORD,
        lang: 'ja',
        notes: '日文和弦谱主力源，抓取成功率极高'
    },

    // ========================
    // B 类：客户端解析
    // ========================
    'ufret.jp': {
        parseMode: ParseMode.CLIENT,
        priority: 90,
        type: TabType.CHORD,
        lang: 'ja',
        notes: 'JS 动态渲染，需客户端解析'
    },

    'chordwiki.jpn.org': {
        parseMode: ParseMode.CLIENT,
        priority: 85,
        type: TabType.CHORD,
        lang: 'ja',
        notes: 'Cloudflare 保护，需客户端解析'
    },

    // ========================
    // C 类：仅跳转
    // ========================
    'ultimate-guitar.com': {
        parseMode: ParseMode.REDIRECT,
        priority: 60,
        type: TabType.CHORD,
        lang: 'en',
        notes: 'Cloudflare 保护，仅跳转'
    },

    'songsterr.com': {
        parseMode: ParseMode.REDIRECT,
        priority: 40,
        type: TabType.TAB,
        lang: 'en',
        notes: 'Canvas 渲染，无法抓取'
    }
};

/**
 * 获取站点配置
 */
export function getSiteConfig(url) {
    try {
        const hostname = new URL(url).hostname.replace('www.', '');

        if (SITE_CONFIG[hostname]) {
            return { domain: hostname, ...SITE_CONFIG[hostname] };
        }

        for (const [domain, config] of Object.entries(SITE_CONFIG)) {
            if (hostname.endsWith(domain) || hostname.includes(domain)) {
                return { domain, ...config };
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 获取站点优先级分数
 */
export function getSitePriority(url) {
    const config = getSiteConfig(url);
    return config?.priority || 0;
}

/**
 * 判断是否可服务端解析
 */
export function isServerParseable(url) {
    const config = getSiteConfig(url);
    return config?.parseMode === ParseMode.SERVER;
}

/**
 * 判断是否可解析（服务端或客户端）
 */
export function isParseable(url) {
    const config = getSiteConfig(url);
    return config?.parseMode === ParseMode.SERVER || config?.parseMode === ParseMode.CLIENT;
}

/**
 * 谱子格式枚举
 */
export const TabFormat = {
    PDF: 'pdf',
    GP: 'gp',         // Guitar Pro
    HTML: 'html',     // 网页格式
    VIDEO: 'video',   // 视频教程
    MIXED: 'mixed',   // 混合格式
    UNKNOWN: 'unknown'
};

/**
 * 根据 URL 和标题检测谱子格式
 */
export function detectFormat(url, title = '') {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    // PDF 格式
    if (urlLower.includes('.pdf') || titleLower.includes('pdf')) {
        return TabFormat.PDF;
    }

    // Guitar Pro 格式
    if (urlLower.includes('.gp') || urlLower.includes('.gpx') ||
        urlLower.includes('.gp5') || urlLower.includes('.gtp') ||
        titleLower.includes('guitar pro') || titleLower.includes('gp tab')) {
        return TabFormat.GP;
    }

    // 视频格式（YouTube 等）
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') ||
        urlLower.includes('nicovideo.jp') || urlLower.includes('bilibili.com')) {
        return TabFormat.VIDEO;
    }

    // 网页谱站点
    if (urlLower.includes('ufret.jp') || urlLower.includes('j-total.net') ||
        urlLower.includes('chordwiki') || urlLower.includes('ultimate-guitar') ||
        urlLower.includes('songsterr')) {
        return TabFormat.HTML;
    }

    // 根据标题判断
    if (titleLower.includes('tab') || titleLower.includes('chord') ||
        titleLower.includes('コード') || titleLower.includes('タブ譜')) {
        return TabFormat.HTML;
    }

    return TabFormat.UNKNOWN;
}
