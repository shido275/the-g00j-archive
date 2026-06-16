import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import NodeID3 from 'node-id3';
import * as mm from 'music-metadata';
import AdmZip from 'adm-zip';
import { db } from './db.js';
import { gitSync, getFolderHierarchyPath } from './gitSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

// Set up storage directories
const DATA_DIR = path.join(__dirname, 'data');
const GIT_REPO_DIR = path.join(DATA_DIR, 'github-repo');
const TEMP_DIR = path.join(DATA_DIR, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Helper to resolve the direct path inside local Git repository clone
function getGitFilePath(file) {
  const folderPath = getFolderHierarchyPath(file.folderId);
  return path.join(GIT_REPO_DIR, folderPath, file.originalName);
}

// Multer for chunk uploads (temp files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + '.tmp');
  }
});
const upload = multer({ storage });

// Categorize file by mime type
function getCategory(mimeType) {
  if (!mimeType) return 'others';
  const mainType = mimeType.split('/')[0];
  if (mainType === 'image') return 'images';
  if (mainType === 'video') return 'videos';
  if (mainType === 'audio') return 'audio';
  
  const docs = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/rtf',
    'text/csv',
    'text/html',
    'text/css',
    'application/javascript',
    'application/json'
  ];
  if (docs.includes(mimeType) || mimeType.startsWith('text/')) return 'documents';

  const archives = [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/x-7z-compressed',
    'application/x-gzip',
    'application/gzip',
    'application/x-bzip2'
  ];
  if (archives.includes(mimeType)) return 'archives';

  return 'others';
}

// Initialize chunked upload
app.post('/api/upload/init', (req, res) => {
  try {
    const { fileName, fileSize, fileType, totalChunks, uploadId: clientUploadId } = req.body;
    
    if (!fileName || !fileSize || !totalChunks) {
      return res.status(400).json({ error: 'Missing required initialization details' });
    }

    // Reuse uploadId if resuming, or generate new
    const uploadId = clientUploadId || uuidv4();
    const chunkDir = path.join(TEMP_DIR, uploadId);
    
    let chunkIdsUploaded = [];
    if (fs.existsSync(chunkDir)) {
      const files = fs.readdirSync(chunkDir);
      chunkIdsUploaded = files
        .map(f => parseInt(f, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
    } else {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    res.json({
      uploadId,
      chunkIdsUploaded
    });
  } catch (error) {
    console.error('Upload init error:', error);
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
});

// Receive a chunk
app.post('/api/upload/chunk', upload.single('chunk'), (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    if (!uploadId || chunkIndex === undefined) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Missing uploadId or chunkIndex' });
    }

    const chunkDir = path.join(TEMP_DIR, uploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const finalChunkPath = path.join(chunkDir, String(chunkIndex));
    fs.renameSync(req.file.path, finalChunkPath);

    res.json({ success: true, message: `Chunk ${chunkIndex} saved` });
  } catch (error) {
    console.error('Chunk upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {}
    }
    res.status(500).json({ error: 'Failed to save chunk' });
  }
});

// Complete chunked upload and merge
app.post('/api/upload/complete', async (req, res) => {
  const { uploadId, fileName, fileType, totalChunks, folderId } = req.body;
  if (!uploadId || !fileName || !totalChunks) {
    return res.status(400).json({ error: 'Missing complete payload' });
  }

  const chunkDir = path.join(TEMP_DIR, uploadId);
  const fileId = uuidv4() + path.extname(fileName);
  const folderPath = getFolderHierarchyPath(folderId);
  const destDir = path.join(GIT_REPO_DIR, folderPath);
  fs.mkdirSync(destDir, { recursive: true });
  const finalPath = path.join(destDir, fileName);

  if (!fs.existsSync(chunkDir)) {
    return res.status(404).json({ error: 'Upload session not found' });
  }

  const writeStream = fs.createWriteStream(finalPath);

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, String(i));
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Chunk ${i} is missing`);
      }
      
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', (err) => {
          console.error(`Stream error in chunk ${i}:`, err);
          reject(err);
        });
      });
    }

    writeStream.end();

    // Wait for the write stream to finish closing
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Cleanup temp directory
    fs.rmSync(chunkDir, { recursive: true, force: true });

    // Detect mime type
    const resolvedMime = mime.lookup(fileName) || fileType || 'application/octet-stream';
    const category = getCategory(resolvedMime);
    const stats = fs.statSync(finalPath);

    const newFile = {
      id: fileId,
      originalName: fileName,
      savedName: fileId,
      size: stats.size,
      mimeType: resolvedMime,
      category,
      uploadDate: new Date().toISOString(),
      folderId: folderId || null
    };

    db.saveFile(newFile);
    gitSync.queueUpload(newFile);

    res.json({ success: true, file: newFile });
  } catch (error) {
    console.error('Merge chunks error:', error);
    // Cleanup partial write
    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    res.status(500).json({ error: 'Failed to merge chunks and finalize file' });
  }
});

// Get all files
app.get('/api/files', (req, res) => {
  try {
    const { category, search, folderId } = req.query;
    let files = db.getFiles();

    if (category && category !== 'all') {
      files = files.filter(f => f.category === category);
    }

    if (search) {
      const query = search.toLowerCase();
      files = files.filter(f => f.originalName.toLowerCase().includes(query));
    }

    // Only filter files by directory path if search is not active (search does a global query)
    if (!search) {
      const targetFolderId = folderId === 'root' || !folderId ? null : folderId;
      files = files.filter(f => f.folderId === targetFolderId);
    }

    res.json(files);
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get folders list
app.get('/api/folders', (req, res) => {
  try {
    const { parentId, all } = req.query;
    let folders = db.getFolders();
    
    if (all === 'true') {
      return res.json(folders);
    }
    
    const targetParentId = parentId === 'root' || !parentId ? null : parentId;
    folders = folders.filter(f => f.parentId === targetParentId);
    
    res.json(folders);
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Create a folder
app.post('/api/folders', (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const targetParentId = parentId === 'root' || !parentId ? null : parentId;
    const newFolder = {
      id: uuidv4(),
      name,
      parentId: targetParentId,
      createdDate: new Date().toISOString()
    };

    db.saveFolder(newFolder);
    res.json(newFolder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Recursive folder deletion helper
function deleteFolderRecursive(folderId) {
  const allFolders = db.getFolders();
  const subfolders = allFolders.filter(f => f.parentId === folderId);
  
  // 1. Recursive delete contents of nested subfolders
  for (const sub of subfolders) {
    deleteFolderRecursive(sub.id);
  }

  // 2. Delete files directly residing in this folder
  const allFiles = db.getFiles();
  const filesInFolder = allFiles.filter(f => f.folderId === folderId);
  
  for (const file of filesInFolder) {
    const filePath = getGitFilePath(file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to physically delete file ${filePath}:`, err);
      }
    }
    
    // Clean up temporary chunks folder if any exist
    const tempDir = path.join(TEMP_DIR, file.id);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    gitSync.queueDelete(file);
    db.deleteFile(file.id);
  }

  // 3. Delete the folder entry itself
  db.deleteFolder(folderId);
}

