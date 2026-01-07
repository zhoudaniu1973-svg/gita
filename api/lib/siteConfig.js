/**
 * 站点配置表 - 管理吉他谱站点的解析策略
 * 
 * 站点分三类：
 * A 类 (SERVER)：服务器端可解析，/api/fetch 可用
 * B 类 (CLIENT)：客户端可见，需用户触发浏览器端解析
 * C 类 (REDIRECT)：仅跳转，无法解析（图片/PDF/重度保护）
 */

/**
 * 解析模式枚举
 * - server: 服务器端直接抓取解析（后端 fetch + 正则）
 * - client: 客户端解析（用户浏览器打开 → 触发导入 → DOM 提取）
 * - redirect: 仅跳转到原站（无法解析）
 */
export const ParseMode = {
    SERVER: 'server',    // A 类：后端可抓
    CLIENT: 'client',    // B 类：前端可抓
    REDIRECT: 'redirect' // C 类：仅跳转
};

/**
 * 站点配置表
 * 每个站点包含：
 * - parseMode: 解析模式（决定用什么策略）
 * - priority: 搜索排序优先级（越高越优先显示）
 * - tier: 推荐梯队（1=强推, 2=可用, 3=仅跳转）
 * - type: 内容类型（Chord/Tab）
 * - lang: 语言
 * - notes: 备注
 */
export const SITE_CONFIG = {
    // ========================
    // A 类：服务器端可解析（/api/fetch 可用）
    // 纯文本和弦谱、无 Cloudflare、无 JS 渲染
    // ========================

    'j-total.net': {
        parseMode: ParseMode.SERVER,
        priority: 100,
        tier: 1,
        type: 'Chord',
        lang: 'ja',
        notes: '日文和弦谱主力源，<tt> 结构，抓取成功率极高'
    },

    'guitartabs.cc': {
        parseMode: ParseMode.SERVER,
        priority: 45,
        tier: 2,
        type: 'Tab',
        lang: 'en',
        notes: '英文 Tab 谱，通用解析器可用'
    },

    'azchords.com': {
        parseMode: ParseMode.SERVER,
        priority: 40,
        tier: 2,
        type: 'Chord',
        lang: 'en',
        notes: '英文和弦谱，通用解析器可用'
    },

    'chordie.com': {
        parseMode: ParseMode.SERVER,
        priority: 40,
        tier: 2,
        type: 'Chord',
        lang: 'en',
        notes: '英文和弦谱，通用解析器可用'
    },

    // ========================
    // B 类：客户端解析（浏览器打开 → 用户触发导入）
    // Cloudflare / JS 动态渲染 / 登录墙
    // ========================

    'chordwiki.jpn.org': {
        parseMode: ParseMode.CLIENT,
        priority: 90,
        tier: 2,
        type: 'Chord',
        lang: 'ja',
        notes: 'Cloudflare Turnstile 保护，需客户端解析'
    },

    'ufret.jp': {
        parseMode: ParseMode.CLIENT,
        priority: 70,
        tier: 2,
        type: 'Chord',
        lang: 'ja',
        notes: 'JS 动态渲染，需客户端解析'
    },

    'ultimate-guitar.com': {
        parseMode: ParseMode.CLIENT,
        priority: 60,
        tier: 2,
        type: 'Chord',
        lang: 'en',
        notes: 'Cloudflare 保护，需客户端解析'
    },

    // ========================
    // C 类：仅跳转（无法解析）
    // Canvas 渲染 / 图片谱 / 付费墙
    // ========================

    'songsterr.com': {
        parseMode: ParseMode.REDIRECT,
        priority: 40,
        tier: 3,
        type: 'Tab',
        lang: 'en',
        notes: 'Canvas 渲染交互谱，无法抓取'
    },

    'chordify.net': {
        parseMode: ParseMode.REDIRECT,
        priority: 30,
        tier: 3,
        type: 'Chord',
        lang: 'en',
        notes: '动态渲染 + 付费功能，无法抓取'
    },

    'gakufu.gakki.me': {
        parseMode: ParseMode.REDIRECT,
        priority: 20,
        tier: 3,
        type: 'Chord',
        lang: 'ja',
        notes: '图片谱为主，不稳定'
    }
};

/**
 * 获取站点配置
 * @param {string} url - 完整 URL
 * @returns {Object|null} 站点配置对象
 */
