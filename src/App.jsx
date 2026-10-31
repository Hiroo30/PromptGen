import { useCallback, useState } from 'react';
import { Clock3, Image as ImageIcon, Video } from 'lucide-react';
import ImageToPrompt from './components/ImageToPrompt';
import PromptHistory from './components/PromptHistory';
import VideoToPrompt from './components/VideoToPrompt';
import Toast from './components/Toast';
import { getGeminiConfig } from './lib/gemini';
import {
  clearPromptMedia,
  createHistoryItem,
  deletePromptMedia,
  getPromptHistory,
  savePromptHistory,
  savePromptMedia,
} from './lib/history';

export default function App() {
  const [activeTab, setActiveTab] = useState('image');
  const [toast, setToast] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState(getPromptHistory);
  const { ready: apiReady } = getGeminiConfig();

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  const saveToHistory = useCallback(async ({ media, ...result }) => {
    const item = createHistoryItem(result);
    try {
      await savePromptMedia(item.id, media);
      setHistory((current) => savePromptHistory([{ ...item, mediaCount: media?.length || 0 }, ...current]));
    } catch {
      setHistory((current) => savePromptHistory([item, ...current]));
      showToast('Prompt tersimpan, tetapi file referensi gagal disimpan karena ruang browser tidak cukup.', 'error');
    }
  }, [showToast]);

  const deleteHistoryItem = useCallback(async (id) => {
    await deletePromptMedia(id).catch(() => undefined);
    setHistory((current) => savePromptHistory(current.filter((item) => item.id !== id)));
  }, []);

  const clearHistory = useCallback(async () => {
    if (!window.confirm('Hapus seluruh riwayat prompt dari browser ini?')) return;
    await clearPromptMedia().catch(() => undefined);
    setHistory(savePromptHistory([]));
  }, []);

  return (
    <div className="min-h-screen bg-pink-50 text-gray-800 font-sans selection:bg-pink-200 overflow-x-hidden relative pb-20">
      <div
        className="fixed top-0 left-0 w-[40%] h-full pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage: "url('/bg-kiri.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
          opacity: '1.0',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
        }}
      />

      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-200/40 blur-[120px] rounded-full pointer-events-none" />

      <header className="pt-12 pb-8 text-center relative z-10 px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-pink-500 mb-4">
          PromptGen
        </h1>
        <p className="text-pink-400 text-lg max-w-2xl mx-auto">
          Bongkar rahasia desain UI/UX aplikasi dan otomatis bikin rancangan Full-Stack cuma dari gambar atau video.
        </p>
      </header>

      <div className="flex justify-center mb-10 relative z-10 px-4">
        <div className="bg-white/80 p-1.5 rounded-full border border-pink-100 backdrop-blur-md flex gap-1 shadow-md">
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-300 ${
              activeTab === 'image'
                ? 'bg-pink-400 text-white shadow-md'
                : 'text-pink-400 hover:text-pink-500 hover:bg-white'
            }`}
          >
            <ImageIcon size={18} />
            Image to Prompt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-300 ${
              activeTab === 'video'
                ? 'bg-pink-400 text-white shadow-md'
                : 'text-pink-400 hover:text-pink-500 hover:bg-white'
            }`}
          >
            <Video size={18} />
            Video to Prompt
          </button>
        </div>
      </div>

      <div className="history-trigger-wrap relative z-10 px-4">
        <button type="button" className="history-trigger" onClick={() => setHistoryOpen(true)}>
          <Clock3 size={17} /> Riwayat{history.length ? ` (${history.length})` : ''}
        </button>
      </div>

      <main className="relative z-10 px-4">
        {activeTab === 'image' ? (
          <ImageToPrompt showToast={showToast} apiReady={apiReady} onResultCreated={saveToHistory} />
        ) : (
          <VideoToPrompt showToast={showToast} apiReady={apiReady} onResultCreated={saveToHistory} />
        )}
      </main>

      {historyOpen && (
        <PromptHistory
          items={history}
          onClose={() => setHistoryOpen(false)}
          onDelete={deleteHistoryItem}
          onClear={clearHistory}
          onCopyError={(message) => showToast(message, 'error')}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
