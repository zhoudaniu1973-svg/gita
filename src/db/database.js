import Dexie from 'dexie';

/**
 * IndexedDB 数据库实例
 * 用于存储指弹谱资产和用户设置
 */
export const db = new Dexie('GuitarTabDB');

// 定义数据库表结构 - v2 新增 format 字段
db.version(2).stores({
    // 谱资产表：主键 id 自增，索引字段用于搜索和排序
    tabs: '++id, title, artist, format, isFavorite, lastOpenedAt, createdAt, *tags',
    // 用户设置表：key 为主键
    settings: 'key'
}).upgrade(tx => {
    // 迁移：为旧数据添加默认 format
    return tx.table('tabs').toCollection().modify(tab => {
        if (!tab.format) {
            tab.format = 'html';
        }
    });
});

/**
 * 谱资产数据模型
 * @typedef {Object} Tab
 * @property {number} id - 自增主键
 * @property {string} title - 标题
 * @property {string} [artist] - 艺术家（可选）
 * @property {string} format - 格式类型 (html/pdf/gp/video)
 * @property {string} content - 原始内容（HTML Tab 文本）
 * @property {string} [sourceUrl] - 原始来源URL
 * @property {string[]} tags - 标签数组
 * @property {string} note - 备注
 * @property {boolean} isFavorite - 是否收藏
 * @property {number} lastOpenedAt - 最后打开时间戳
 * @property {number} createdAt - 创建时间戳
 * @property {number} updatedAt - 更新时间戳
 */

