const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '' 
  : 'http://localhost:5000';

export class ChunkUploader {
  constructor(file, options = {}) {
    this.file = file;
    // 5MB chunks (balanced size for small and large files)
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024;
    this.totalChunks = Math.ceil(file.size / this.chunkSize);
    this.uploadId = null;
    this.status = 'idle'; // idle, uploading, paused, merging, completed, error
    this.chunkIdsUploaded = new Set();
    this.currentChunkIndex = 0;
    
    // Callback handlers
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});

    // For speed calculations
    this.startTime = null;
    this.bytesUploadedOffset = 0;
    this.folderId = options.folderId || null;
    this.token = options.token || null;
    this.vault = options.vault || false;
  }

  setStatus(newStatus) {
    this.status = newStatus;
    this.onStatusChange(newStatus);
  }

  async start() {
    if (this.status === 'uploading' || this.status === 'merging') return;

    this.setStatus('uploading');
    this.startTime = Date.now();
    
    try {
      // Check localStorage for an active uploadId of this file
      const storageKey = `g00j_upload_${this.file.name}_${this.file.size}`;
      const savedUploadId = localStorage.getItem(storageKey);

      // Initialize session
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      const initResponse = await fetch(`${API_BASE}/api/upload/init`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fileName: this.file.name,
          fileSize: this.file.size,
          fileType: this.file.type,
          totalChunks: this.totalChunks,
          uploadId: savedUploadId
        })
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize upload session');
      }

      const initData = await initResponse.json();
      this.uploadId = initData.uploadId;
      localStorage.setItem(storageKey, this.uploadId);
      
      this.chunkIdsUploaded = new Set(initData.chunkIdsUploaded || []);
      
      // Calculate how many bytes we've already uploaded to offset speed tracking
      this.bytesUploadedOffset = Array.from(this.chunkIdsUploaded).reduce((acc, idx) => {
        const isLast = idx === this.totalChunks - 1;
        const currentSize = isLast ? (this.file.size - (this.totalChunks - 1) * this.chunkSize) : this.chunkSize;
        return acc + currentSize;
      }, 0);

      // Report initial progress in case some chunks are already uploaded
      this.reportProgress();

      this.uploadLoop();
    } catch (err) {
      console.error('Error starting chunked upload:', err);
      this.setStatus('error');
      this.onError(err);
    }
  }

  async uploadLoop() {
    try {
      while (this.chunkIdsUploaded.size < this.totalChunks && this.status === 'uploading') {
        // Find next chunk index to upload
        let nextIndex = 0;
        while (this.chunkIdsUploaded.has(nextIndex)) {
          nextIndex++;
        }
        
        if (nextIndex >= this.totalChunks) break;

        await this.uploadChunk(nextIndex);
      }

      if (this.status === 'uploading') {
        this.setStatus('merging');
        await this.finalizeUpload();
      }
    } catch (err) {
      if (this.status === 'uploading') {
        console.error('Error in upload loop:', err);
        this.setStatus('error');
        this.onError(err);
      }
    }
  }

  async uploadChunk(index) {
    const start = index * this.chunkSize;
    const end = Math.min(start + this.chunkSize, this.file.size);
    const chunkBlob = this.file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunkBlob, this.file.name);
    formData.append('uploadId', this.uploadId);
    formData.append('chunkIndex', index);

    const headers = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(`${API_BASE}/api/upload/chunk`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${index}`);
    }

    this.chunkIdsUploaded.add(index);
    this.reportProgress();
  }

  reportProgress() {
    const totalBytes = this.file.size;
    let uploadedBytes = 0;

    for (let i = 0; i < this.totalChunks; i++) {
      if (this.chunkIdsUploaded.has(i)) {
        const isLast = i === this.totalChunks - 1;
        uploadedBytes += isLast ? (totalBytes - (this.totalChunks - 1) * this.chunkSize) : this.chunkSize;
      }
    }

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const newBytesUploaded = uploadedBytes - this.bytesUploadedOffset;
    
    let speed = 0; // Bytes per second
    let eta = 0; // Seconds remaining

    if (elapsedSeconds > 0) {
      speed = newBytesUploaded / elapsedSeconds;
      const remainingBytes = totalBytes - uploadedBytes;
      eta = speed > 0 ? remainingBytes / speed : 0;
    }

    const progress = Math.min(Math.round((uploadedBytes / totalBytes) * 100), 100);

    this.onProgress({
      progress,
      speed: speed / (1024 * 1024), // MB/s
      eta: Math.round(eta),
      loaded: uploadedBytes,
      total: totalBytes
    });
  }

  async finalizeUpload() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(`${API_BASE}/api/upload/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uploadId: this.uploadId,
        fileName: this.file.name,
        fileType: this.file.type,
        totalChunks: this.totalChunks,
        folderId: this.folderId,
        vault: this.vault
      })
    });

    if (!response.ok) {
      throw new Error('Failed to finalize file upload merge');
    }

    const data = await response.json();
    
    // Clean storage key
    const storageKey = `g00j_upload_${this.file.name}_${this.file.size}`;
    localStorage.removeItem(storageKey);

    this.setStatus('completed');
    this.onComplete(data.file);
  }

  pause() {
    if (this.status !== 'uploading') return;
    this.setStatus('paused');
  }

  resume() {
    if (this.status !== 'paused' && this.status !== 'error') return;
    this.startTime = Date.now(); // Reset speed tracking start time
    
    // Recalculate offset based on current chunks
    this.bytesUploadedOffset = Array.from(this.chunkIdsUploaded).reduce((acc, idx) => {
      const isLast = idx === this.totalChunks - 1;
      const currentSize = isLast ? (this.file.size - (this.totalChunks - 1) * this.chunkSize) : this.chunkSize;
      return acc + currentSize;
    }, 0);

    this.setStatus('uploading');
    this.uploadLoop();
  }

  cancel() {
    this.setStatus('idle');
    const storageKey = `g00j_upload_${this.file.name}_${this.file.size}`;
    localStorage.removeItem(storageKey);
  }
}