// Delete folder and all its contents recursively
app.delete('/api/folders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const folder = db.getFolder(id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    deleteFolderRecursive(id);
    res.json({ success: true, message: 'Folder and all its contents deleted recursively' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Download/Stream file with support for HTTP Range requests
app.get('/api/files/download/:id', (req, res) => {
  try {
    const file = db.getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = getGitFilePath(file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file not found on disk' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Handle standard download vs inline streaming preview
    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    }
    res.setHeader('Content-Type', file.mimeType);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).send('Requested range not satisfiable');
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': file.mimeType,
      };

      res.writeHead(206, head);
      fileStream.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': file.mimeType,
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

// Delete file
app.delete('/api/files/:id', (req, res) => {
  try {
    const file = db.getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = getGitFilePath(file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Clean up temporary chunks folder if any exist
    const tempDir = path.join(TEMP_DIR, req.params.id);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    gitSync.queueDelete(file);
    db.deleteFile(req.params.id);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

const TRUSTED_DOMAINS = [
  'github.com',
  'githubusercontent.com',
  'sourceforge.net',
  'gitlab.com',
  'bitbucket.org',
  'archive.org',
  'localhost',
  '127.0.0.1'
];

function isTrustedUrl(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch (e) {
    return false;
  }
}

// Scraper endpoint helper
function getScrapedLinkDetails(linkUrl, baseUrl, isParentTrusted = false) {
  try {
    const absoluteUrl = new URL(linkUrl, baseUrl).href;
    const parsedUrl = new URL(absoluteUrl);
    const pathname = parsedUrl.pathname;
    const fileName = path.basename(pathname) || 'downloaded-file';
    
    // If the path ends with a slash, it's a directory, not a downloadable file
    if (pathname.endsWith('/')) {
      return null;
    }

    const ext = path.extname(fileName).toLowerCase();

    // Must have a file extension to be considered a downloadable file
    if (ext.length <= 1) {
      return null;
    }

    // Blacklist of dangerous system helper/scripts (never allowed)
    const dangerousScriptExts = ['.bat', '.cmd', '.sh', '.vbs', '.js', '.com', '.scr', '.pif', '.hta', '.cpl', '.msu'];
    if (dangerousScriptExts.includes(ext)) {
      return null;
    }

    // Executables or installer packages that are ONLY allowed if from a trusted domain
    const restrictedAppExts = ['.exe', '.msi', '.deb', '.appimage', '.dmg'];
    const trusted = isParentTrusted || isTrustedUrl(absoluteUrl);
    if (restrictedAppExts.includes(ext) && !trusted) {
      return null;
    }

    // Keyword protection
    const suspiciousKeywords = ['malware', 'virus', 'keygens', 'cracked', 'spyware', 'adware', 'phishing', 'exploit'];
    const urlString = absoluteUrl.toLowerCase();
    if (suspiciousKeywords.some(kw => urlString.includes(kw))) {
      return null;
    }

    return {
      url: absoluteUrl,
      fileName: decodeURIComponent(fileName),
      extension: ext
    };
  } catch (err) {
    return null;
  }
}

// Scrape a trusted webpage for direct downloads (1 level deep)
async function subScrapeTrustedPage(url, seenUrls) {
  const subDownloads = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout to keep it responsive

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) return subDownloads;
    const html = await response.text();

    const hrefRegex = /href=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
    const srcRegex = /src=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
    const actionRegex = /action=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
    const dataUrlRegex = /data-(?:href|url|link)=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
    const onclickRegex = /(?:window\.)?(?:location\.)?(?:href|assign|replace)\s*[(=\s]+["'](https?:\/\/[^"']+|[^"']+)["']/gi;

    const subLinks = new Set();
    let match;
    while ((match = hrefRegex.exec(html)) !== null) subLinks.add(match[1]);
    while ((match = srcRegex.exec(html)) !== null) subLinks.add(match[1]);
    while ((match = actionRegex.exec(html)) !== null) subLinks.add(match[1]);
    while ((match = dataUrlRegex.exec(html)) !== null) subLinks.add(match[1]);
    while ((match = onclickRegex.exec(html)) !== null) subLinks.add(match[1]);

    for (const subLink of subLinks) {
      const details = getScrapedLinkDetails(subLink, url, true); // parent is trusted (e.g. github)
      if (details && !seenUrls.has(details.url)) {
        seenUrls.add(details.url);
        subDownloads.push(details);
      }
    }
  } catch (err) {
    console.error(`Sub-scraping failed for ${url}:`, err.message);
  }
  return subDownloads;
}

function isSubdirectoryUrl(linkUrl, baseUrl) {
  try {
    const parent = new URL(baseUrl);
    const child = new URL(linkUrl);
    
    // Host must match exactly
    if (parent.hostname !== child.hostname) {
      return false;
    }
    
    // Must be a descendant of the parent path
    const parentPath = parent.pathname.endsWith('/') ? parent.pathname : parent.pathname + '/';
    if (!child.pathname.startsWith(parentPath)) {
      return false;
    }
    
    // Ignore parent directories (contains '..')
    if (child.pathname.includes('..')) {
      return false;
    }

    // Must not be the parent path itself
    if (child.pathname === parentPath || child.href === parent.href) {
      return false;
    }

    // Must not have a real file extension (excluding purely numeric ones like .1, or .html)
    let cleanPath = child.pathname;
    if (cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    const fileName = path.basename(cleanPath) || '';
    const ext = path.extname(fileName).toLowerCase();
    
    const isRealExtension = ext.length > 1 && !/^\.\d+$/.test(ext) && ext !== '.html';
    if (isRealExtension) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Crawl a page and extract direct downloads or recursively follow subdirectories
// Crawl a page and extract direct downloads or recursively follow subdirectories
async function scrapeAllPageDownloads(pageUrl) {
  const safeDownloads = [];
  const seenUrls = new Set();
  const visitedDirs = new Set();
  const trustedPagesToScrape = [];
  
  visitedDirs.add(pageUrl);
  seenUrls.add(pageUrl);

  const maxDepth = 10;
  const maxDirsToCrawl = 1000;
  const maxFilesToDiscover = 2000;
  
  const queue = [{ url: pageUrl, depth: 0 }];
  let crawledDirsCount = 0;
  let resolvedBaseUrl = pageUrl;
  let resolvedBaseUrlUpdated = false;

  const CONCURRENCY = 10;
  const activeFetches = new Set();

  while ((queue.length > 0 || activeFetches.size > 0) &&
         crawledDirsCount < maxDirsToCrawl &&
         safeDownloads.length < maxFilesToDiscover) {
    
    if (queue.length > 0 && activeFetches.size < CONCURRENCY) {
      const current = queue.shift();
      const currentUrl = current.url;
      const currentDepth = current.depth;
      crawledDirsCount++;

      const fetchPromise = (async () => {
        console.log(`[Scraper] Crawling index directory (depth ${currentDepth}): ${currentUrl}`);
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout per page

          const response = await fetch(currentUrl, { signal: controller.signal });
          clearTimeout(timeout);
          
          if (!response.ok) return;

          // If this is the initial base URL fetch, update resolvedBaseUrl to handle mirror redirects
          if (currentUrl === pageUrl && !resolvedBaseUrlUpdated) {
            resolvedBaseUrl = response.url;
            resolvedBaseUrlUpdated = true;
            console.log(`[Scraper] Resolved initial page URL redirect to base: ${resolvedBaseUrl}`);
          }

          const html = await response.text();

          const hrefRegex = /href=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
          const srcRegex = /src=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
          const actionRegex = /action=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
          const dataUrlRegex = /data-(?:href|url|link)=["'](https?:\/\/[^"']+|[^"']+)["']/gi;
          const onclickRegex = /(?:window\.)?(?:location\.)?(?:href|assign|replace)\s*[(=\s]+["'](https?:\/\/[^"']+|[^"']+)["']/gi;
          
          const rawLinks = new Set();
          let match;
          while ((match = hrefRegex.exec(html)) !== null) rawLinks.add(match[1]);
          while ((match = srcRegex.exec(html)) !== null) rawLinks.add(match[1]);
          while ((match = actionRegex.exec(html)) !== null) rawLinks.add(match[1]);
          while ((match = dataUrlRegex.exec(html)) !== null) rawLinks.add(match[1]);
          while ((match = onclickRegex.exec(html)) !== null) rawLinks.add(match[1]);

          for (const link of rawLinks) {
            if (safeDownloads.length >= maxFilesToDiscover) break;
            try {
              const absoluteUrl = new URL(link, currentUrl).href;
              const details = getScrapedLinkDetails(absoluteUrl, currentUrl, false);
              
              if (details) {
                if (!seenUrls.has(details.url)) {
                  seenUrls.add(details.url);
                  safeDownloads.push(details);
                }
              } else {
                // Check if it is a subdirectory to recurse into
                if (isSubdirectoryUrl(absoluteUrl, resolvedBaseUrl)) {
                  if (!visitedDirs.has(absoluteUrl) && currentDepth < maxDepth) {
                    visitedDirs.add(absoluteUrl);
                    queue.push({ url: absoluteUrl, depth: currentDepth + 1 });
                  }
                } else {
                  // Check if it's a trusted landing page redirect to follow
                  const parsed = new URL(absoluteUrl);
                  const pathname = parsed.pathname;
                  const fileName = path.basename(pathname) || '';
                  const ext = path.extname(fileName).toLowerCase();
                  if ((ext.length <= 1 || ext === '.html') && isTrustedUrl(absoluteUrl)) {
                    if (!seenUrls.has(absoluteUrl)) {
                      seenUrls.add(absoluteUrl);
                      trustedPagesToScrape.push(absoluteUrl);
                    }
                  }
                }
              }
            } catch (err) {}
          }
        } catch (err) {
          console.error(`[Scraper] Failed to fetch directory page ${currentUrl}:`, err.message);
        }
      })();

      activeFetches.add(fetchPromise);
      fetchPromise.finally(() => {
        activeFetches.delete(fetchPromise);
      });
    } else {
      // Wait for at least one fetch to complete before looping again
      await Promise.race(activeFetches);
    }
  }

  // Follow any queued trusted redirects (like github pages)
  const pagesToScan = trustedPagesToScrape.slice(0, 5);
  for (const subUrl of pagesToScan) {
    if (safeDownloads.length >= maxFilesToDiscover) break;
    console.log(`[Scraper] Sub-scraping trusted redirect landing page: ${subUrl}`);
    const subDownloads = await subScrapeTrustedPage(subUrl, seenUrls);
    safeDownloads.push(...subDownloads);
  }

  return safeDownloads.slice(0, maxFilesToDiscover);
}

// Scrape URL for safe downloadable contents
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const downloads = await scrapeAllPageDownloads(url);
    res.json({ success: true, url, downloads });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: `Scraping failed: ${error.message}` });
  }
});

// Download scraped URL directly to G00J Archives
app.post('/api/scrape/download', async (req, res) => {
  const { url, folderId } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const remoteResponse = await fetch(url);
    if (!remoteResponse.ok || !remoteResponse.body) {
      return res.status(400).json({ error: `Failed to fetch remote file (HTTP ${remoteResponse.status})` });
    }

    let fileName = 'downloaded-file';
    const contentDisposition = remoteResponse.headers.get('content-disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
      if (filenameMatch) {
        fileName = decodeURIComponent(filenameMatch[1]);
      }
    } else {
      const pathname = new URL(url).pathname;
      fileName = path.basename(pathname) || 'downloaded-file';
    }

    const fileId = uuidv4() + path.extname(fileName);
    const resolvedMime = remoteResponse.headers.get('content-type') || mime.lookup(fileName) || 'application/octet-stream';
    const category = getCategory(resolvedMime);
    const folderPath = getFolderHierarchyPath(folderId);
    const destDir = path.join(GIT_REPO_DIR, folderPath);
    fs.mkdirSync(destDir, { recursive: true });
    const targetPath = path.join(destDir, fileName);

    const writer = fs.createWriteStream(targetPath);
    const reader = remoteResponse.body.getReader();

    await new Promise(async (resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            writer.end();
            break;
          }
          writer.write(Buffer.from(value));
        }
      } catch (err) {
        writer.end();
        reject(err);
      }
    });

    const stats = fs.statSync(targetPath);
    
    const newFile = {
      id: fileId,
      originalName: fileName,
      savedName: fileId,
      size: stats.size,
      mimeType: resolvedMime,
      category,
      uploadDate: new Date().toISOString(),
      folderId: folderId === 'root' || !folderId ? null : folderId
    };

    db.saveFile(newFile);
    gitSync.queueUpload(newFile);
    res.json({ success: true, file: newFile });
  } catch (error) {
    console.error('Remote download error:', error);
    res.status(500).json({ error: `Remote download failed: ${error.message}` });
  }
});

// Get all scraping jobs
app.get('/api/scraper/jobs', (req, res) => {
  try {
    res.json(db.getJobs());
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch scraper jobs' });
  }
});

// Save/edit a scraper job
app.post('/api/scraper/jobs', (req, res) => {
  try {
    const { id, url, folderId, schedule, active } = req.body;
    if (!url || !schedule) {
      return res.status(400).json({ error: 'URL and schedule are required' });
    }

    const jobId = id || uuidv4();
    const existingJob = id ? db.getJob(id) : null;
    const targetFolderId = folderId === 'root' || !folderId ? null : folderId;

    const job = {
      id: jobId,
      url,
      folderId: targetFolderId,
      schedule,
      active: active !== undefined ? active : true,
      lastRun: existingJob ? existingJob.lastRun : null,
      nextRun: existingJob ? existingJob.nextRun : null,
      downloadedUrls: existingJob ? (existingJob.downloadedUrls || []) : []
    };

    if (!existingJob) {
      // Run immediately on scheduler start
      job.nextRun = new Date().toISOString();
    }

    db.saveJob(job);
    res.json(job);
  } catch (error) {
    console.error('Save scraper job error:', error);
    res.status(500).json({ error: 'Failed to save scraper job' });
  }
});

// Delete scraper job
app.delete('/api/scraper/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteJob(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Scraper job not found' });
    }
    res.json({ success: true, message: 'Scraper job deleted' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete scraper job' });
  }
});

