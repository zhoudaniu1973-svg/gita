import { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from '../db/tabService';

/**
 * 设置 Context - 管理全局用户偏好
 * 包括：夜间模式、字号大小
 */

// 字号选项
export const FONT_SIZES = ['small', 'medium', 'large', 'xlarge'];

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
    // 夜间模式状态（默认开启）
    const [isDarkMode, setIsDarkMode] = useState(true);
    // 字号大小
    const [fontSize, setFontSize] = useState('medium');
    // 加载状态
    const [isLoaded, setIsLoaded] = useState(false);

    // 初始化时从 IndexedDB 加载设置
    useEffect(() => {
        async function loadSettings() {
            try {
                const savedDarkMode = await settingsService.get('darkMode', true);
                const savedFontSize = await settingsService.get('fontSize', 'medium');
                setIsDarkMode(savedDarkMode);
                setFontSize(savedFontSize);
            } catch (error) {
                console.error('加载设置失败:', error);
            }
            setIsLoaded(true);
        }
        loadSettings();
    }, []);

    // 应用主题到 DOM
    useEffect(() => {
        if (isLoaded) {
            document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
            document.documentElement.setAttribute('data-font-size', fontSize);
        }
    }, [isDarkMode, fontSize, isLoaded]);

    // 切换夜间模式
    const toggleDarkMode = async () => {
        const newValue = !isDarkMode;
        setIsDarkMode(newValue);
        await settingsService.set('darkMode', newValue);
    };

    // 切换字号
    const cycleFontSize = async () => {
        const currentIndex = FONT_SIZES.indexOf(fontSize);
        const nextIndex = (currentIndex + 1) % FONT_SIZES.length;
        const newSize = FONT_SIZES[nextIndex];
        setFontSize(newSize);
        await settingsService.set('fontSize', newSize);
    };

    // 设置指定字号
    const setFontSizeValue = async (size) => {
        if (FONT_SIZES.includes(size)) {
            setFontSize(size);
            await settingsService.set('fontSize', size);
        }
    };

    const value = {
        isDarkMode,
        toggleDarkMode,
        fontSize,
        cycleFontSize,
        setFontSize: setFontSizeValue,
        isLoaded
    };

    // 等待设置加载完成后再渲染子组件
    if (!isLoaded) {
        return null;
    }

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

/**
 * 使用设置的 Hook
 */
export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings 必须在 SettingsProvider 内使用');
    }
    return context;
}