export function getSiteConfig(url) {
    try {
        const hostname = new URL(url).hostname.replace('www.', '');

        // 精确匹配
        if (SITE_CONFIG[hostname]) {
            return { domain: hostname, ...SITE_CONFIG[hostname] };
        }

        // 子域名匹配（如 music.j-total.net 匹配 j-total.net）
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
 * 判断是否可服务端解析
 * @param {string} url - 完整 URL
 * @returns {boolean}
 */
export function isServerParseable(url) {
    const config = getSiteConfig(url);
    return config?.parseMode === ParseMode.SERVER;
}

/**
 * 判断是否在白名单中
 * @param {string} url - 完整 URL
 * @returns {boolean}
 */
export function isInWhitelist(url) {
    return getSiteConfig(url) !== null;
}

/**
 * 获取站点优先级分数
 * @param {string} url - 完整 URL
 * @returns {number} 优先级分数（0 表示未知站点）
 */
export function getSitePriority(url) {
    const config = getSiteConfig(url);
    return config?.priority || 0;
}

/**
 * 获取推荐的白名单域名列表（仅 server 模式）
 * @returns {string[]}
 */
export function getServerDomains() {
    return Object.entries(SITE_CONFIG)
        .filter(([, config]) => config.parseMode === ParseMode.SERVER)
        .sort((a, b) => b[1].priority - a[1].priority)
        .map(([domain]) => domain);
}

/**
 * 获取按梯队分组的域名
 * @returns {Object} { tier1: [...], tier2: [...], tier3: [...] }
 */
export function getDomainsByTier() {
    const result = { tier1: [], tier2: [], tier3: [] };

    for (const [domain, config] of Object.entries(SITE_CONFIG)) {
        result[`tier${config.tier}`]?.push(domain);
    }

    return result;
}

/**
 * 导入成功的最低标准检查
 * - 能抽到 ≥ 20 行文本
 * - 和弦 token 出现率 > 5%
 * @param {string} content - 解析出的内容
 * @returns {Object} { valid: boolean, lines: number, chordRatio: number }
 */
export function validateContent(content) {
    if (!content) {
        return { valid: false, lines: 0, chordRatio: 0 };
    }

    const lines = content.split('\n').filter(line => line.trim()).length;

    // 和弦正则
    const chordRegex = /\b[A-G][#b]?(m|maj|min|dim|aug|sus|add|M)?[0-9]?(\([^)]*\))?(\/[A-G][#b]?)?\b/g;
    const chords = content.match(chordRegex) || [];
    const tokens = content.split(/\s+/).length;
    const chordRatio = tokens > 0 ? chords.length / tokens : 0;

    return {
        valid: lines >= 20 && chordRatio > 0.05,
        lines,
        chordRatio: Math.round(chordRatio * 100) / 100
    };
}

/**
 * 获取客户端解析的域名列表（B 类）
 * @returns {string[]}
 */
export function getClientDomains() {
    return Object.entries(SITE_CONFIG)
        .filter(([, config]) => config.parseMode === ParseMode.CLIENT)
        .sort((a, b) => b[1].priority - a[1].priority)
        .map(([domain]) => domain);
}

/**
 * 判断是否需要客户端解析
 * @param {string} url - 完整 URL
 * @returns {boolean}
 */
export function isClientParseable(url) {
    const config = getSiteConfig(url);
    return config?.parseMode === ParseMode.CLIENT;
}

/**
 * 获取站点的 UI 操作类型
 * @param {string} url - 完整 URL
 * @returns {'import'|'open_import'|'open'} 
 *   - import: 一键导入（server）
 *   - open_import: 打开并导入（client）
 *   - open: 打开原站（redirect）
 */
export function getActionType(url) {
    const config = getSiteConfig(url);
    if (!config) return 'open';

    switch (config.parseMode) {
        case ParseMode.SERVER: return 'import';
        case ParseMode.CLIENT: return 'open_import';
        case ParseMode.REDIRECT: return 'open';
        default: return 'open';
    }
}

// ========================
// 便捷导出
// ========================

// 服务器端可解析的站点（/api/fetch 可用）
export const SERVER_WHITELIST = [
    'j-total.net'
];

// 客户端可解析的站点（浏览器端导入）
export const CLIENT_WHITELIST = [
    'chordwiki.jpn.org',
    'ufret.jp',
    'ultimate-guitar.com'
];

// V1 版本支持导入的所有站点（server + client）
export const V1_WHITELIST = [
    ...SERVER_WHITELIST,
    ...CLIENT_WHITELIST
];
