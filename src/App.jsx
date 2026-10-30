import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Video, Copy, Download, 
  Check, Loader2, FileText, Code, Play, RefreshCw, Plus
} from 'lucide-react';

// --- UTILITIES ---

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

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

const generateWithGemini = async (prompt, imageParts) => {
const apiKey = String(import.meta.env.VITE_GEMINI_API_KEY).trim();
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

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
  headers: { 
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey 
  },
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
    error: 'bg-red-50 border-red-200 text-red-500',
    success: 'bg-green-50 border-green-200 text-green-600',
    info: 'bg-pink-50 border-pink-200 text-pink-500'
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
        
        <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden shadow-lg flex flex-col">
          <div className="flex justify-between items-center px-4 py-3 bg-pink-50/50 border-b border-pink-100">
            <h3 className="font-semibold text-pink-500 flex items-center gap-2">
              <FileText size={18} className="text-pink-400"/> English Prompt
            </h3>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(englishText, setCopiedEng)} className="p-2 hover:bg-pink-100 rounded-md transition-colors text-pink-400 hover:text-pink-600" title="Copy">
                {copiedEng ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
              </button>
              <button onClick={() => downloadFile(englishText, 'prompts.txt')} className="p-2 hover:bg-pink-100 rounded-md transition-colors text-pink-400 hover:text-pink-600" title="Download TXT">
                <Download size={16}/>
              </button>
            </div>
          </div>
          <div className="p-4 flex-grow bg-white overflow-auto max-h-[500px]">
            <pre className="whitespace-pre-wrap font-sans text-gray-700 text-sm leading-relaxed">
              {englishText}
            </pre>
          </div>
        </div>

        <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden shadow-lg flex flex-col">
          <div className="flex justify-between items-center px-4 py-3 bg-pink-50/50 border-b border-pink-100">
            <h3 className="font-semibold text-pink-500 flex items-center gap-2">
              <Code size={18} className="text-pink-400"/> Structured Data (JSON)
            </h3>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(jsonText, setCopiedJson)} className="p-2 hover:bg-pink-100 rounded-md transition-colors text-pink-400 hover:text-pink-600" title="Copy">
                {copiedJson ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
              </button>
              <button onClick={() => downloadFile(jsonText, 'data.json', 'application/json')} className="p-2 hover:bg-pink-100 rounded-md transition-colors text-pink-400 hover:text-pink-600" title="Download JSON">
                <Download size={16}/>
              </button>
            </div>
          </div>
          <div className="p-4 flex-grow bg-white overflow-auto max-h-[500px]">
            <pre className="whitespace-pre-wrap font-mono text-gray-600 text-xs leading-relaxed">
              {jsonText}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImageToPrompt = ({ showToast }) => {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [aspectRatio, setAspectRatio] = useState('PC');
  const [customInstruction, setCustomInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  
  const replaceInputRef = useRef(null);
  const addInputRef = useRef(null);

  const aspectRatios = ['PC', 'SmartPhone', 'Keduanya'];

  const handleFileSelect = (e, isReplace = true) => {
    const selectedFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    
    if (selectedFiles.length > 0) {
      if (isReplace) {
        setFiles(selectedFiles);
        previews.forEach(url => URL.revokeObjectURL(url));
        setPreviews(selectedFiles.map(file => URL.createObjectURL(file)));
      } else {
        setFiles(prev => [...prev, ...selectedFiles]);
        setPreviews(prev => [...prev, ...selectedFiles.map(file => URL.createObjectURL(file))]);
      }
      setResults(null);
    }
    e.target.value = null; 
  };

  const handleGenerate = async () => {
    if (files.length === 0) {
      showToast('Please upload at least one image.', 'error');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const base64Promises = files.map(file => fileToBase64(file));
      const base64DataArray = await Promise.all(base64Promises);
      
      const userInstructionContext = customInstruction.trim() 
        ? `\nUSER SPECIFIC INSTRUCTION:\n"${customInstruction}"\nPlease highly prioritize and incorporate this instruction into your generated prompt and analysis.\n` 
        : '';

      const systemInstruction = `
You are an expert Full-Stack Developer and UI/UX Analyst. 
Your primary goal is to reverse-engineer the provided website or application interface image(s) into a highly detailed development brief. 
You must analyze the visual Frontend (UI/UX) AND logically infer the required Backend architecture, database schema, and APIs needed to make this application functional.

Focus intensely on:
- Frontend (UI/UX): Layout structure, components, color palettes, typography, and state management needs.
- Backend & Architecture: Inferred database schema (tables/collections), necessary API endpoints (REST/GraphQL), authentication needs, and core business logic.

Rules:
- Never leave fields empty. Infer logically based on standard software engineering patterns.
- Incorporate the natural layout and aspect ratio of the video into the frontend structure.
- Your output must follow the STRICT FORMAT below. Do not deviate.
- Do not use markdown backticks (\`\`\`) around the JSON. Just output raw JSON.
${userInstructionContext}

STRICT FORMAT:
---ENGLISH PROMPT---
[A fully detailed professional brief for a Full-Stack Developer to recreate this app. Detail both the frontend UI/UX design and the underlying backend architecture needed. Minimum 100 words. No extra commentary.]
---JSON OUTPUT---
{
"app_type": "string (e.g., E-commerce platform, Admin Dashboard)",
"frontend_ui_ux": "string (layout structure, color scheme, typography, key UI components)",
"backend_logic": "string (core processing, authentication, file storage needs)",
"database_schema_inference": "string (suggested tables/models, e.g., Users, Transactions, Products)",
"api_endpoints": "string (suggested API routes, e.g., GET /api/users, POST /api/login)",
"suggested_tech_stack": "string (e.g., React, Tailwind, Node.js, Express, PostgreSQL)",
"full_prompt": "Complete optimized prompt for full-stack generation (frontend + backend), minimum 100 words."
}`;

      const imageParts = base64DataArray.map((base64Data, idx) => ({
        inlineData: { mimeType: files[idx].type, data: base64Data }
      }));
      
      const rawText = await generateWithGemini(systemInstruction, imageParts);
      
      setResults(parseResponse(rawText));
      showToast('Full-Stack Analysis complete!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to generate prompt.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto">
      <div className="w-full bg-white/70 backdrop-blur-xl border border-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 to-white/50 pointer-events-none"/>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-pink-500 flex items-center gap-2">
              <ImageIcon className="text-pink-400" /> References
            </h2>
            <div 
              className={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group ${previews.length > 0 ? 'border-pink-200 bg-white' : 'cursor-pointer border-pink-200 hover:border-pink-400 bg-white/50 hover:bg-pink-50/50'}`}
              onClick={() => previews.length === 0 && replaceInputRef.current?.click()}
            >
              <input type="file" ref={replaceInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleFileSelect(e, true)} />
              <input type="file" ref={addInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleFileSelect(e, false)} />
              
              {previews.length > 0 ? (
                <>
                  <div className="w-full h-full p-2 grid grid-cols-2 gap-2 overflow-y-auto content-start">
                    {previews.map((preview, index) => (
                      <img key={index} src={preview} alt={`Preview ${index}`} className="w-full h-28 object-top object-cover rounded-lg border border-pink-100 shadow-sm" />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-20 pointer-events-auto">
                    <button 
                      onClick={(e) => { e.stopPropagation(); replaceInputRef.current?.click(); }}
                      className="flex items-center gap-2 bg-white hover:bg-pink-50 border border-pink-200 text-pink-500 px-4 py-2 rounded-xl font-medium transition-transform hover:scale-105 shadow-sm"
                    >
                      <RefreshCw size={16}/> Change All
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); addInputRef.current?.click(); }}
                      className="flex items-center gap-2 bg-pink-400 hover:bg-pink-500 border border-pink-300 text-white px-4 py-2 rounded-xl font-medium transition-transform hover:scale-105 shadow-sm"
                    >
                      <Plus size={16}/> Add Image
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-pink-400 p-6">
                  <Upload className="mx-auto mb-3 w-10 h-10 text-pink-300 group-hover:text-pink-500 transition-colors" />
                  <p className="font-medium text-pink-500">Click to browse or drag UI screenshots here</p>
                  <p className="text-xs mt-2 text-pink-300">Supports multiple JPG, PNG, WEBP</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold text-pink-500 mb-4">Settings</h2>
                <label className="block text-sm font-medium text-pink-400 mb-2">Target Layout / Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {aspectRatios.map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                        aspectRatio === ratio 
                        ? 'bg-pink-400 border-pink-400 text-white shadow-sm' 
                        : 'bg-white border-pink-100 text-pink-400 hover:bg-pink-50 hover:text-pink-500 hover:border-pink-200'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-pink-400 mb-2">Focus Instruction (Optional)</label>
                <textarea
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="E.g., Fokus ke desain navbar dan sidebar-nya saja..."
                  className="w-full h-20 bg-white/80 border border-pink-200 rounded-xl p-3 text-sm text-gray-700 placeholder-pink-200 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 resize-none transition-colors"
                />
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={loading || files.length === 0}
              className={`mt-4 w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all duration-300 shadow-[0_4px_20px_rgba(244,114,182,0.3)] hover:shadow-[0_6px_25px_rgba(244,114,182,0.4)] ${
                loading || files.length === 0 
                ? 'bg-pink-50 text-pink-200 cursor-not-allowed shadow-none border border-pink-100' 
                : 'bg-gradient-to-r from-pink-400 to-pink-300 text-white hover:scale-[1.02]'
              }`}
            >
              {loading ? (
                <><Loader2 className="animate-spin" /> Analyzing Prompt...</>
              ) : (
                <><Code /> Generate Full-Stack Prompt</>
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
        await new Promise(res => {
          if (video.readyState >= 1) res();
          else video.onloadedmetadata = res;
        });

        const duration = video.duration;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
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
You are an expert Full-Stack Developer and UI/UX Analyst. 
Your primary goal is to reverse-engineer the provided website or application interface image(s) into a highly detailed development brief. 
You must analyze the visual Frontend (UI/UX) AND logically infer the required Backend architecture, database schema, and APIs needed to make this application functional.

Focus intensely on:
- Frontend (UI/UX): Layout structure, components, color palettes, typography, and state management needs.
- Backend & Architecture: Inferred database schema (tables/collections), necessary API endpoints (REST/GraphQL), authentication needs, and core business logic.

Rules:
- Never leave fields empty. Infer logically based on standard software engineering patterns.
- Incorporate the natural layout and aspect ratio of the video into the frontend structure.
- Your output must follow the STRICT FORMAT below. Do not deviate.
- Do not use markdown backticks (\`\`\`) around the JSON. Just output raw JSON.
${userInstructionContext}

STRICT FORMAT:
---ENGLISH PROMPT---
[A fully detailed professional brief for a Full-Stack Developer to recreate this app. Detail both the frontend UI/UX design and the underlying backend architecture needed. Minimum 100 words. No extra commentary.]
---JSON OUTPUT---
{
"app_type": "string (e.g., E-commerce platform, Admin Dashboard)",
"frontend_ui_ux": "string (layout structure, color scheme, typography, key UI components)",
"backend_logic": "string (core processing, authentication, file storage needs)",
"database_schema_inference": "string (suggested tables/models, e.g., Users, Transactions, Products)",
"api_endpoints": "string (suggested API routes, e.g., GET /api/users, POST /api/login)",
"suggested_tech_stack": "string (e.g., React, Tailwind, Node.js, Express, PostgreSQL)",
"full_prompt": "Complete optimized prompt for full-stack generation (frontend + backend), minimum 100 words."
}`;

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
      {videoUrl && <video ref={videoRef} src={videoUrl} className="hidden" muted playsInline crossOrigin="anonymous" />}
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full bg-white/70 backdrop-blur-xl border border-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-pink-50 pointer-events-none"/>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-pink-500 flex items-center gap-2">
              <Video className="text-pink-400" /> Video Upload
            </h2>
            <div 
              className={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden group ${videoUrl ? 'border-pink-200 bg-white' : 'border-pink-200 hover:border-pink-400 bg-white/50 hover:bg-pink-50/50'}`}
              onClick={() => !loading && fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4,video/webm,video/quicktime" onChange={handleFileSelect} disabled={loading}/>
              {videoUrl ? (
                <>
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                    <Play size={48} className="text-pink-400" />
                  </div>
                  <video src={videoUrl} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  {!loading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                      <span className="text-pink-500 font-medium flex items-center gap-2"><RefreshCw size={16}/> Change Video</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-pink-400 p-6">
                  <Upload className="mx-auto mb-3 w-10 h-10 text-pink-300 group-hover:text-pink-500 transition-colors" />
                  <p className="font-medium text-pink-500">Click to browse or drag video here</p>
                  <p className="text-xs mt-2 text-pink-300">MP4, WebM, MOV (Max 2 mins recommended)</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-semibold text-pink-500 mb-4">Cinematic Analysis</h2>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pink-400 rounded-full"></div>
                    Detects total duration automatically
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pink-300 rounded-full"></div>
                    Splits into 8-second cinematic segments
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                    Analyzes camera movement & action progression
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                    Maintains continuity between segment prompts
                  </li>
                </ul>
              </div>

              <div className="bg-white border border-pink-100 rounded-xl p-4 text-sm text-pink-500 leading-relaxed shadow-sm">
                <p>Note: Processing video takes time. The app will extract keyframes and send a multi-modal context to the AI for deep cinematic evaluation.</p>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={loading || !file}
              className={`mt-6 w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all duration-300 shadow-[0_4px_20px_rgba(244,114,182,0.3)] hover:shadow-[0_6px_25px_rgba(244,114,182,0.4)] ${
                loading || !file 
                ? 'bg-pink-50 text-pink-200 cursor-not-allowed shadow-none border border-pink-100' 
                : 'bg-gradient-to-r from-pink-400 to-pink-300 text-white hover:scale-[1.02]'
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
    <div className="min-h-screen bg-pink-50 text-gray-800 font-sans selection:bg-pink-200 overflow-x-hidden relative pb-20">
      {/* Background Gambar Sebelah Kiri dengan Fade (Gradasi Transparan) */}
     <div 
        className="fixed top-0 left-0 w-[40%] h-full pointer-events-none mix-blend-multiply"
        style={{
       backgroundImage: "url('/bg-kiri.jpg')",
       backgroundSize: 'cover',
        backgroundPosition: 'left center',
        opacity: '1.0', /* <--- Ubah angka ini (0.4 artinya 40%) */
         WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
       maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
  }}
/>
      
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-200/40 blur-[120px] rounded-full pointer-events-none"></div>

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

      <main className="relative z-10 px-4">
        {activeTab === 'image' ? (
          <ImageToPrompt showToast={showToast} />
        ) : (
          <VideoToPrompt showToast={showToast} />
        )}
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}