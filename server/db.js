import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure database file exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ files: [], folders: [], scraperJobs: [] }, null, 2), 'utf8');
}

// Thread-safe-ish atomic write
function writeDb(data) {
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_PATH);
}

function readDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.files) parsed.files = [];
    if (!parsed.folders) parsed.folders = [];
    if (!parsed.scraperJobs) parsed.scraperJobs = [];
    return parsed;
  } catch (error) {
    console.error('Error reading database, resetting to default:', error);
    const defaultData = { files: [], folders: [], scraperJobs: [] };
    writeDb(defaultData);
    return defaultData;
  }
}

export const db = {
  getFiles() {
    const data = readDb();
    // Return sorted by uploadDate descending by default
    return data.files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  },

  getFile(id) {
    const data = readDb();
    return data.files.find(f => f.id === id) || null;
  },

  saveFile(file) {
    const data = readDb();
    const index = data.files.findIndex(f => f.id === file.id);
    
    if (index >= 0) {
      data.files[index] = { ...data.files[index], ...file };
    } else {
      data.files.push(file);
    }
    
    writeDb(data);
    return file;
  },

  deleteFile(id) {
    const data = readDb();
    const index = data.files.findIndex(f => f.id === id);
    if (index >= 0) {
      const deletedFile = data.files.splice(index, 1)[0];
      writeDb(data);
      return deletedFile;
    }
    return null;
  },

  getFolders() {
    const data = readDb();
    return data.folders || [];
  },

  getFolder(id) {
    const data = readDb();
    return data.folders.find(f => f.id === id) || null;
  },

  saveFolder(folder) {
    const data = readDb();
    const index = data.folders.findIndex(f => f.id === folder.id);
    if (index >= 0) {
      data.folders[index] = { ...data.folders[index], ...folder };
    } else {
      data.folders.push(folder);
    }
    writeDb(data);
    return folder;
  },

  deleteFolder(id) {
    const data = readDb();
    const index = data.folders.findIndex(f => f.id === id);
    if (index >= 0) {
      const deletedFolder = data.folders.splice(index, 1)[0];
      writeDb(data);
      return deletedFolder;
    }
    return null;
  },

  getJobs() {
    const data = readDb();
    return data.scraperJobs || [];
  },

  getJob(id) {
    const data = readDb();
    return data.scraperJobs.find(j => j.id === id) || null;
  },

  saveJob(job) {
    const data = readDb();
    const index = data.scraperJobs.findIndex(j => j.id === job.id);
    if (index >= 0) {
      data.scraperJobs[index] = { ...data.scraperJobs[index], ...job };
    } else {
      data.scraperJobs.push(job);
    }
    writeDb(data);
    return job;
  },

  deleteJob(id) {
    const data = readDb();
    const index = data.scraperJobs.findIndex(j => j.id === id);
    if (index >= 0) {
      const deletedJob = data.scraperJobs.splice(index, 1)[0];
      writeDb(data);
      return deletedJob;
    }
    return null;
  },

  addDownloadedUrl(jobId, url) {
    const data = readDb();
    const job = data.scraperJobs.find(j => j.id === jobId);
    if (job) {
      if (!job.downloadedUrls) job.downloadedUrls = [];
      if (!job.downloadedUrls.includes(url)) {
        job.downloadedUrls.push(url);
        writeDb(data);
      }
    }
  },

  getStats() {
    const data = readDb();
    const files = data.files;
    
    const totalFiles = files.length;
    const totalSize = files.reduce((acc, file) => acc + (file.size || 0), 0);
    
    // Categorize
    const categoryStats = {
      images: 0,
      videos: 0,
      documents: 0,
      audio: 0,
      archives: 0,
      others: 0
    };

    files.forEach(file => {
      const cat = file.category || 'others';
      if (categoryStats[cat] !== undefined) {
        categoryStats[cat] += file.size || 0;
      } else {
        categoryStats.others += file.size || 0;
      }
    });

    return {
      totalFiles,
      totalSize,
      categoryStats
    };
  }
};
