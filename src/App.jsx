import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Video, Copy, Download, 
  Check, Loader2, FileText, Code, Play, RefreshCw
} from 'lucide-react';

// --- UTILITIES ---

// Convert file to Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

// Download helper
const downloadFile = (content, filename, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// API Call helper
const generateWithGemini = async (prompt, imageParts) => {
  const apiKey = ""; // Canvas runtime provides the key automatically when empty
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        ...imageParts
      ]
    }]
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  const result = await response.json();
  return result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const parseResponse = (text) => {
  const englishRegex = /---ENGLISH PROMPTS?---([\s\S]*?)---JSON OUTPUT---/i;
  const jsonRegex = /---JSON OUTPUT---([\s\S]*)/i;

  const englishMatch = text.match(englishRegex);
  const jsonMatch = text.match(jsonRegex);

  let englishText = englishMatch ? englishMatch[1].trim() : 'Could not parse English prompt. See raw output below if applicable.';
  let jsonText = jsonMatch ? jsonMatch[1].trim() : '{\n  "error": "Could not parse JSON output."\n}';

  // Strip markdown blocks if the LLM added them despite instructions
  jsonText = jsonText.replace(/^```(json)?/im, '').replace(/```$/im, '').trim();

  return { englishText, jsonText };
};


// --- COMPONENTS ---

