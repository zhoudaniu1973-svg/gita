import { Link } from 'react-router-dom';

/**
 * 吉他谱卡片组件
 * 显示吉他谱标题、艺术家、标签和备注
 */
export default function TabCard({ tab }) {
    const { id, title, artist, tags = [], note, isFavorite } = tab;

    return (
        <Link to={`/player/${id}`} className="card" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                    <h3 className="card-title">
                        {isFavorite && <span style={{ marginRight: '8px' }}>⭐</span>}
                        {title || 'Untitled'}
                    </h3>
                    {artist && <p className="card-subtitle">{artist}</p>}
                </div>
            </div>

            {/* 标签 */}
            {tags.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    {tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                    ))}
                </div>
            )}

            {/* 备注 */}
            {note && (
                <p style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic'
                }}>
                    {note}
                </p>
            )}
        </Link>
    );
}
