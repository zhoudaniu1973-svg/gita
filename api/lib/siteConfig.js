/**
 * 站点配置表 - 指弹谱资产聚合器
 * 
 * 谱资产分类：
 * - HTML Tab：可轻解析的网页文本谱
 * - PDF：PDF格式谱（直接下载/查看）
 * - GP：Guitar Pro格式（.gp/.gpx/.gp5）
 * - Video：视频教程（通过description获取谱链接）
 */

/**
 * 解析模式枚举
 * - redirect: 仅跳转到原站（不做服务端抓取）
 * - server: 服务器端抓取（保留用于未来扩展）
 */
export const ParseMode = {
    SERVER: 'server',
    REDIRECT: 'redirect'
};

/**
 * 谱资产格式枚举
 */
export const TabFormat = {
    HTML: 'html',      // HTML文本Tab
    PDF: 'pdf',        // PDF谱
    GP: 'gp',          // Guitar Pro
    VIDEO: 'video',    // 视频（需手动从description获取）
    MIXED: 'mixed'     // 混合格式
};

/**
 * 站点配置表
 * 每个站点包含：
 * - parseMode: 解析模式
 * - format: 主要格式类型
 * - priority: 搜索排序优先级
 * - type: 内容类型（Fingerstyle）
 * - lang: 语言
 * - notes: 备注
 */
export const SITE_CONFIG = {
    // ========================
    // 日本指弹专门站
    // ========================
    'fingerstyle-guitar.jp': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.HTML,
        priority: 80,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: '指弹教学站，HTML Tab'
    },

    'guitarone.jp': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.MIXED,
        priority: 75,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: '吉他垂直社区，HTML/PDF混合'
    },

    'acousticguitarmagazine.jp': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.PDF,
        priority: 70,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: '原声吉他杂志，付费预览'
    },

    // ========================
    // 博客系统
    // ========================
    'tabguitar.blog.fc2.com': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.MIXED,
        priority: 60,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: 'FC2博客，HTML/PDF，外链可能失效'
    },

    'blog.fc2.com': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.MIXED,
        priority: 50,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: 'FC2博客通用，需筛选指弹内容'
    },

    // ========================
    // 初学者/教学站
    // ========================
    'guitar-beginner.net': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.HTML,
        priority: 55,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: '初学者站，HTML Tab'
    },

    // ========================
    // 艺术家官网（购买渠道）
    // ========================
    'yukimatsui.jp': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.PDF,
        priority: 40,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: '松井祐贵官网，付费谱链接'
    },

    'kotaro-oshio.com': {
        parseMode: ParseMode.REDIRECT,
        format: TabFormat.PDF,
        priority: 40,
        type: 'Fingerstyle',
        lang: 'ja',
        notes: '押尾コータロー官网，付费谱链接'
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

        // 子域名匹配
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
 * @param {string} url - 完整 URL
 * @returns {number} 优先级分数（0 表示未知站点）
 */
export function getSitePriority(url) {
    const config = getSiteConfig(url);
    return config?.priority || 0;
}

/**
 * 根据URL和标题推断谱格式
 * @param {string} url - 完整URL
 * @param {string} title - 页面标题
 * @returns {string} 格式类型
 */
export function detectFormat(url, title = '') {
    const lowerUrl = url.toLowerCase();
    const lowerTitle = title.toLowerCase();

    // 明确的文件扩展名
    if (lowerUrl.match(/\.pdf($|\?)/)) return TabFormat.PDF;
    if (lowerUrl.match(/\.gp[x5]?($|\?)/i)) return TabFormat.GP;

    // YouTube 视频
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
        return TabFormat.VIDEO;
    }

    // 标题关键词
    if (lowerTitle.includes('pdf')) return TabFormat.PDF;
    if (lowerTitle.match(/guitar\s*pro|\.gp[x5]?/i)) return TabFormat.GP;

    // 从站点配置获取
    const config = getSiteConfig(url);
    if (config?.format) {
        return config.format;
    }

    // 默认HTML
    return TabFormat.HTML;
}

/**
 * 获取格式显示图标
 * @param {string} format - 格式类型
 * @returns {string} emoji图标
 */
export function getFormatIcon(format) {
    switch (format) {
        case TabFormat.PDF: return '📕';
        case TabFormat.GP: return '🎸';
        case TabFormat.VIDEO: return '🎬';
        case TabFormat.HTML: return '📄';
        case TabFormat.MIXED: return '📦';
        default: return '📄';
    }
}

/**
 * 获取格式显示标签
 * @param {string} format - 格式类型
 * @returns {string} 显示标签
 */
export function getFormatLabel(format) {
    switch (format) {
        case TabFormat.PDF: return 'PDF';
        case TabFormat.GP: return 'Guitar Pro';
        case TabFormat.VIDEO: return '视频 (查看description)';
        case TabFormat.HTML: return 'Tab';
        case TabFormat.MIXED: return '混合格式';
        default: return 'Unknown';
    }
}
