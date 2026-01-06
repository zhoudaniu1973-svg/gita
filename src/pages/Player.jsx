import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tabService } from '../db/tabService';
import { useSettings, FONT_SIZES } from '../context/SettingsContext';
import ChordLine from '../components/ChordLine';
import { getTransposeLabel } from '../utils/chordParser';

/**
 * 演奏页面
 * 等宽显示吉他谱，支持和弦高亮、转调、字号调节
 */
export default function Player() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isDarkMode, toggleDarkMode, fontSize, cycleFontSize } = useSettings();

    const [tab, setTab] = useState(null);
    const [transpose, setTranspose] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);

    // 加载吉他谱
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
                // 吉他谱不存在，返回首页
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

    // 删除吉他谱
    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this tab?')) {
            try {
                await tabService.delete(parseInt(id));
                navigate('/');
            } catch (error) {
                console.error('删除失败:', error);
            }
        }
    };

    // 转调控制
    const handleTransposeUp = () => setTranspose(prev => prev + 1);
    const handleTransposeDown = () => setTranspose(prev => prev - 1);
    const handleTransposeReset = () => setTranspose(0);

    if (isLoading) {
        return (
            <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>Loading...</div>
            </div>
        );
    }

    if (!tab) {
        return null;
    }

    // 将内容按行分割
    const lines = tab.content.split('\n');

    return (
        <div className="page">
            {/* 头部 */}
            <header className="header">
                <Link to="/" className="btn-icon" title="Back">
                    ←
                </Link>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <h1 className="header-title" style={{ fontSize: '18px' }}>{tab.title}</h1>
                    {tab.artist && (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{tab.artist}</p>
                    )}
                </div>
                <button
                    className="btn-icon"
                    onClick={handleToggleFavorite}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
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

            {/* 吉他谱内容 */}
            <div className="tab-content mono fade-in">
                {lines.map((line, index) => (
                    <ChordLine key={index} line={line} transpose={transpose} />
                ))}
            </div>

            {/* 底部工具栏 */}
            <div className="toolbar">
                {/* 转调控制 */}
                <div className="toolbar-group">
                    <button className="btn-icon" onClick={handleTransposeDown} title="Transpose down">
                        ▼
                    </button>
                    <span
                        style={{
                            minWidth: '60px',
                            textAlign: 'center',
                            cursor: 'pointer'
                        }}
                        onClick={handleTransposeReset}
                        title="Reset transpose"
                    >
                        {getTransposeLabel(transpose)}
                    </span>
                    <button className="btn-icon" onClick={handleTransposeUp} title="Transpose up">
                        ▲
                    </button>
                </div>

                {/* 字号控制 */}
                <button
                    className="btn-icon"
                    onClick={cycleFontSize}
                    title={`Font size: ${fontSize}`}
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
                    title="Delete tab"
                    style={{ color: '#e63946' }}
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}
