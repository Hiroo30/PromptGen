function waitForEvent(target, event, { timeoutMs, signal } = {}) {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error('Timed out waiting for the video to seek.'));
    };

    const cleanup = () => {
      target.removeEventListener(event, onEvent);
      signal?.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };

    target.addEventListener(event, onEvent, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = timeoutMs ? setTimeout(onTimeout, timeoutMs) : null;
  });
}

export async function extractFrames(video, canvas, { interval = 8, maxSeconds = 120, signal, onProgress } = {}) {
  if (!video || !canvas) {
    throw new Error('Video is not ready yet.');
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('This browser cannot read video frames.');
  }

  if (video.readyState < 1) {
    await waitForEvent(video, 'loadedmetadata', { timeoutMs: 15000, signal });
  }

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration || duration <= 0) {
    throw new Error('Could not read the video duration.');
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const maxDurationToProcess = Math.min(duration, maxSeconds);
  const frames = [];

  onProgress?.('Extracting keyframes…');

  for (let t = 0; t <= maxDurationToProcess; t += interval) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    video.currentTime = t;
    await waitForEvent(video, 'seeked', { timeoutMs: 8000, signal });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    frames.push({
      time: t,
      data: dataUrl.split(',')[1],
    });
    onProgress?.(`Extracting keyframes… ${Math.min(100, Math.round((t / maxDurationToProcess) * 100))}%`);
  }

  return { duration, frames };
}
