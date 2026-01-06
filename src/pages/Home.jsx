import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tabService } from '../db/tabService';
import TabCard from '../components/TabCard';
import { useSettings } from '../context/SettingsContext';

/**
 * 首页组件
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
    const [importingUrl, setImportingUrl] = useState(null);

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

    // 导入搜索结果
    const handleImport = async (result) => {
        if (importingUrl) return; // 防止重复点击

        setImportingUrl(result.url);

        try {
            const res = await fetch('/api/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: result.url })
            });

            const data = await res.json();

            if (data.error || !data.content) {
                // 无法解析，跳转到原网页
                window.open(result.url, '_blank');
                return;
            }

            // 保存到本地数据库
            const id = await tabService.add({
                title: data.title || result.title,
                artist: data.artist || result.artist,
                content: data.content,
                tags: [result.type, result.source].filter(Boolean),
                note: data.capo ? `Capo ${data.capo}` : ''
            });

            // 跳转到播放页
            navigate(`/player/${id}`);

        } catch (err) {
            console.error('导入失败:', err);
            // 失败时跳转到原网页
            window.open(result.url, '_blank');
        } finally {
            setImportingUrl(null);
        }
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
                            placeholder="Search guitar tabs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    {isSearching ? (
                        <button className="btn btn-secondary" onClick={handleClearSearch}>
                            ✕ Clear
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSearch} disabled={!searchQuery.trim()}>
                            🔍 Search
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
                                <p>Searching...</p>
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
                                        onImport={() => handleImport(result)}
                                        isImporting={importingUrl === result.url}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">📭</div>
                                <p>No results found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 不搜索时显示本地数据 */}
                {!isSearching && (
                    <>
                        {/* 最近打开 */}
                        <div className="section-title">🕐 Recent</div>
                        {recentTabs.length > 0 ? (
                            <div className="list">
                                {recentTabs.map(tab => (
                                    <TabCard key={tab.id} tab={tab} />
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">🎵</div>
                                <p>No tabs yet</p>
                                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                                    Search online or import a tab
                                </p>
                            </div>
                        )}

                        {/* 收藏列表 */}
                        {favoriteTabs.length > 0 && (
                            <>
                                <div className="section-title" style={{ marginTop: '32px' }}>⭐ Favorites</div>
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
 * 显示：歌名、歌手、谱类型+关键信息、来源
 */
function SearchResultCard({ result, onImport, isImporting }) {
    const { title, artist, type, info, source, parseable } = result;

    return (
        <div
            className="card"
            onClick={onImport}
            style={{
                cursor: isImporting ? 'wait' : 'pointer',
                opacity: isImporting ? 0.7 : 1
            }}
        >
            {/* 第一行：歌名 */}
            <h3 className="card-title" style={{ marginBottom: '4px' }}>
                {title || 'Unknown'}
            </h3>

            {/* 第二行：歌手 */}
            {artist && (
                <p className="card-subtitle" style={{ marginBottom: '8px' }}>
                    {artist}
                </p>
            )}

            {/* 第三行：谱类型 + 关键信息 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                    className="tag"
                    style={{
                        backgroundColor: getTypeColor(type),
                        opacity: parseable ? 1 : 0.6
                    }}
                >
                    {info || type || 'Unknown'}
                </span>
                {parseable && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        ✓ 可导入
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

            {/* 导入中状态 */}
            {isImporting && (
                <p style={{
                    fontSize: '12px',
                    color: 'var(--accent-color)',
                    marginTop: '8px'
                }}>
                    ⏳ Importing...
                </p>
            )}
        </div>
    );
}

/**
 * 根据谱类型返回颜色
 */
function getTypeColor(type) {
    switch (type) {
        case 'Chord':
            return '#4a90d9';
        case 'Fingerstyle':
            return '#9b59b6';
        case 'Tab':
            return '#27ae60';
        default:
            return '#95a5a6';
    }
}
