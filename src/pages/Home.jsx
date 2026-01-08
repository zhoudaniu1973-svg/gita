import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tabService } from '../db/tabService';
import TabCard from '../components/TabCard';
import { useSettings } from '../context/SettingsContext';

/**
 * 首页组件 - 指弹谱资产聚合器
 * 在线搜索 + 本地收藏
 */
export default function Home() {
    const navigate = useNavigate();
    const { isDarkMode, toggleDarkMode } = useSettings();

    const [searchQuery, setSearchQuery] = useState('');
    const [recentTabs, setRecentTabs] = useState([]);
    const [favoriteTabs, setFavoriteTabs] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // 加载本地数据
    useEffect(() => {
        loadTabs();
    }, []);

    const loadTabs = async () => {
        try {
            const recent = await tabService.getRecent(10);
            const favorites = await tabService.getFavorites();
            setRecentTabs(recent);
            setFavoriteTabs(favorites);
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    };

    // 执行在线搜索
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();

            if (data.error) {
                setError(data.error);
                setSearchResults([]);
            } else {
                setSearchResults(data.results || []);
            }
        } catch (err) {
            console.error('搜索失败:', err);
            setError('搜索失败，请检查网络连接');
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    // 回车触发搜索
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // 打开搜索结果（直接跳转到原站）
    const handleOpenResult = (result) => {
        window.open(result.url, '_blank');
    };

    // 清除搜索
    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        setError(null);
    };

    return (
        <div className="page">
            {/* 头部 */}
            <header className="header">
                <h1 className="header-title">🎸 GuitarTab</h1>
                <button
                    className="btn-icon"
                    onClick={toggleDarkMode}
                    title={isDarkMode ? 'Light mode' : 'Dark mode'}
                >
                    {isDarkMode ? '☀️' : '🌙'}
                </button>
            </header>

            <div className="container">
                {/* 搜索框 */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div className="search-box" style={{ flex: 1 }}>
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            className="input"
                            placeholder="搜索指弹谱（如：Ave Mujica）"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    {isSearching ? (
                        <button className="btn btn-secondary" onClick={handleClearSearch}>
                            ✕ 清除
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSearch} disabled={!searchQuery.trim()}>
                            🔍 搜索
                        </button>
                    )}
                    <Link to="/import" className="btn btn-secondary">
                        ➕
                    </Link>
                </div>

                {/* 搜索结果 */}
                {isSearching && (
                    <div className="fade-in">
                        {isLoading ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">⏳</div>
                                <p>搜索中...</p>
                            </div>
                        ) : error ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">❌</div>
                                <p>{error}</p>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className="list">
                                {searchResults.map((result, index) => (
                                    <SearchResultCard
                                        key={index}
                                        result={result}
                                        onOpen={() => handleOpenResult(result)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="empty-state">
                                    <div className="empty-state-icon">📭</div>
                                    <p>未找到结果</p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* 不搜索时显示本地数据 */}
                {!isSearching && (
                    <>
                        {/* 最近打开 */}
                        <div className="section-title">🕐 最近</div>
                        {recentTabs.length > 0 ? (
                            <div className="list">
                                {recentTabs.map(tab => (
                                    <TabCard key={tab.id} tab={tab} />
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">🎵</div>
                                <p>暂无谱子</p>
                                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                                    搜索在线谱或手动导入
                                </p>
                            </div>
                        )}

                        {/* 收藏列表 */}
                        {favoriteTabs.length > 0 && (
                            <>
                                <div className="section-title" style={{ marginTop: '32px' }}>⭐ 收藏</div>
                                <div className="list">
                                    {favoriteTabs.map(tab => (
                                        <TabCard key={tab.id} tab={tab} />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * 搜索结果卡片
 * 显示：歌名、歌手、格式图标、来源
 */
function SearchResultCard({ result, onOpen }) {
    const { title, artist, format, source, isYouTube, snippet } = result;

    // 格式图标和标签
    const formatInfo = getFormatInfo(format);

    return (
        <div
            className="card"
            onClick={onOpen}
            style={{ cursor: 'pointer' }}
        >
            {/* 第一行：歌名 + 格式图标 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '18px' }}>{formatInfo.icon}</span>
                <h3 className="card-title" style={{ margin: 0 }}>
                    {title || 'Unknown'}
                </h3>
            </div>

            {/* 第二行：歌手 */}
            {artist && (
                <p className="card-subtitle" style={{ marginBottom: '8px' }}>
                    {artist}
                </p>
            )}

            {/* 第三行：格式标签 + YouTube 提示 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                    className="tag"
                    style={{ backgroundColor: formatInfo.color }}
                >
                    {formatInfo.label}
                </span>
                {isYouTube && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        💡 查看视频描述获取谱子
                    </span>
                )}
            </div>

            {/* 第四行：来源 */}
            <p style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginTop: '4px'
            }}>
                {source}
            </p>

            {/* 摘要预览（仅非YouTube） */}
            {!isYouTube && snippet && (
                <p style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {snippet}
                </p>
            )}
        </div>
    );
}

/**
 * 获取格式显示信息
 */
function getFormatInfo(format) {
    switch (format) {
        case 'pdf':
            return { icon: '📕', label: 'PDF', color: '#e74c3c' };
        case 'gp':
            return { icon: '🎸', label: 'Guitar Pro', color: '#9b59b6' };
        case 'video':
            return { icon: '🎬', label: '视频', color: '#e67e22' };
        case 'html':
            return { icon: '📄', label: 'Tab', color: '#3498db' };
        case 'mixed':
            return { icon: '📦', label: '混合格式', color: '#27ae60' };
        default:
            return { icon: '📄', label: 'Tab', color: '#95a5a6' };
    }
}
