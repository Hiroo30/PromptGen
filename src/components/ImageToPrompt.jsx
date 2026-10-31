import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, Upload, X } from 'lucide-react';
import { capImages, fileToBase64, filterImages } from '../lib/files';
import { generateWithGemini } from '../lib/gemini';
import { parseResponse } from '../lib/parse';
import { buildSystemInstruction } from '../lib/prompts';
import ResultViewer from './ResultViewer';

const ASPECT_RATIOS = [
  { id: 'PC', label: 'Desktop' },
  { id: 'SmartPhone', label: 'Phone' },
  { id: 'Keduanya', label: 'Both' },
];

export default function ImageToPrompt({ showToast, apiReady }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [aspectRatio, setAspectRatio] = useState('PC');
  const [customInstruction, setCustomInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);
  const replaceInputRef = useRef(null);
  const addInputRef = useRef(null);
  const abortRef = useRef(null);
  const previewUrlsRef = useRef(new Set());

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      abortRef.current?.abort();
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  const createPreviews = (selected) => selected.map((file) => {
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.add(url);
    return url;
  });

  const applyFiles = (incoming, replace) => {
    try {
      const selected = filterImages(incoming);
      if (selected.length === 0) {
        showToast('Choose JPG, PNG, or WEBP files.', 'error');
        return;
      }
      const nextFiles = replace ? selected : capImages(files, selected);
      if (replace) {
        previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        previewUrlsRef.current.clear();
      }
      const nextPreviews = replace
        ? createPreviews(selected)
        : [...previews, ...createPreviews(selected)];
      setFiles(nextFiles);
      setPreviews(nextPreviews);
      setResults(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFileSelect = (event, replace) => {
    applyFiles(event.target.files, replace);
    event.target.value = '';
  };

  const removeAt = (index) => {
    const previewUrl = previews[index];
    URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current.delete(previewUrl);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setResults(null);
  };

  const handleGenerate = async () => {
    if (files.length === 0) {
      showToast('Upload at least one screenshot.', 'error');
      return;
    }
    if (!apiReady) {
      showToast('Add VITE_GEMINI_API_KEY to .env.local.', 'error');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setResults(null);

    try {
      const base64DataArray = await Promise.all(files.map(fileToBase64));
      const prompt = buildSystemInstruction({
        customInstruction,
        aspectRatio,
        source: 'image',
      });
      const imageParts = base64DataArray.map((data, idx) => ({
        inlineData: { mimeType: files[idx].type, data },
      }));
      const rawText = await generateWithGemini(prompt, imageParts, controller.signal);
      setResults(parseResponse(rawText));
      showToast('Brief ready.', 'success');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      showToast(err.message || 'Failed to generate the brief.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="work">
      <div className="work-grid">
        <section className="panel">
          <header>
            <h2>References</h2>
            <p className="meta">{files.length} / 8</p>
          </header>
          <div
            className={`dropzone ${previews.length ? 'has-files' : ''} ${dragging ? 'dragging' : ''}`}
            onClick={() => previews.length === 0 && replaceInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              applyFiles(e.dataTransfer.files, previews.length === 0);
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && previews.length === 0) {
                e.preventDefault();
                replaceInputRef.current?.click();
              }
            }}
            role={previews.length === 0 ? 'button' : undefined}
            tabIndex={previews.length === 0 ? 0 : undefined}
            aria-label="Upload UI screenshots"
          >
            <input
              type="file"
              ref={replaceInputRef}
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => handleFileSelect(e, true)}
            />
            <input
              type="file"
              ref={addInputRef}
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => handleFileSelect(e, false)}
            />

            {previews.length > 0 ? (
              <ul className="preview-grid">
                {previews.map((preview, index) => (
                  <li key={preview}>
                    <img src={preview} alt={`Screenshot ${index + 1}`} />
                    <button
                      type="button"
                      className="remove-thumb"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAt(index);
                      }}
                      aria-label={`Remove screenshot ${index + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="drop-empty">
                <Upload size={20} />
                <p>Drop screenshots here, or click to browse</p>
                <span>JPG, PNG, WEBP · up to 8 files · 8 MB each</span>
              </div>
            )}
          </div>
          {previews.length > 0 && (
            <div className="inline-actions">
              <button type="button" className="btn ghost" onClick={() => replaceInputRef.current?.click()}>
                <RefreshCw size={14} /> Replace
              </button>
              <button type="button" className="btn ghost" onClick={() => addInputRef.current?.click()}>
                <Plus size={14} /> Add
              </button>
            </div>
          )}
        </section>

        <section className="panel settings">
          <header>
            <h2>Brief settings</h2>
          </header>
          <div className="field">
            <span id="layout-label">Target layout</span>
            <div className="segmented" role="radiogroup" aria-labelledby="layout-label">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  type="button"
                  role="radio"
                  aria-checked={aspectRatio === ratio.id}
                  className={aspectRatio === ratio.id ? 'on' : ''}
                  onClick={() => setAspectRatio(ratio.id)}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="focus-instruction">Focus instruction</label>
            <textarea
              id="focus-instruction"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Example: only the navbar and sidebar, keep the rest as a shell."
            />
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={handleGenerate}
            disabled={loading || files.length === 0 || !apiReady}
          >
            {loading ? (
              <>
                <Loader2 className="spin" size={16} /> Reading the UI
              </>
            ) : (
              'Generate brief'
            )}
          </button>
          {!apiReady && <p className="hint">Set VITE_GEMINI_API_KEY in .env.local, then restart Vite.</p>}
        </section>
      </div>

      {loading && (
        <div className="panel status-panel">
          <p>Gemini is writing the brief from {files.length} screenshot{files.length === 1 ? '' : 's'}.</p>
        </div>
      )}

      {results && (
        <ResultViewer
          englishText={results.englishText}
          jsonText={results.jsonText}
          onCopyError={(message) => showToast(message, 'error')}
        />
      )}
    </div>
  );
}
