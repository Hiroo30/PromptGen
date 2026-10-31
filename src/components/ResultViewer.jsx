import { useState } from 'react';
import { Check, Code, Copy, Download, FileText } from 'lucide-react';
import { downloadFile } from '../lib/files';

async function copyText(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard is not available.');
  }
  await navigator.clipboard.writeText(text);
}

function ResultCard({ title, icon, text, filename, mime, mono, onCopyError }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      onCopyError?.(err.message || 'Could not copy.');
    }
  };

  return (
    <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden shadow-lg flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 bg-pink-50/50 border-b border-pink-100">
        <h3 className="font-semibold text-pink-500 flex items-center gap-2">
          {icon} {title}
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 hover:bg-pink-100 rounded-md transition-colors text-pink-400 hover:text-pink-600"
            title="Copy"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
          <button
            type="button"
            onClick={() => downloadFile(text, filename, mime)}
            className="p-2 hover:bg-pink-100 rounded-md transition-colors text-pink-400 hover:text-pink-600"
            title="Download"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className="p-4 flex-grow bg-white overflow-auto max-h-[500px]">
        <pre className={`whitespace-pre-wrap text-sm leading-relaxed ${mono ? 'font-mono text-gray-600 text-xs' : 'font-sans text-gray-700'}`}>
          {text}
        </pre>
      </div>
    </div>
  );
}

export default function ResultViewer({ englishText, jsonText, onCopyError }) {
  return (
    <div className="w-full space-y-6 mt-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResultCard
          title="English Prompt"
          icon={<FileText size={18} className="text-pink-400" />}
          text={englishText}
          filename="prompts.txt"
          mime="text/plain"
          onCopyError={onCopyError}
        />
        <ResultCard
          title="Structured Data (JSON)"
          icon={<Code size={18} className="text-pink-400" />}
          text={jsonText}
          filename="data.json"
          mime="application/json"
          mono
          onCopyError={onCopyError}
        />
      </div>
    </div>
  );
}