// Get storage metrics/stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to calculate stats' });
  }
});

// Mock target website for scraper testing
app.get('/api/test-scrape-target', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Mock Downloads Site</h1>
        <a href="/api/test-mock-pdf.pdf">Relative Safe PDF</a>
        <a href="https://example.com/mock-archive.zip">Absolute Safe ZIP</a>
        <a href="https://suspicious-malware-domain.com/free-cracked-installer.exe">Dangerous Malware Executable</a>
        <a href="/api/test-mock-vbs-script.vbs">Dangerous VBScript File</a>
        <a href="/api/test-mock-disk.iso">Kali Linux ISO</a>
        <a href="/api/test-mock-image.img">Raspberry Pi OS Image</a>
        <a href="/api/test-mock-file.torrent">Ubuntu Torrent</a>
        <a href="/api/test-mock-video.mp4">Demo Video</a>
      </body>
    </html>
  `);
});

// Mock recursive directory index for repository crawler testing
app.get('/api/test-recursive-repo', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Mock Repository Root</h1>
        <!-- Subdirectories -->
        <a href="/api/test-recursive-repo/current/">current/</a>
        <a href="/api/test-recursive-repo/kali-2026.1/">kali-2026.1/</a>
        <!-- Parent/relative navigation links that should be ignored -->
        <a href="../">Parent Directory</a>
        <a href="/api/test-scrape-target">External target page</a>
        <!-- Root files -->
        <a href="/api/test-recursive-repo/root-readme.txt">Readme.txt</a>
      </body>
    </html>
  `);
});

