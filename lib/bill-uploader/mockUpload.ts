type UploadProgressCallback = (progress: number) => void;

type MockUploadOptions = {
  onProgress: UploadProgressCallback;
  onComplete: () => void;
};

export function startMockUpload({ onProgress, onComplete }: MockUploadOptions): () => void {
  let progress = 0;

  const intervalId = window.setInterval(() => {
    progress = Math.min(100, progress + 8 + Math.random() * 16);
    onProgress(progress);

    if (progress >= 100) {
      window.clearInterval(intervalId);
      window.setTimeout(onComplete, 250);
    }
  }, 160);

  return () => window.clearInterval(intervalId);
}
