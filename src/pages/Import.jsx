import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tabService } from '../db/tabService';
import { parseChordPro, isChordProFormat } from '../utils/chordProParser';
import { parseRawText } from '../utils/textParser';

/**
 * 导入页面 - 两阶段智能导入流程
 * 
 * 阶段一（input）：极简输入，只有一个文本框和 Generate 按钮
 * 阶段二（confirm）：确认编辑，自动填充 80%，用户只需微调
 */
export default function Import() {
    const navigate = useNavigate();

    // 阶段控制：'input' | 'confirm'
    const [step, setStep] = useState('input');

    // 阶段一：原始输入
    const [rawInput, setRawInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // 阶段二：解析结果（可编辑）
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    /**
     * 处理 Generate Tab 按钮点击
     * 解析原始输入，进入确认阶段
     */
    const handleGenerate = async () => {
        if (!rawInput.trim()) {
            alert('Please paste some content first');
            return;
        }

        setIsGenerating(true);

        try {
            // 使用智能解析器处理输入
            const parsed = parseRawText(rawInput);

            // 如果是 ChordPro 格式，额外处理内容转换
            let finalContent = parsed.content;
            if (isChordProFormat(rawInput)) {
                const chordProParsed = parseChordPro(rawInput);
                if (chordProParsed.content) {
                    finalContent = chordProParsed.content;
                }
                // ChordPro 的元数据优先
                if (chordProParsed.title) {
                    parsed.title = chordProParsed.title;
                }
                if (chordProParsed.artist) {
                    parsed.artist = chordProParsed.artist;
                }
            }

            // 填充表单
            setTitle(parsed.title || '');
            setArtist(parsed.artist || '');
            setContent(finalContent || parsed.content || rawInput.trim());
            setTags(parsed.tags.join(', '));

            // 进入确认阶段
            setStep('confirm');
        } catch (error) {
            console.error('解析失败:', error);
            // 即使解析失败，也让用户继续（使用原始输入）
            setContent(rawInput.trim());
            setStep('confirm');
        } finally {
            setIsGenerating(false);
        }
    };

    /**
     * 返回到输入阶段
     */
    const handleBack = () => {
        setStep('input');
    };

    /**
     * 保存吉他谱
     */
    const handleSave = async () => {
        if (!content.trim()) {
            alert('Tab content is empty');
            return;
        }

        setIsSaving(true);

        try {
            // 处理标签（逗号分隔）
            const tagArray = tags
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            const id = await tabService.add({
                title: title.trim() || 'Untitled',
                artist: artist.trim(),
                content: content,
                tags: tagArray,
                note: ''
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

    // ===== 阶段一：极简输入界面 =====
    if (step === 'input') {
        return (
            <div className="page">
                <header className="header">
                    <Link to="/" className="btn-icon" title="Back">
                        ←
                    </Link>
                    <h1 className="header-title">Import Tab</h1>
                    <div style={{ width: '40px' }}></div>
                </header>

                <div className="container import-simple">
                    {/* 极简提示 */}
                    <div className="import-hint">
                        <span className="import-hint-icon">📋</span>
                        <span>Paste anything: webpage, tab, messy text...</span>
                    </div>

                    {/* 唯一的输入框 */}
                    <textarea
                        className="textarea import-textarea"
                        placeholder={`Paste anything here...

Examples:
• Copy from a guitar tab website
• ChordPro format text
• Plain chord sheet
• Even messy webpage content

The system will auto-clean and format it for you!`}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        autoFocus
                    />

                    {/* 唯一的按钮 */}
                    <button
                        className="btn btn-primary import-generate-btn"
                        onClick={handleGenerate}
                        disabled={isGenerating || !rawInput.trim()}
                    >
                        {isGenerating ? (
                            <>
                                <span className="spinner"></span>
                                Generating...
                            </>
                        ) : (
                            <>
                                ✨ Generate Tab
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // ===== 阶段二：确认编辑界面 =====
    return (
        <div className="page">
            <header className="header">
                <button className="btn-icon" onClick={handleBack} title="Back to input">
                    ←
                </button>
                <h1 className="header-title">Confirm & Save</h1>
                <div style={{ width: '40px' }}></div>
            </header>

            <div className="container import-confirm">
                {/* 自动填充提示 */}
                <div className="auto-fill-banner">
                    <span>✅ Auto-filled! Review and save.</span>
                </div>

                {/* 谱内容预览（核心） */}
                <div className="preview-section">
                    <label className="field-label">
                        Tab Content
                        <span className="field-hint">（主角，确认能弹就行）</span>
                    </label>
                    <div className="preview-content mono">
                        {content.split('\n').slice(0, 20).join('\n')}
                        {content.split('\n').length > 20 && (
                            <div className="preview-fade">
                                ... ({content.split('\n').length - 20} more lines)
                            </div>
                        )}
                    </div>
                    {/* 可展开编辑 */}
                    <details className="edit-content-details">
                        <summary>Edit content</summary>
                        <textarea
                            className="textarea mono"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            style={{ minHeight: '300px', marginTop: '8px' }}
                        />
                    </details>
                </div>

                {/* 标题 & 艺术家 - 横向排列 */}
                <div className="meta-row">
                    <div className="meta-field">
                        <label className="field-label">Title</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Song title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="meta-field">
                        <label className="field-label">Artist</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="(optional)"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                        />
                    </div>
                </div>

                {/* 自动标签 */}
                <div className="tags-section">
                    <label className="field-label">
                        Tags
                        <span className="field-hint">（自动生成）</span>
                    </label>
                    <div className="auto-tags">
                        {tags.split(',').filter(t => t.trim()).map((tag, i) => (
                            <span key={i} className="auto-tag">{tag.trim()}</span>
                        ))}
                        {!tags.trim() && <span className="no-tags">No tags</span>}
                    </div>
                    <input
                        type="text"
                        className="input tags-input"
                        placeholder="Add more tags (comma separated)"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                    />
                </div>

                {/* 保存按钮 */}
                <button
                    className="btn btn-primary import-save-btn"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : '💾 Save Tab'}
                </button>
            </div>
        </div>
    );
}