app.get('/api/test-recursive-repo/current/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Current Release Directory</h1>
        <a href="current-installer.iso">current-installer.iso</a>
        <a href="current-live-amd64.iso">current-live-amd64.iso</a>
        <a href="../">Parent Directory</a>
      </body>
    </html>
  `);
});

app.get('/api/test-recursive-repo/kali-2026.1/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Kali 2026.1 Directory</h1>
        <a href="installer-2026.1.iso">installer-2026.1.iso</a>
        <a href="amd64/">amd64/</a>
        <a href="../">Parent Directory</a>
      </body>
    </html>
  `);
});

app.get('/api/test-recursive-repo/kali-2026.1/amd64/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Kali 2026.1 amd64 Subdirectory</h1>
        <a href="kali-linux-2026.1-live-amd64.img">kali-linux-2026.1-live-amd64.img</a>
        <a href="../">Parent Directory</a>
      </body>
    </html>
  `);
});

// Mock PDF download file route for offline testing
app.get('/api/test-mock-pdf.pdf', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.alloc(1024, 'P')); // Send 1KB PDF mock
});

// Mock advanced redirect and button/icon target for testing
app.get('/api/test-scrape-redirect', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Mock Portal</h1>
        <!-- Form action download button -->
        <form action="/api/test-mock-pdf.pdf">
          <button type="submit">Download PDF Button</button>
        </form>
        <!-- Onclick script redirect -->
        <div class="download-icon" onclick="window.location.href='/api/test-mock-pdf.pdf'">Download Icon</div>
        <!-- Custom data-url attribute link -->
        <span class="btn" data-url="https://example.com/mock-archive.zip">Download ZIP</span>
        <!-- Redirect to trusted github site (simulated via localhost endpoint) -->
        <a href="http://localhost:5000/api/test-mock-github-page">GitHub Project Releases</a>
      </body>
    </html>
  `);
});

