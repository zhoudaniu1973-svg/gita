import Dexie from 'dexie';

/**
 * IndexedDB 数据库实例
 * 用于存储吉他谱和用户设置
 */
export const db = new Dexie('GuitarTabDB');

// 定义数据库表结构
db.version(1).stores({
    // 吉他谱表：主键 id 自增，索引字段用于搜索和排序
    tabs: '++id, title, artist, isFavorite, lastOpenedAt, createdAt, *tags',
    // 用户设置表：key 为主键
    settings: 'key'
});

/**
 * 吉他谱数据模型
 * @typedef {Object} Tab
 * @property {number} id - 自增主键
 * @property {string} title - 标题
 * @property {string} [artist] - 艺术家（可选）
 * @property {string} content - 原始内容（歌词+和弦）
 * @property {string} normalizedContent - 归一化内容（用于搜索）
 * @property {string[]} tags - 标签数组
 * @property {string} note - 备注
 * @property {boolean} isFavorite - 是否收藏
 * @property {number} lastOpenedAt - 最后打开时间戳
 * @property {number} createdAt - 创建时间戳
 * @property {number} updatedAt - 更新时间戳
 */
