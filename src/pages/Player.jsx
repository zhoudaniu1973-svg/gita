import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tabService } from '../db/tabService';
import { useSettings } from '../context/SettingsContext';

/**
 * 演奏页面 - 指弹谱查看器
 * 原样显示 Tab 谱，支持字号调节和收藏
 */
export default function Player() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isDarkMode, toggleDarkMode, fontSize, cycleFontSize } = useSettings();

    const [tab, setTab] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);

    // 加载谱资产
    useEffect(() => {
        loadTab();
    }, [id]);

    const loadTab = async () => {
        try {
            const data = await tabService.getById(parseInt(id));
            if (data) {
                setTab(data);
                setIsFavorite(data.isFavorite);
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error('加载失败:', error);
            navigate('/');
        } finally {
            setIsLoading(false);
        }
    };

    // 切换收藏状态
    const handleToggleFavorite = async () => {
        try {
            const newState = await tabService.toggleFavorite(parseInt(id));
            setIsFavorite(newState);
        } catch (error) {
            console.error('收藏操作失败:', error);
        }
    };

    // 删除谱资产
    const handleDelete = async () => {
        if (confirm('确定删除这个谱子吗？')) {
            try {
                await tabService.delete(parseInt(id));
                navigate('/');
            } catch (error) {
                console.error('删除失败:', error);
            }
        }
    };

    // 打开原链接
    const handleOpenSource = () => {
        if (tab?.sourceUrl) {
            window.open(tab.sourceUrl, '_blank');
        }
    };

    if (isLoading) {
        return (
            <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>加载中...</div>
            </div>
        );
    }

    if (!tab) {
        return null;
    }

    // 获取格式图标
    const formatIcon = getFormatIcon(tab.format);

    return (
        <div className="page">
            {/* 头部 */}
            <header className="header">
                <Link to="/" className="btn-icon" title="返回">
                    ←
                </Link>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <h1 className="header-title" style={{ fontSize: '18px' }}>
                        {formatIcon} {tab.title}
                    </h1>
                    {tab.artist && (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{tab.artist}</p>
                    )}
                </div>
                <button
                    className="btn-icon"
                    onClick={handleToggleFavorite}
                    title={isFavorite ? '取消收藏' : '收藏'}
                >
                    {isFavorite ? '⭐' : '☆'}
                </button>
            </header>

            {/* 备注 */}
            {tab.note && (
                <div style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    fontStyle: 'italic',
                    color: 'var(--text-muted)',
                    fontSize: '14px'
                }}>
                    📝 {tab.note}
                </div>
            )}

            {/* 谱内容 - 原样展示 */}
            <div className="tab-content mono fade-in">
                <pre style={{
                    fontFamily: 'monospace',
                    fontSize: fontSize === 'small' ? '12px' : fontSize === 'large' ? '18px' : '14px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    padding: '16px'
                }}>
                    {tab.content}
                </pre>
            </div>

            {/* 底部工具栏 */}
            <div className="toolbar">
                {/* 原链接按钮（如果有） */}
                {tab.sourceUrl && (
                    <button
                        className="btn-icon"
                        onClick={handleOpenSource}
                        title="查看原链接"
                    >
                        🔗
                    </button>
                )}

                {/* 字号控制 */}
                <button
                    className="btn-icon"
                    onClick={cycleFontSize}
                    title={`字号: ${fontSize}`}
                >
                    🔤
                </button>

                {/* 夜间模式 */}
                <button
                    className="btn-icon"
                    onClick={toggleDarkMode}
                    title={isDarkMode ? 'Light mode' : 'Dark mode'}
                >
                    {isDarkMode ? '☀️' : '🌙'}
                </button>

                {/* 删除按钮 */}
                <button
                    className="btn-icon"
                    onClick={handleDelete}
                    title="删除"
                    style={{ color: '#e63946' }}
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}

/**
 * 获取格式图标
 */
function getFormatIcon(format) {
    switch (format) {
        case 'pdf': return '📕';
        case 'gp': return '🎸';
        case 'video': return '🎬';
        case 'html': return '📄';
        default: return '📄';
    }
}
