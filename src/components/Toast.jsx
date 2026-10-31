import { useEffect } from 'react';

export default function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    error: 'bg-red-50 border-red-200 text-red-500',
    success: 'bg-green-50 border-green-200 text-green-600',
    info: 'bg-pink-50 border-pink-200 text-pink-500',
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg flex items-center gap-3 ${bgColors[type] || bgColors.info}`}>
      <span>{message}</span>
    </div>
  );
}
