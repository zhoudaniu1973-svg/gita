import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tabService } from '../db/tabService';
import { parseChordPro, isChordProFormat } from '../utils/chordProParser';

/**
 * 导入页面
 * 支持粘贴普通文本或 ChordPro 格式
 */
export default function Import() {
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // 处理内容变化，自动检测 ChordPro 格式
    const handleContentChange = (value) => {
        setContent(value);

        // 如果是 ChordPro 格式，尝试提取元数据
        if (isChordProFormat(value)) {
            const parsed = parseChordPro(value);
            if (parsed.title && !title) {
                setTitle(parsed.title);
            }
            if (parsed.artist && !artist) {
                setArtist(parsed.artist);
            }
        }
    };

    // 保存吉他谱
    const handleSave = async () => {
        if (!content.trim()) {
            alert('Please paste your guitar tab content');
            return;
        }

        setIsSaving(true);

        try {
            // 如果是 ChordPro 格式，转换内容
            let finalContent = content;
            if (isChordProFormat(content)) {
                const parsed = parseChordPro(content);
                finalContent = parsed.content;
            }

            // 处理标签（逗号分隔）
            const tagArray = tags
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            const id = await tabService.add({
                title: title.trim() || 'Untitled',
                artist: artist.trim(),
                content: finalContent,
                tags: tagArray,
                note: note.trim()
            });

            // 保存成功，跳转到播放页
            navigate(`/player/${id}`);
        } catch (error) {
            console.error('保存失败:', error);
            alert('Save failed, please try again');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="page">
            <header className="header">
                <Link to="/" className="btn-icon" title="Back">
                    ←
                </Link>
                <h1 className="header-title">Import Tab</h1>
                <div style={{ width: '40px' }}></div>
            </header>

            <div className="container">
                {/* 标题输入 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        Title
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Song title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                {/* 艺术家输入 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        Artist
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Artist name (optional)"
                        value={artist}
                        onChange={(e) => setArtist(e.target.value)}
                    />
                </div>

                {/* 内容输入 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        Tab Content (Plain text or ChordPro format)
                    </label>
                    <textarea
                        className="textarea"
                        placeholder={`Paste your guitar tab here...

Example:
Am                          E7
On a dark desert highway, cool wind in my hair

Or ChordPro format:
[Am]On a dark desert [E7]highway`}
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        style={{ minHeight: '300px' }}
                    />
                </div>

                {/* 标签输入 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        Tags (comma separated)
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="fingerstyle, acoustic, beginner"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                    />
                </div>

                {/* 备注输入 */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        Note
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="e.g., Great for fingerstyle practice"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                {/* 保存按钮 */}
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ width: '100%', padding: '16px' }}
                >
                    {isSaving ? 'Saving...' : '💾 Save Tab'}
                </button>
            </div>
        </div>
    );
}