// Mock trusted github page
app.get('/api/test-mock-github-page', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>GitHub Test Release Page</h1>
        <!-- Allowed executables and packages since parent domain is trusted localhost -->
        <a href="/api/test-mock-app.exe">App Installer EXE</a>
        <a href="/api/test-mock-package.deb">Debian Package DEB</a>
        <a href="/api/test-mock-package.appimage">AppImage Binary</a>
        
        <!-- Script file which should STILL be blocked because it is globally dangerous -->
        <a href="/api/test-dangerous-script.bat">System Script BAT</a>
      </body>
    </html>
  `);
});

// Mock downloads for redirects
app.get('/api/test-mock-app.exe', (req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.alloc(1024, 'E'));
});
app.get('/api/test-mock-package.deb', (req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.alloc(1024, 'D'));
});
app.get('/api/test-mock-package.appimage', (req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.alloc(1024, 'A'));
});
app.get('/api/test-dangerous-script.bat', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('@echo off\nexit');
});

// Background downloader helper for scheduler job
async function runScraperDownload(job) {
  try {
    const safeDownloads = await scrapeAllPageDownloads(job.url);
    console.log(`[Scheduler] Scraper job ${job.id} found ${safeDownloads.length} safe downloads.`);

    const downloadedUrls = job.downloadedUrls || [];
    for (const item of safeDownloads) {
      if (downloadedUrls.includes(item.url)) {
        continue;
      }

      console.log(`[Scheduler] Job ${job.id} downloading remote file: ${item.url}`);
      try {
        const remoteResponse = await fetch(item.url);
        if (!remoteResponse.ok || !remoteResponse.body) {
          console.error(`[Scheduler] Failed to fetch remote file ${item.url} (HTTP ${remoteResponse.status})`);
          continue;
        }

        let fileName = item.fileName || 'downloaded-file';
        const contentDisposition = remoteResponse.headers.get('content-disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
          if (filenameMatch) {
            fileName = decodeURIComponent(filenameMatch[1]);
          }
        }

        const fileId = uuidv4() + path.extname(fileName);
        const resolvedMime = remoteResponse.headers.get('content-type') || mime.lookup(fileName) || 'application/octet-stream';
        const category = getCategory(resolvedMime);
        const folderPath = getFolderHierarchyPath(job.folderId);
        const destDir = path.join(GIT_REPO_DIR, folderPath);
        fs.mkdirSync(destDir, { recursive: true });
        const targetPath = path.join(destDir, fileName);

        const writer = fs.createWriteStream(targetPath);
        const reader = remoteResponse.body.getReader();

        await new Promise(async (resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                writer.end();
                break;
              }
              writer.write(Buffer.from(value));
            }
          } catch (err) {
            writer.end();
            reject(err);
          }
        });

        const stats = fs.statSync(targetPath);
        const newFile = {
          id: fileId,
          originalName: fileName,
          savedName: fileId,
          size: stats.size,
          mimeType: resolvedMime,
          category,
          uploadDate: new Date().toISOString(),
          folderId: job.folderId
        };

        db.saveFile(newFile);
        gitSync.queueUpload(newFile);
        db.addDownloadedUrl(job.id, item.url);
        console.log(`[Scheduler] Job ${job.id} successfully saved: ${fileName} as ${fileId}`);
      } catch (err) {
        console.error(`[Scheduler] Job ${job.id} failed to download ${item.url}:`, err);
      }
    }
  } catch (error) {
    console.error(`[Scheduler] Job ${job.id} failed to scrape:`, error);
  }
}

// Scheduler Daemon Loop
async function processScraperJobs() {
  try {
    const jobs = db.getJobs();
    const activeJobs = jobs.filter(j => j.active !== false);
    const now = new Date();

    for (const job of activeJobs) {
      let shouldRun = false;
      
      if (!job.lastRun) {
        shouldRun = true;
      } else {
        const lastRunDate = new Date(job.lastRun);
        const timeDiff = now.getTime() - lastRunDate.getTime();
        
        if (job.schedule === 'once') {
          shouldRun = false; // already ran once
        } else if (job.schedule === 'weekly') {
          shouldRun = timeDiff >= 7 * 24 * 60 * 60 * 1000;
        } else if (job.schedule === 'monthly') {
          shouldRun = timeDiff >= 30 * 24 * 60 * 60 * 1000;
        } else if (job.schedule === 'quarterly') {
          shouldRun = timeDiff >= 90 * 24 * 60 * 60 * 1000;
        }
      }

      if (shouldRun) {
        console.log(`[Scheduler] Running scraper job: ${job.id} for ${job.url}`);
        
        // Update next run dates
        let nextRun = null;
        if (job.schedule === 'weekly') {
          nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (job.schedule === 'monthly') {
          nextRun = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        } else if (job.schedule === 'quarterly') {
          nextRun = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }

        job.lastRun = now.toISOString();
        job.nextRun = nextRun;
        if (job.schedule === 'once') {
          job.active = false;
        }
        db.saveJob(job);

        runScraperDownload(job).catch(err => {
          console.error(`[Scheduler] Scraper job ${job.id} failed:`, err);
        });
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error processing scraper jobs:', error);
  }
}

// MusicBrainz Recording Search Proxy
app.get('/api/musicbrainz/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  try {
    const response = await fetch(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json`, {
      headers: {
        'User-Agent': 'G00JArchives/1.0.0 ( shido275@github.com )'
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `MusicBrainz API error (HTTP ${response.status})` });
    }
    const data = await response.json();
    
    // Map to a clean, easy-to-use structure for the client
    const recordings = (data.recordings || []).map(rec => {
      const artist = (rec['artist-credit'] || []).map(ac => ac.name).join('');
      const releases = (rec.releases || []).map(rel => ({
        id: rel.id,
        title: rel.title,
        date: rel.date || '',
        trackCount: rel['track-count'] || 0,
        country: rel.country || ''
      }));
      return {
        id: rec.id,
        title: rec.title,
        artist,
        duration: rec.length ? Math.round(rec.length / 1000) : null,
        releases
      };
    });
    res.json(recordings);
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    res.status(500).json({ error: `Failed to search MusicBrainz: ${error.message}` });
  }
});

