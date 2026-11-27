import { useEffect, useState, type FormEvent } from 'react';
import { Copy, ExternalLink, Mail, X } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  '情報提供・データ修正依頼',
  'スタジアム・アクセス・遠征情報',
  'YouTube動画の追加・タグ付け',
  '不具合・バグ報告',
  '機能要望・その他',
] as const;

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const issueTitle = `[${category}] ${title.trim()}`;
    const issueBody = [
      `## カテゴリ\n${category}`,
      `## 内容\n${body.trim()}`,
      refUrl.trim() ? `## 参考URL\n${refUrl.trim()}` : '',
      '---\nSent from BellSupport Hub',
    ]
      .filter(Boolean)
      .join('\n\n');

    const issueUrl = `https://github.com/bellsupport-hub/bellsupport-hub.github.io/issues/new?title=${encodeURIComponent(
      issueTitle
    )}&body=${encodeURIComponent(issueBody)}`;
    window.open(issueUrl, '_blank', 'noopener,noreferrer');
    setStatusMessage('GitHub Issue の作成画面を新しいタブで開きました。');
  };

  const handleCopy = async () => {
    const text = `[${category}] ${title.trim()}\n\n${body.trim()}${
      refUrl.trim() ? `\n\n参考URL: ${refUrl.trim()}` : ''
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage('お問い合わせ内容をクリップボードにコピーしました。');
    } catch {
      setStatusMessage('コピーできませんでした。入力欄から手動でコピーしてください。');
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onClick={onClose}
    >
      <div className="modal-sheet contact-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 id="contact-modal-title" className="modal-title contact-modal-heading">
              <Mail size={17} />
              <span>お問い合わせ・情報提供</span>
            </h2>
            <p className="contact-modal-sub">
              データの修正依頼・スタジアム情報提供・機能要望など
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <form className="modal-body contact-form" onSubmit={handleSubmit}>
          <div className="contact-field">
            <label htmlFor="contact-category" className="contact-label">
              カテゴリ
            </label>
            <select
              id="contact-category"
              className="contact-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="contact-field">
            <label htmlFor="contact-title" className="contact-label">
              件名
            </label>
            <input
              id="contact-title"
              type="text"
              required
              className="contact-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：スタジアム情報・データ修正依頼など"
            />
          </div>

          <div className="contact-field">
            <label htmlFor="contact-body" className="contact-label">
              内容
            </label>
            <textarea
              id="contact-body"
              rows={4}
              required
              className="contact-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="詳細をご記入ください（事実確認できる公式URLがあれば併記いただけると助かります）"
            />
          </div>

          <div className="contact-field">
            <label htmlFor="contact-url" className="contact-label">
              参考URL（任意）
            </label>
            <input
              id="contact-url"
              type="url"
              className="contact-input"
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {statusMessage && (
            <p className="contact-status-msg" role="status">
              {statusMessage}
            </p>
          )}

          <div className="contact-actions">
            <button type="submit" className="btn-primary-accent contact-submit-btn">
              <span>GitHub Issue で送信</span>
              <ExternalLink size={14} />
            </button>
            <button
              type="button"
              className="contact-copy-btn"
              onClick={() => void handleCopy()}
            >
              <Copy size={14} />
              <span>コピー</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
