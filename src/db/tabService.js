import { db } from './database';
import { normalizeText } from '../utils/chordParser';

/**
 * 吉他谱服务 - 提供 CRUD 操作
 */
export const tabService = {
    /**
     * 添加新的吉他谱
     * @param {Object} tabData - 吉他谱数据
     * @returns {Promise<number>} 新增记录的 ID
     */
    async add(tabData) {
        const now = Date.now();
        return await db.tabs.add({
            ...tabData,
            // 归一化标题和内容用于搜索
            normalizedTitle: normalizeText(tabData.title || ''),
            normalizedArtist: normalizeText(tabData.artist || ''),
            normalizedContent: normalizeText(tabData.content),
            isFavorite: tabData.isFavorite || false,
            tags: tabData.tags || [],
            note: tabData.note || '',
            lastOpenedAt: now,
            createdAt: now,
            updatedAt: now
        });
    },

    /**
     * 更新吉他谱
     * @param {number} id - 吉他谱 ID
     * @param {Object} updates - 更新的字段
     */
    async update(id, updates) {
        const updateData = { ...updates, updatedAt: Date.now() };
        // 如果内容变了，重新归一化
        if (updates.content) {
            updateData.normalizedContent = normalizeText(updates.content);
        }
        return await db.tabs.update(id, updateData);
    },

    /**
     * 删除吉他谱
     * @param {number} id - 吉他谱 ID
     */
    async delete(id) {
        return await db.tabs.delete(id);
    },

    /**
     * 获取单个吉他谱并更新最后打开时间
     * @param {number} id - 吉他谱 ID
     */
    async getById(id) {
        const tab = await db.tabs.get(id);
        if (tab) {
            // 更新最后打开时间
            await db.tabs.update(id, { lastOpenedAt: Date.now() });
        }
        return tab;
    },

    /**
     * 获取最近打开的吉他谱
     * @param {number} limit - 返回数量限制
     */
    async getRecent(limit = 10) {
        return await db.tabs
            .orderBy('lastOpenedAt')
            .reverse()
            .limit(limit)
            .toArray();
    },

    /**
     * 获取所有收藏的吉他谱
     */
    async getFavorites() {
        // 使用 filter 因为 isFavorite 存储为 boolean
        const allTabs = await db.tabs.toArray();
        return allTabs.filter(tab => tab.isFavorite === true);
    },

    /**
     * 切换收藏状态
     * @param {number} id - 吉他谱 ID
     */
    async toggleFavorite(id) {
        const tab = await db.tabs.get(id);
        if (tab) {
            await db.tabs.update(id, { isFavorite: !tab.isFavorite });
            return !tab.isFavorite;
        }
        return false;
    },

    /**
     * 搜索吉他谱（在归一化内容和标题中搜索）
     * @param {string} query - 搜索关键词
     */
    async search(query) {
        if (!query.trim()) {
            return await this.getRecent(20);
        }
        const normalizedQuery = normalizeText(query);
        const allTabs = await db.tabs.toArray();

        console.log('搜索关键词:', normalizedQuery);
        console.log('数据库中的谱:', allTabs.map(t => ({ title: t.title, normalizedTitle: t.normalizedTitle })));

        // 在归一化的标题、艺术家、内容中模糊搜索
        return allTabs.filter(tab => {
            const searchFields = [
                tab.normalizedTitle || tab.title?.toLowerCase() || '',
                tab.normalizedArtist || tab.artist?.toLowerCase() || '',
                tab.normalizedContent || '',
                // 也搜索原始标签
                ...(tab.tags || [])
            ].join(' ').toLowerCase();
            return searchFields.includes(normalizedQuery);
        });
    },

    /**
     * 获取所有吉他谱
     */
    async getAll() {
        return await db.tabs.orderBy('updatedAt').reverse().toArray();
    }
};

/**
 * 用户设置服务
 */
export const settingsService = {
    /**
     * 获取设置值
     * @param {string} key - 设置键名
     * @param {*} defaultValue - 默认值
     */
    async get(key, defaultValue = null) {
        const setting = await db.settings.get(key);
        return setting ? setting.value : defaultValue;
    },

    /**
     * 保存设置
     * @param {string} key - 设置键名
     * @param {*} value - 设置值
     */
    async set(key, value) {
        return await db.settings.put({ key, value });
    }
};