// Cover Art Archive Image URL Proxy
app.get('/api/musicbrainz/cover/:releaseId', async (req, res) => {
  const { releaseId } = req.params;
  try {
    const response = await fetch(`https://coverartarchive.org/release/${releaseId}`, {
      headers: {
        'User-Agent': 'G00JArchives/1.0.0 ( shido275@github.com )'
      }
    });
    if (response.status === 404) {
      return res.json({ coverUrl: null });
    }
    if (!response.ok) {
      return res.status(response.status).json({ error: `Cover Art Archive error (HTTP ${response.status})` });
    }
    const data = await response.json();
    const frontImage = (data.images || []).find(img => img.front);
    const coverUrl = frontImage ? (frontImage.thumbnails?.['500'] || frontImage.thumbnails?.large || frontImage.image) : null;
    res.json({ coverUrl });
  } catch (error) {
    console.error('Cover Art Archive error:', error);
    res.status(500).json({ error: `Failed to fetch cover art metadata: ${error.message}` });
  }
});

// Get existing metadata and cover art of an audio file
app.get('/api/files/:id/metadata', async (req, res) => {
  try {
    const file = db.getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    const filePath = getGitFilePath(file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file not found on disk' });
    }

    let parsedTags = {};
    let coverArtBase64 = null;
    try {
      const mmData = await mm.parseFile(filePath);
      if (mmData && mmData.common) {
        parsedTags = {
          title: mmData.common.title || '',
          artist: mmData.common.artist || '',
          album: mmData.common.album || '',
          year: mmData.common.year || '',
          genre: mmData.common.genre ? mmData.common.genre.join(', ') : '',
          trackNumber: mmData.common.track && mmData.common.track.no ? String(mmData.common.track.no) : '',
          albumArtist: mmData.common.albumartist || '',
          composer: mmData.common.composer ? mmData.common.composer.join(', ') : '',
          publisher: mmData.common.label ? mmData.common.label.join(', ') : '',
          bpm: mmData.common.bpm ? String(mmData.common.bpm) : '',
          discNumber: mmData.common.disk && mmData.common.disk.no ? String(mmData.common.disk.no) : '',
          comment: mmData.common.comment && mmData.common.comment[0] ? mmData.common.comment[0].text : ''
        };
        if (mmData.common.picture && mmData.common.picture.length > 0) {
          const pic = mmData.common.picture[0];
          coverArtBase64 = `data:${pic.format};base64,${pic.data.toString('base64')}`;
        }
      }
    } catch (err) {
      console.warn(`Could not read physical tags from ${filePath}:`, err.message);
    }

    res.json({
      success: true,
      fileId: file.id,
      fileName: file.originalName,
      tags: {
        title: file.title || parsedTags.title || '',
        artist: file.artist || parsedTags.artist || '',
        album: file.album || parsedTags.album || '',
        year: file.year || parsedTags.year || '',
        genre: file.genre || parsedTags.genre || '',
        trackNumber: file.trackNumber || parsedTags.trackNumber || '',
        albumArtist: file.albumArtist || parsedTags.albumArtist || '',
        composer: file.composer || parsedTags.composer || '',
        publisher: file.publisher || parsedTags.publisher || '',
        bpm: file.bpm || parsedTags.bpm || '',
        discNumber: file.discNumber || parsedTags.discNumber || '',
        comment: file.comment || parsedTags.comment || ''
      },
      coverArt: coverArtBase64
    });
  } catch (error) {
    console.error('Get file metadata error:', error);
    res.status(500).json({ error: `Failed to fetch file metadata: ${error.message}` });
  }
});

