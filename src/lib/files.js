const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const MAX_IMAGES = 8;

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('Could not read that file.'));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read that file.'));
  });
}

export function downloadFile(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function filterImages(fileList) {
  const images = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
  const tooBig = images.find((file) => file.size > MAX_IMAGE_BYTES);
  if (tooBig) {
    throw new Error(`${tooBig.name} is larger than 8 MB.`);
  }
  if (images.length > MAX_IMAGES) {
    throw new Error(`Upload up to ${MAX_IMAGES} images.`);
  }
  return images;
}

export function pickVideo(file) {
  if (!file || !file.type.startsWith('video/')) {
    throw new Error('Choose an MP4, WebM, or MOV file.');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video is larger than 80 MB.');
  }
  return file;
}

export function capImages(existing, incoming) {
  const next = [...existing, ...incoming];
  if (next.length > MAX_IMAGES) {
    throw new Error(`Upload up to ${MAX_IMAGES} images.`);
  }
  return next;
}