const Toast = ({ message, type = 'error', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    error: 'bg-red-500/10 border-red-500/50 text-red-400',
    success: 'bg-green-500/10 border-green-500/50 text-green-400',
    info: 'bg-blue-500/10 border-blue-500/50 text-blue-400'
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg flex items-center gap-3 ${bgColors[type]}`}>
      <span>{message}</span>
    </div>
  );
};

const ResultViewer = ({ englishText, jsonText }) => {
  const [copiedEng, setCopiedEng] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const handleCopy = async (text, setter) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="w-full space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* English Prompts Section */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col">
          <div className="flex justify-between items-center px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <FileText size={18} className="text-purple-400"/> English Prompt
            </h3>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(englishText, setCopiedEng)} className="p-2 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white" title="Copy">
                {copiedEng ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
              </button>
              <button onClick={() => downloadFile(englishText, 'prompts.txt')} className="p-2 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white" title="Download TXT">
                <Download size={16}/>
              </button>
            </div>
          </div>
          <div className="p-4 flex-grow bg-gray-950/30 overflow-auto max-h-[500px]">
            <pre className="whitespace-pre-wrap font-sans text-gray-300 text-sm leading-relaxed">
              {englishText}
            </pre>
          </div>
        </div>

        {/* JSON Section */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col">
          <div className="flex justify-between items-center px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <Code size={18} className="text-blue-400"/> Structured Data (JSON)
            </h3>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(jsonText, setCopiedJson)} className="p-2 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white" title="Copy">
                {copiedJson ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
              </button>
              <button onClick={() => downloadFile(jsonText, 'data.json', 'application/json')} className="p-2 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white" title="Download JSON">
                <Download size={16}/>
              </button>
            </div>
          </div>
          <div className="p-4 flex-grow bg-gray-950/30 overflow-auto max-h-[500px]">
            <pre className="whitespace-pre-wrap font-mono text-blue-300/80 text-xs leading-relaxed">
              {jsonText}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImageToPrompt = ({ showToast }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'];

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type.startsWith('image/')) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResults(null);
    } else {
      showToast('Please select a valid image file.', 'error');
    }
  };

  const handleGenerate = async () => {
    if (!file) {
      showToast('Please upload an image first.', 'error');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const base64Data = await fileToBase64(file);
      
      const systemInstruction = `
You are an expert AI Prompt Engineer and visual analyst. 
Perform a deep visual analysis of the provided image.

Rules:
- Never leave fields empty. If uncertain, infer logically but keep realistic.
- The aspect ratio chosen by the user is ${aspectRatio}. Incorporate this nicely into the prompt.
- Your output must follow the STRICT FORMAT below. Do not deviate.
- Do not use markdown backticks (\`\`\`) around the JSON. Just output raw JSON.

STRICT FORMAT:
---ENGLISH PROMPT---
[A fully detailed professional paragraph optimized for AI image models such as Midjourney, DALL-E, Stable Diffusion. Minimum 80 words. No extra commentary.]
---JSON OUTPUT---
{
"main_subject": "string",
"secondary_elements": "string",
"environment": "string",
"lighting": "string",
"camera_angle": "string",
"depth_of_field": "string",
"texture_details": "string",
"mood": "string",
"color_grading": "string",
"style_reference": "string",
"full_prompt": "Complete optimized image generation prompt, minimum 80 words.",
"quality_tags": "8K, ultra-detailed, hyperrealistic, professional lighting, sharp focus"
}`;

      const imageParts = [{ inlineData: { mimeType: file.type, data: base64Data } }];
      const rawText = await generateWithGemini(systemInstruction, imageParts);
      
      setResults(parseResponse(rawText));
      showToast('Analysis complete!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to generate prompt.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto">
      <div className="w-full bg-gray-900/60 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 pointer-events-none"/>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          
          {/* Upload Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <ImageIcon className="text-purple-400" /> Image Upload
            </h2>
            <div 
              className={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden group ${preview ? 'border-gray-600 bg-gray-800/30' : 'border-gray-600 hover:border-purple-400 bg-gray-800/30 hover:bg-gray-800/50'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium flex items-center gap-2"><RefreshCw size={16}/> Change Image</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 p-6">
                  <Upload className="mx-auto mb-3 w-10 h-10 text-gray-500 group-hover:text-purple-400 transition-colors" />
                  <p className="font-medium text-gray-300">Click to browse or drag image here</p>
                  <p className="text-xs mt-2 text-gray-500">Supports JPG, PNG, WEBP</p>
                </div>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="flex flex-col justify-between">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Settings</h2>
                <label className="block text-sm font-medium text-gray-400 mb-2">Target Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {aspectRatios.map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                        aspectRatio === ratio 
                        ? 'bg-purple-500/20 border-purple-500 text-purple-200' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-200/80 leading-relaxed">
                <p>The AI will perform a deep visual analysis of the image, inferring lighting, mood, camera angles, and textures to generate a production-ready prompt.</p>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={loading || !file}
              className={`mt-6 w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] ${
                loading || !file 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:scale-[1.02]'
              }`}
            >
              {loading ? (
                <><Loader2 className="animate-spin" /> Analyzing Image...</>
              ) : (
                <><ImageIcon /> Generate Prompt</>
              )}
            </button>
          </div>
        </div>
      </div>

      {results && (
        <ResultViewer englishText={results.englishText} jsonText={results.jsonText} />
      )}
    </div>
  );
};


const VideoToPrompt = ({ showToast }) => {
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type.startsWith('video/')) {
      setFile(selected);
      setVideoUrl(URL.createObjectURL(selected));
      setResults(null);
    } else {
      showToast('Please select a valid video file.', 'error');
    }
  };

  const extractFrames = async () => {
    return new Promise(async (resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return reject('Refs missing');

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let frames = [];
      
      try {
        // Wait for metadata
        await new Promise(res => {
          if (video.readyState >= 1) res();
          else video.onloadedmetadata = res;
        });

        const duration = video.duration;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Cap max frames to prevent payload explosion (max ~15 frames = 2 minutes of 8s intervals)
        const maxDurationToProcess = Math.min(duration, 120); 
        const interval = 8;
        
        setProgressMsg('Extracting keyframes...');

        for (let t = 0; t <= maxDurationToProcess; t += interval) {
          video.currentTime = t;
          await new Promise((res) => {
            const handleSeeked = () => {
              video.removeEventListener('seeked', handleSeeked);
              res();
            };
            video.addEventListener('seeked', handleSeeked);
          });
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          frames.push({
            time: t,
            data: base64Data
          });
          setProgressMsg(`Extracting keyframes... (${Math.floor((t/maxDurationToProcess)*100)}%)`);
        }
        resolve({ duration, frames });
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleGenerate = async () => {
    if (!file || !videoUrl) {
      showToast('Please upload a video first.', 'error');
      return;
    }

    setLoading(true);
    setResults(null);
    setProgressMsg('Initializing processor...');

    try {
      const { duration, frames } = await extractFrames();
      
      setProgressMsg(`Analyzing ${frames.length} segments with AI...`);

      const systemInstruction = `
You are a master cinematographer and AI prompt engineer.
I am providing you with ${frames.length} keyframes extracted from a video (one every 8 seconds, total duration ${duration.toFixed(1)}s).

Analyze EACH segment independently but maintain cinematic continuity across the sequence. 

Rules:
- Never leave fields empty.
- Ensure 'time_range' accurately reflects the 8-second intervals (e.g., 0-8, 8-16, 16-24).
- Your output must strictly follow the format below.
- Do not use markdown backticks (\`\`\`) around the JSON. Just output raw JSON.

STRICT FORMAT:
---ENGLISH PROMPTS---
Segment 1 (0-8s):
[Minimum 80-word cinematic paragraph.]
Segment 2 (8-16s):
[Minimum 80-word cinematic paragraph.]
(Continue for all segments)

---JSON OUTPUT---
{
"total_duration_seconds": ${duration.toFixed(1)},
"segment_length_seconds": 8,
"segments": [
{
"segment_number": 1,
"time_range": "0-8",
"main_subject": "string",
"action_progression": "string",
"secondary_elements": "string",
"environment_details": "string",
"lighting": "string",
"camera_angle": "string",
"camera_movement": "string",
"depth_of_field": "string",
"visual_texture": "string",
"cinematic_style": "string",
"emotional_tone": "string",
"color_grading": "string",
"full_prompt": "Standalone cinematic prompt minimum 80 words optimized for AI video models.",
"quality_tags": "4K, ultra-detailed, cinematic lighting, dynamic motion, professional color grading"
}
]
}`;

      // Construct parts with timestamps for clarity to the model
      const imageParts = frames.reduce((acc, frame) => {
        acc.push({ text: `Keyframe at ${frame.time} seconds:` });
        acc.push({ inlineData: { mimeType: 'image/jpeg', data: frame.data } });
        return acc;
      }, []);

      const rawText = await generateWithGemini(systemInstruction, imageParts);
      
      setResults(parseResponse(rawText));
      showToast('Video analysis complete!', 'success');

    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to process video.', 'error');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto">
      {/* Hidden elements for processing */}
      {videoUrl && <video ref={videoRef} src={videoUrl} className="hidden" muted playsInline crossOrigin="anonymous" />}
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full bg-gray-900/60 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"/>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          
          {/* Upload Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Video className="text-blue-400" /> Video Upload
            </h2>
            <div 
              className={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden group ${videoUrl ? 'border-gray-600 bg-gray-800/30' : 'border-gray-600 hover:border-blue-400 bg-gray-800/30 hover:bg-gray-800/50'}`}
              onClick={() => !loading && fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4,video/webm,video/quicktime" onChange={handleFileSelect} disabled={loading}/>
              {videoUrl ? (
                <>
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                    <Play size={48} className="text-white/50" />
                  </div>
                  <video src={videoUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  {!loading && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                      <span className="text-white font-medium flex items-center gap-2"><RefreshCw size={16}/> Change Video</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-400 p-6">
                  <Upload className="mx-auto mb-3 w-10 h-10 text-gray-500 group-hover:text-blue-400 transition-colors" />
                  <p className="font-medium text-gray-300">Click to browse or drag video here</p>
                  <p className="text-xs mt-2 text-gray-500">MP4, WebM, MOV (Max 2 mins recommended)</p>
                </div>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="flex flex-col justify-between">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Cinematic Analysis</h2>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Detects total duration automatically
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    Splits into 8-second cinematic segments
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                    Analyzes camera movement & action progression
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    Maintains continuity between segment prompts
                  </li>
                </ul>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-200/80 leading-relaxed">
                <p>Note: Processing video takes time. The app will extract keyframes and send a multi-modal context to the AI for deep cinematic evaluation.</p>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={loading || !file}
              className={`mt-6 w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] ${
                loading || !file 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:scale-[1.02]'
              }`}
            >
              {loading ? (
                <div className="flex flex-col items-center">
                  <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> {progressMsg || 'Processing...'}</span>
                </div>
              ) : (
                <><Video /> Analyze Video Structure</>
              )}
            </button>
          </div>
        </div>
      </div>

      {results && (
        <ResultViewer englishText={results.englishText} jsonText={results.jsonText} />
      )}
    </div>
  );
};


export default function App() {
  const [activeTab, setActiveTab] = useState('image');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-purple-500/30 overflow-x-hidden relative pb-20">
      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>

      {/* Header */}
      <header className="pt-12 pb-8 text-center relative z-10 px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-4">
          AI Prompt Generator <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Pro</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Reverse-engineer stunning visuals into high-fidelity AI prompts using advanced multi-modal vision analysis.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex justify-center mb-10 relative z-10 px-4">
        <div className="bg-gray-900/80 p-1.5 rounded-full border border-gray-700/50 backdrop-blur-md flex gap-1 shadow-xl">
          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-300 ${
              activeTab === 'image'
                ? 'bg-gray-800 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <ImageIcon size={18} />
            Image to Prompt
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-300 ${
              activeTab === 'video'
                ? 'bg-gray-800 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <Video size={18} />
            Video to Prompt <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">Beta</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 px-4">
        {activeTab === 'image' ? (
          <ImageToPrompt showToast={showToast} />
        ) : (
          <VideoToPrompt showToast={showToast} />
        )}
      </main>

      {/* Toasts */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}