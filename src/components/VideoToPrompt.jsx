import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Upload } from 'lucide-react';
import { extractFrames } from '../lib/frames';
import { pickVideo } from '../lib/files';
import { generateWithGemini } from '../lib/gemini';
import { parseResponse } from '../lib/parse';
import { buildSystemInstruction } from '../lib/prompts';
import ResultViewer from './ResultViewer';

export default function VideoToPrompt({ showToast, apiReady }) {
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState(null);
  const [customInstruction, setCustomInstruction] = useState('');
  const [aspectRatio, setAspectRatio] = useState('PC');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(null);
  const videoUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  const applyVideo = (incoming) => {
    try {
      const selected = pickVideo(incoming);
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      setFile(selected);
      const nextUrl = URL.createObjectURL(selected);
      videoUrlRef.current = nextUrl;
      setVideoUrl(nextUrl);
      setResults(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFileSelect = (event) => {
    const selected = event.target.files[0];
    if (selected) applyVideo(selected);
    event.target.value = '';
  };

  const handleGenerate = async () => {
    if (!file || !videoUrl) {
      showToast('Upload a screen recording first.', 'error');
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
    setProgressMsg('Reading the recording…');

    try {
      const { frames } = await extractFrames(videoRef.current, canvasRef.current, {
        signal: controller.signal,
        onProgress: setProgressMsg,
      });

      setProgressMsg(`Sending ${frames.length} frames to Gemini…`);

      const prompt = buildSystemInstruction({
        customInstruction,
        aspectRatio,
        source: 'video',
      });

      const imageParts = frames.flatMap((frame) => [
        { text: `Keyframe at ${frame.time} seconds:` },
        { inlineData: { mimeType: 'image/jpeg', data: frame.data } },
      ]);

      const rawText = await generateWithGemini(prompt, imageParts, controller.signal);
      setResults(parseResponse(rawText));
      showToast('Brief ready.', 'success');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      showToast(err.message || 'Failed to process the video.', 'error');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="work">
      {videoUrl && (
        <video ref={videoRef} src={videoUrl} className="hidden-media" muted playsInline preload="metadata" />
      )}
      <canvas ref={canvasRef} className="hidden-media" />

      <div className="work-grid">
        <section className="panel">
          <header>
            <h2>Screen recording</h2>
            <p className="meta">{file ? file.name : 'None'}</p>
          </header>
          <div
            className={`dropzone ${videoUrl ? 'has-files' : ''} ${dragging ? 'dragging' : ''}`}
            onClick={() => !loading && !videoUrl && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) applyVideo(dropped);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role={videoUrl ? undefined : 'button'}
            tabIndex={videoUrl ? undefined : 0}
            aria-label="Upload a screen recording"
          >
            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileSelect}
              disabled={loading}
            />
            {videoUrl ? (
              <video src={videoUrl} className="preview-video" controls playsInline muted={false} />
            ) : (
              <div className="drop-empty">
                <Upload size={20} />
                <p>Drop a screen recording here, or click to browse</p>
                <span>MP4, WebM, MOV · first 2 minutes · 80 MB max</span>
              </div>
            )}
          </div>
          {videoUrl && (
            <div className="inline-actions">
              <button type="button" className="btn ghost" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                <RefreshCw size={14} /> Replace
              </button>
            </div>
          )}
        </section>

        <section className="panel settings">
          <header>
            <h2>Brief settings</h2>
          </header>
          <p className="lede">
            Frames are taken every 8 seconds from the first two minutes. Use this for walkthroughs of a product, not cinematic footage.
          </p>
          <div className="field">
            <span id="video-layout-label">Target layout</span>
            <div className="segmented" role="radiogroup" aria-labelledby="video-layout-label">
              {[
                { id: 'PC', label: 'Desktop' },
                { id: 'SmartPhone', label: 'Phone' },
                { id: 'Keduanya', label: 'Both' },
              ].map((ratio) => (
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
            <label htmlFor="video-instruction">Focus instruction</label>
            <textarea
              id="video-instruction"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Example: treat this as an onboarding flow and list each screen in order."
            />
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={handleGenerate}
            disabled={loading || !file || !apiReady}
          >
            {loading ? (
              <>
                <Loader2 className="spin" size={16} /> {progressMsg || 'Working…'}
              </>
            ) : (
              'Generate brief'
            )}
          </button>
        </section>
      </div>

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