// Update tags of a file and DB record, sync to git
app.post('/api/files/:id/tag', async (req, res) => {
  const { id } = req.params;
  const { 
    title, artist, album, year, genre, trackNumber, coverArtUrl,
    albumArtist, composer, publisher, bpm, discNumber, comment
  } = req.body;

  try {
    const file = db.getFile(id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = getGitFilePath(file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file not found on disk' });
    }

    const isMp3 = file.originalName.toLowerCase().endsWith('.mp3');

    if (isMp3) {
      const tags = {
        title: title || '',
        artist: artist || '',
        album: album || '',
        year: year ? String(year) : undefined,
        genre: genre ? String(genre) : undefined,
        trackNumber: trackNumber ? String(trackNumber) : undefined,
        performerInfo: albumArtist || '', // Band/Album Artist
        TPE2: albumArtist || '',          // Album Artist raw frame
        composer: composer || '',
        publisher: publisher || '',
        TPUB: publisher || '',            // Publisher raw frame
        bpm: bpm ? String(bpm) : undefined,
        partOfSet: discNumber ? String(discNumber) : undefined,
        comment: comment ? { language: 'eng', text: String(comment) } : undefined
      };

      let existingTags = {};
      try {
        existingTags = NodeID3.read(filePath) || {};
      } catch (err) {
        console.warn('Could not read existing ID3 tags:', err.message);
      }

      if (coverArtUrl) {
        try {
          let buffer;
          let contentType;

          if (coverArtUrl.startsWith('data:')) {
            const matches = coverArtUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              contentType = matches[1];
              buffer = Buffer.from(matches[2], 'base64');
            } else {
              throw new Error('Invalid base64 data URI format');
            }
          } else if (coverArtUrl.includes('/api/files/download/')) {
            const parts = coverArtUrl.split('/api/files/download/');
            const targetFileId = parts[1].split('?')[0];
            const targetFile = db.getFile(targetFileId);
            if (targetFile) {
              const targetFilePath = getGitFilePath(targetFile);
              if (fs.existsSync(targetFilePath)) {
                buffer = fs.readFileSync(targetFilePath);
                contentType = targetFile.mimeType;
              } else {
                throw new Error(`Archive file not found on disk: ${targetFilePath}`);
              }
            } else {
              throw new Error(`Archive file record not found: ${targetFileId}`);
            }
          }

          // Fallback to fetch
          if (!buffer) {
            const imgResponse = await fetch(coverArtUrl);
            if (imgResponse.ok) {
              const arrayBuf = await imgResponse.arrayBuffer();
              buffer = Buffer.from(arrayBuf);
              contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
            } else {
              throw new Error(`HTTP ${imgResponse.status} trying to fetch remote cover`);
            }
          }

          if (buffer) {
            tags.image = {
              mime: contentType,
              type: { id: 3, name: 'front cover' },
              description: 'Cover Art',
              imageBuffer: buffer
            };
          }
        } catch (err) {
          console.error('Failed to parse or fetch cover art:', err.message);
        }
      } else if (coverArtUrl === null || coverArtUrl === '') {
        // Remove image (do not set tags.image)
      } else if (existingTags.image) {
        // Retain existing image
        tags.image = existingTags.image;
      }

      // Write tags to the physical file
      const writeSuccess = NodeID3.write(tags, filePath);
      if (!writeSuccess) {
        throw new Error('Failed to write ID3 tags to physical file');
      }

      // Update size in db
      const stats = fs.statSync(filePath);
      file.size = stats.size;
    }

    // Save metadata fields to database file record
    file.title = title || '';
    file.artist = artist || '';
    file.album = album || '';
    file.year = year || '';
    file.genre = genre || '';
    file.trackNumber = trackNumber || '';
    file.albumArtist = albumArtist || '';
    file.composer = composer || '';
    file.publisher = publisher || '';
    file.bpm = bpm || '';
    file.discNumber = discNumber || '';
    file.comment = comment || '';

    db.saveFile(file);

    // Sync to GitHub clone folder
    gitSync.queueUpload(file);

    res.json({ success: true, file });
  } catch (error) {
    console.error('Write tags error:', error);
    res.status(500).json({ error: `Failed to write tags to file: ${error.message}` });
  }
});

