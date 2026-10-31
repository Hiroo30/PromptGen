import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Code, Copy, Download, FileText, Image as ImageIcon, Trash2, Video, X } from 'lucide-react';
import { downloadFile } from '../lib/files';
import { getPromptMedia } from '../lib/history';

function formatDate(value) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function sourceLabel(source) {
  return source === 'video' ? 'Video' : 'Gambar';
}

function HistoryText({ title, icon, value, filename, mime, onCopyError }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      onCopyError(error.message || 'Tidak dapat menyalin teks.');
    }
  };

  return (
    <article className="history-result">
      <div className="history-result-header">
        <h3>{icon}{title}</h3>
        <div className="history-result-actions">
          <button type="button" onClick={copy} aria-label={`Salin ${title}`} title="Salin">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button type="button" onClick={() => downloadFile(value, filename, mime)} aria-label={`Unduh ${title}`} title="Unduh">
            <Download size={16} />
          </button>
        </div>
      </div>
      <pre>{value}</pre>
    </article>
  );
}

export default function PromptHistory({ items, onClose, onDelete, onClear, onCopyError }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id || null);
  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0] || null,
    [items, selectedId],
  );

  useEffect(() => {
    let active = true;
    const mediaUrls = [];
    if (!selected?.id) return () => undefined;
    queueMicrotask(() => {
      if (active) {
        setMedia([]);
        setMediaLoading(true);
      }
    });
    getPromptMedia(selected.id)
      .then((entries) => {
        const entriesWithUrls = entries.map((entry) => {
          const url = URL.createObjectURL(entry.blob);
          mediaUrls.push(url);
          return { ...entry, url };
        });
        if (active) {
          setMedia(entriesWithUrls);
        } else {
          mediaUrls.forEach((url) => URL.revokeObjectURL(url));
        }
      })
      .catch(() => {
        if (active) setMedia([]);
      })
      .finally(() => {
        if (active) setMediaLoading(false);
      });
    return () => {
      active = false;
      mediaUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selected?.id]);

  return (
    <div className="history-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="history-drawer" role="dialog" aria-modal="true" aria-labelledby="history-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="history-drawer-header">
          <div>
            <p className="history-kicker"><Clock3 size={15} /> Riwayat lokal</p>
            <h2 id="history-title">Prompt sebelumnya</h2>
            <p>Disimpan hanya di browser perangkat ini.</p>
          </div>
          <button type="button" className="history-close" onClick={onClose} aria-label="Tutup riwayat"><X size={20} /></button>
        </header>

        {items.length === 0 ? (
          <div className="history-empty">
            <Clock3 size={28} />
            <h3>Belum ada riwayat</h3>
            <p>Setelah membuat prompt, hasilnya akan muncul di sini dan dapat dibuka lagi kapan saja.</p>
          </div>
        ) : (
          <div className="history-layout">
            <aside className="history-list" aria-label="Daftar riwayat prompt">
              <div className="history-list-heading">
                <span>{items.length} tersimpan</span>
                <button type="button" onClick={onClear}><Trash2 size={14} /> Hapus semua</button>
              </div>
              {items.map((item) => {
                const Icon = item.source === 'video' ? Video : ImageIcon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`history-item ${selected?.id === item.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <Icon size={16} />
                    <span>
                      <strong>{sourceLabel(item.source)} · {item.aspectRatio || 'Desktop'}</strong>
                      <small>{formatDate(item.createdAt)}</small>
                    </span>
                  </button>
                );
              })}
            </aside>

            {selected && (
              <div className="history-detail">
                <div className="history-detail-meta">
                  <span>{sourceLabel(selected.source)} · {selected.aspectRatio || 'Desktop'}</span>
                  <button type="button" className="history-delete" onClick={() => onDelete(selected.id)}><Trash2 size={15} /> Hapus</button>
                </div>
                {selected.customInstruction && <p className="history-instruction"><strong>Fokus:</strong> {selected.customInstruction}</p>}
                <section className="history-media" aria-labelledby="reference-title">
                  <div className="history-media-heading">
                    <h3 id="reference-title">File referensi</h3>
                    <span>{mediaLoading ? 'Memuat…' : `${media.length} file`}</span>
                  </div>
                  {media.length ? (
                    <div className="history-media-grid">
                      {media.map((entry, index) => entry.type.startsWith('video/') ? (
                        <video key={`${entry.name}-${index}`} controls preload="metadata" src={entry.url} />
                      ) : (
                        <img key={`${entry.name}-${index}`} src={entry.url} alt={`Referensi ${index + 1}: ${entry.name}`} />
                      ))}
                    </div>
                  ) : (
                    <p className="history-media-empty">File referensi tidak tersedia untuk riwayat ini.</p>
                  )}
                </section>
                <div className="history-results-grid">
                  <HistoryText title="English Prompt" icon={<FileText size={17} />} value={selected.englishText} filename="prompt-history.txt" mime="text/plain" onCopyError={onCopyError} />
                  <HistoryText title="Structured Data (JSON)" icon={<Code size={17} />} value={selected.jsonText} filename="prompt-history.json" mime="application/json" onCopyError={onCopyError} />
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
