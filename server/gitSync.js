import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const GIT_REPO_DIR = path.join(DATA_DIR, 'github-repo');

const STORAGE_SERVER_URL = 'http://127.0.0.1:5005';

const taskQueue = [];
let taskProcessing = false;
const activeCleanups = new Map();
const pendingUploads = new Set();

// Resolve folder hierarchy to create directory path in storage layout
export function getFolderHierarchyPath(folderId, ownerUsername) {
  const folders = db.getFolders();
  const pathParts = [];
  let currentId = folderId;
  while (currentId) {
    const folder = folders.find(f => f.id === currentId);
    if (!folder) break;
    const safeName = folder.name.replace(/[\/\\:\*\?"<>\|]/g, '_');
    pathParts.unshift(safeName);
    currentId = folder.parentId;
  }

  let finalOwner = ownerUsername;
  if (!finalOwner && folderId) {
    let currentId = folderId;
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      if (folder.ownerUsername) {
        finalOwner = folder.ownerUsername;
        break;
      }
      currentId = folder.parentId;
    }
  }

  if (finalOwner) {
    pathParts.unshift(finalOwner);
  } else {
    pathParts.unshift('shared');
  }

  return pathParts.join('/');
}

async function processTaskQueue() {
  if (taskProcessing) return;
  taskProcessing = true;

  while (taskQueue.length > 0) {
    const task = taskQueue.shift();
    try {
      await task();
    } catch (err) {
      console.error('[Storage Sync Queue] Error processing task:', err);
    }
  }

  taskProcessing = false;
}

function enqueueTask(task) {
  taskQueue.push(task);
  processTaskQueue();
}

export const gitSync = {
  async initGitRepo() {
    try {
      if (!fs.existsSync(GIT_REPO_DIR)) {
        fs.mkdirSync(GIT_REPO_DIR, { recursive: true });
      }

      console.log('[Storage Sync] Initializing synchronization with database/storage server...');
      
      const res = await fetch(`${STORAGE_SERVER_URL}/api/db`);
      if (res.ok) {
        const remoteDb = await res.json();
        const localDbPath = path.join(DATA_DIR, 'db.json');
        
        // If the storage server has database entries, update local db
        if (remoteDb && (remoteDb.files?.length > 0 || remoteDb.folders?.length > 0 || remoteDb.users?.length > 0)) {
          console.log('[Storage Sync] Restoring database state from storage server...');
          fs.writeFileSync(localDbPath, JSON.stringify(remoteDb, null, 2), 'utf8');
        } else {
          // If storage server database is empty but we have local database, push to storage server
          if (fs.existsSync(localDbPath)) {
            console.log('[Storage Sync] Pushing local database to empty storage server...');
            const localDb = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
            await fetch(`${STORAGE_SERVER_URL}/api/db`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localDb)
            });
          }
        }
      } else {
        console.error(`[Storage Sync] Failed to connect to storage server: ${res.statusText}`);
      }
    } catch (err) {
      console.error('[Storage Sync] Error in initGitRepo connection check:', err.message);
    }
  },

  queueUpload(file) {
    const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
    const fileNameOnDisk = file.isVault ? `${file.id}.enc` : file.originalName;
    const destFilePath = path.join(GIT_REPO_DIR, folderPath, fileNameOnDisk);

    pendingUploads.add(file.id);

    enqueueTask(async () => {
      console.log(`[Storage Sync] Uploading ${file.isVault ? 'secure file' : file.originalName} to storage server...`);
      
      if (!fs.existsSync(destFilePath)) {
        console.error(`[Storage Sync] Upload source file not found at ${destFilePath}`);
        pendingUploads.delete(file.id);
        return;
      }

      try {
        const relativePath = path.join(folderPath, fileNameOnDisk).replace(/\\/g, '/');
        const fileBlob = await fs.openAsBlob(destFilePath);
        
        const formData = new FormData();
        formData.append('path', relativePath);
        formData.append('file', fileBlob, fileNameOnDisk);

        const res = await fetch(`${STORAGE_SERVER_URL}/api/files`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          throw new Error(`Storage server returned status ${res.status}`);
        }

        console.log(`[Storage Sync] Upload successful: ${file.isVault ? 'secure file' : file.originalName}`);
      } catch (err) {
        console.error(`[Storage Sync] Failed to upload ${file.isVault ? 'secure file' : file.originalName}:`, err);
      } finally {
        pendingUploads.delete(file.id);
        // Clean up local file after successful upload
        if (fs.existsSync(destFilePath)) {
          fs.unlinkSync(destFilePath);
        }
      }
    });
  },

  queueDelete(file) {
    const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
    const fileNameOnDisk = file.isVault ? `${file.id}.enc` : file.originalName;
    const relativePath = path.join(folderPath, fileNameOnDisk).replace(/\\/g, '/');

    enqueueTask(async () => {
      console.log(`[Storage Sync] Deleting ${file.isVault ? 'secure file' : file.originalName} from storage server...`);
      try {
        const res = await fetch(`${STORAGE_SERVER_URL}/api/files?path=${encodeURIComponent(relativePath)}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          throw new Error(`Storage server returned status ${res.status}`);
        }
        console.log(`[Storage Sync] Deletion successful: ${file.isVault ? 'secure file' : file.originalName}`);
      } catch (err) {
        console.error(`[Storage Sync] Failed to delete file: ${relativePath}`, err);
      }
    });
  },

  async ensureFileOnDisk(file) {
    if (activeCleanups.has(file.id)) {
      clearTimeout(activeCleanups.get(file.id));
      activeCleanups.delete(file.id);
    }

    const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
    const fileNameOnDisk = file.isVault ? `${file.id}.enc` : file.originalName;
    const destFilePath = path.join(GIT_REPO_DIR, folderPath, fileNameOnDisk);

    if (fs.existsSync(destFilePath)) {
      return destFilePath;
    }

    console.log(`[Storage Sync] Fetching file on demand: ${file.isVault ? 'secure file' : file.originalName}`);
    const destDir = path.dirname(destFilePath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const relativePath = path.join(folderPath, fileNameOnDisk).replace(/\\/g, '/');
    const response = await fetch(`${STORAGE_SERVER_URL}/api/files?path=${encodeURIComponent(relativePath)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch file ${relativePath} from storage server: ${response.statusText}`);
    }

    const fileStream = fs.createWriteStream(destFilePath);
    await finished(Readable.fromWeb(response.body).pipe(fileStream));
    return destFilePath;
  },

  async ensureVeraCryptFileOnDisk(username) {
    const relativePath = `${username}/personal_vault.hc`;
    const destFilePath = path.join(GIT_REPO_DIR, username, 'personal_vault.hc');
    if (fs.existsSync(destFilePath)) {
      return destFilePath;
    }

    console.log(`[Storage Sync] Fetching VeraCrypt container on demand: ${relativePath}`);
    const destDir = path.dirname(destFilePath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const response = await fetch(`${STORAGE_SERVER_URL}/api/files?path=${encodeURIComponent(relativePath)}`);
    if (response.ok) {
      const fileStream = fs.createWriteStream(destFilePath);
      await finished(Readable.fromWeb(response.body).pipe(fileStream));
    }
    return destFilePath;
  },

  scheduleFileCleanup(file) {
    const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
    const fileNameOnDisk = file.isVault ? `${file.id}.enc` : file.originalName;
    const destFilePath = path.join(GIT_REPO_DIR, folderPath, fileNameOnDisk);

    if (activeCleanups.has(file.id)) {
      clearTimeout(activeCleanups.get(file.id));
    }

    const timeoutId = setTimeout(() => {
      activeCleanups.delete(file.id);
      if (pendingUploads.has(file.id)) {
        console.log(`[Storage Sync] Skipping cleanup for ${file.id} because upload is pending`);
        return;
      }
      try {
        if (fs.existsSync(destFilePath)) {
          fs.unlinkSync(destFilePath);
          console.log(`[Storage Sync] Cleaned up local file from disk (scheduled): ${file.isVault ? 'secure file' : file.originalName}`);
        }
      } catch (err) {
        console.error(`[Storage Sync] Failed to clean up file ${file.isVault ? 'secure file' : file.originalName}:`, err.message);
      }
    }, 1000);

    activeCleanups.set(file.id, timeoutId);
  },

  queueDbSync() {
    enqueueTask(async () => {
      console.log('[Storage Sync] Syncing database to storage server...');
      const localDbPath = path.join(DATA_DIR, 'db.json');
      if (fs.existsSync(localDbPath)) {
        try {
          const localDb = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
          const res = await fetch(`${STORAGE_SERVER_URL}/api/db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb)
          });
          if (!res.ok) {
            throw new Error(`Storage server returned status ${res.status}`);
          }
          console.log('[Storage Sync] Database state successfully synced to storage server.');
        } catch (err) {
          console.error('[Storage Sync] Failed to sync database to storage server:', err);
        }
      }
    });
  },

  syncVeraCryptFile(username) {
    const relativePath = path.join(username, 'personal_vault.hc').replace(/\\/g, '/');
    const localPath = path.join(GIT_REPO_DIR, username, 'personal_vault.hc');
    enqueueTask(async () => {
      console.log(`[Storage Sync] Syncing VeraCrypt container for ${username} to storage server...`);
      try {
        if (!fs.existsSync(localPath)) {
          console.error(`[Storage Sync] Local VeraCrypt file not found at ${localPath}`);
          return;
        }
        const fileBlob = await fs.openAsBlob(localPath);
        const formData = new FormData();
        formData.append('path', relativePath);
        formData.append('file', fileBlob, 'personal_vault.hc');

        const res = await fetch(`${STORAGE_SERVER_URL}/api/files`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          throw new Error(`Storage server returned status ${res.status}`);
        }
        console.log(`[Storage Sync] VeraCrypt container sync successful for ${username}`);
      } catch (err) {
        console.error(`[Storage Sync] Failed to sync VeraCrypt container for ${username}:`, err);
      }
    });
  },

  queueRenameFile(file, oldName, newName) {
    enqueueTask(async () => {
      console.log(`[Storage Sync] Syncing file rename: ${oldName} -> ${newName}`);
      if (file.isVault) return;

      const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
      const oldRelative = path.join(folderPath, oldName).replace(/\\/g, '/');
      const newRelative = path.join(folderPath, newName).replace(/\\/g, '/');

      try {
        const res = await fetch(`${STORAGE_SERVER_URL}/api/files/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: oldRelative, newPath: newRelative })
        });
        if (!res.ok) {
          throw new Error(`Storage server returned status ${res.status}`);
        }
        console.log(`[Storage Sync] File rename synced: ${oldName} -> ${newName}`);
      } catch (err) {
        console.error(`[Storage Sync] Failed to rename file ${oldName}:`, err);
      }
    });
  },

  queueMoveFile(file, oldFolderId, newFolderId) {
    enqueueTask(async () => {
      const fileName = file.isVault ? `${file.id}.enc` : file.originalName;
      console.log(`[Storage Sync] Syncing file move: ${fileName}`);
      const oldFolder = getFolderHierarchyPath(oldFolderId, file.ownerUsername);
      const newFolder = getFolderHierarchyPath(newFolderId, file.ownerUsername);
      if (oldFolder === newFolder) return;

      const oldRelative = path.join(oldFolder, fileName).replace(/\\/g, '/');
      const newRelative = path.join(newFolder, fileName).replace(/\\/g, '/');

      try {
        const res = await fetch(`${STORAGE_SERVER_URL}/api/files/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: oldRelative, newPath: newRelative })
        });
        if (!res.ok) {
          throw new Error(`Storage server returned status ${res.status}`);
        }
        console.log(`[Storage Sync] File move synced: ${fileName}`);
      } catch (err) {
        console.error(`[Storage Sync] Failed to move file ${fileName}:`, err);
      }
    });
  },

  queueRenameFolder(folderId, oldName, newName, ownerUsername) {
    enqueueTask(async () => {
      console.log(`[Storage Sync] Syncing folder rename: ${oldName} -> ${newName}`);
      const oldRelative = getFolderHierarchyPath(folderId, ownerUsername);
      const pathParts = oldRelative.split('/');
      pathParts[pathParts.length - 1] = newName.replace(/[\/\\:\*\?"<>\|]/g, '_');
      const newRelative = pathParts.join('/');

      if (oldRelative === newRelative) return;

      try {
        const res = await fetch(`${STORAGE_SERVER_URL}/api/files/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: oldRelative, newPath: newRelative })
        });
        if (!res.ok) {
          throw new Error(`Storage server returned status ${res.status}`);
        }
        console.log(`[Storage Sync] Folder rename synced: ${oldName} -> ${newName}`);
      } catch (err) {
        console.error(`[Storage Sync] Failed to rename folder ${oldName}:`, err);
      }
    });
  },

  queueMoveFolder(folderId, oldParentId, newParentId, ownerUsername) {
    enqueueTask(async () => {
      const folders = db.getFolders();
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      const originalParentId = folder.parentId;
      
      folder.parentId = oldParentId;
      const oldRelative = getFolderHierarchyPath(folderId, ownerUsername);
      
      folder.parentId = newParentId;
      const newRelative = getFolderHierarchyPath(folderId, ownerUsername);
      
      folder.parentId = originalParentId;

      if (oldRelative === newRelative) return;

      console.log(`[Storage Sync] Syncing folder move: ${oldRelative} -> ${newRelative}`);

      try {
        const res = await fetch(`${STORAGE_SERVER_URL}/api/files/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: oldRelative, newPath: newRelative })
        });
        if (!res.ok) {
          throw new Error(`Storage server returned status ${res.status}`);
        }
        console.log(`[Storage Sync] Folder move synced: ${oldRelative} -> ${newRelative}`);
      } catch (err) {
        console.error(`[Storage Sync] Failed to move folder:`, err);
      }
    });
  },

  async waitTaskQueueEmpty() {
    while (taskQueue.length > 0 || taskProcessing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
};

let syncIntervalId = null;
let isSyncingInProgress = false;

async function runBackgroundSync() {
  if (isSyncingInProgress) return;
  isSyncingInProgress = true;
  console.log('[Storage Sync] Running background synchronization...');

  try {
    const res = await fetch(`${STORAGE_SERVER_URL}/api/db`);
    if (res.ok) {
      const remoteDb = await res.json();
      const localDbPath = path.join(DATA_DIR, 'db.json');
      let localDb = { files: [], folders: [], scraperJobs: [], users: [], g00jKeys: [] };
      if (fs.existsSync(localDbPath)) {
        try {
          localDb = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
        } catch (e) {}
      }

      if (JSON.stringify(remoteDb) !== JSON.stringify(localDb)) {
        console.log('[Storage Sync] Remote database changes detected. Overwriting local copy...');
        fs.writeFileSync(localDbPath, JSON.stringify(remoteDb, null, 2), 'utf8');
        if (global.onDbSyncedFromRemote) {
          global.onDbSyncedFromRemote();
        }
      }
    }
  } catch (err) {
    console.error('[Storage Sync] Background sync error:', err.message);
  } finally {
    isSyncingInProgress = false;
  }
}

export function startSyncLoop(intervalMs = 30000) {
  if (syncIntervalId) return;
  setTimeout(runBackgroundSync, 2000);
  syncIntervalId = setInterval(runBackgroundSync, intervalMs);
  console.log(`[Storage Sync] Polling sync loop started every ${intervalMs / 1000}s`);
}

export function stopSyncLoop() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[Storage Sync] Polling sync loop stopped');
  }
}