// Generate distribution ZIP package (audio, cover art, metadata report)
app.get('/api/files/:id/distribute', async (req, res) => {
  try {
    const file = db.getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    const filePath = getGitFilePath(file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file not found on disk' });
    }

    const zip = new AdmZip();

    // Add audio file
    zip.addLocalFile(filePath, '', file.originalName);

    // Extract cover art if any
    let picBuffer = null;
    let picMime = 'image/jpeg';
    try {
      const mmData = await mm.parseFile(filePath);
      if (mmData && mmData.common && mmData.common.picture && mmData.common.picture.length > 0) {
        picBuffer = mmData.common.picture[0].data;
        picMime = mmData.common.picture[0].format || 'image/jpeg';
      }
    } catch (err) {
      console.warn('Could not extract cover art for distribution zip:', err.message);
    }

    if (picBuffer) {
      const ext = picMime.includes('png') ? 'png' : 'jpg';
      zip.addFile(`cover.${ext}`, picBuffer);
    }

    // Add metadata report
    const metadataText = `G00J ARCHIVES - MUSIC DISTRIBUTION REPORT
==================================================
File Name: ${file.originalName}
Title: ${file.title || ''}
Artist: ${file.artist || ''}
Album Artist: ${file.albumArtist || ''}
Album: ${file.album || ''}
Composer: ${file.composer || ''}
Publisher: ${file.publisher || ''}
Year: ${file.year || ''}
Genre: ${file.genre || ''}
Track Number: ${file.trackNumber || ''}
Disc Number: ${file.discNumber || ''}
BPM: ${file.bpm || ''}
Comment: ${file.comment || ''}
Generated On: ${new Date().toISOString()}
`;
    zip.addFile('metadata-release.txt', Buffer.from(metadataText, 'utf-8'));

    const zipBuffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName.replace(/\.[^/.]+$/, "")}-release-package.zip"`);
    res.send(zipBuffer);
  } catch (error) {
    console.error('Distribute package error:', error);
    res.status(500).json({ error: `Failed to compile distribution package: ${error.message}` });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  gitSync.initGitRepo();
});
// Disable connection timeout to support unlimited-sized uploads and merges
server.timeout = 0;

// Start scheduler daemon loop (runs every 30 seconds)
setInterval(processScraperJobs, 30000);
// Also trigger once quickly after start to process any pending ones
setTimeout(processScraperJobs, 2000);
