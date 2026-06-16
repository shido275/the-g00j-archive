import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from './db.js';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const GIT_REPO_DIR = path.join(DATA_DIR, 'github-repo');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const gitQueue = [];
let gitProcessing = false;

// Resolve folder hierarchy to create directory path in git clone
export function getFolderHierarchyPath(folderId) {
  if (!folderId) return '';
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
  return pathParts.join('/');
}

async function runGitCmd(cmd, dir = GIT_REPO_DIR) {
  try {
    const { stdout, stderr } = await execPromise(cmd, { cwd: dir });
    return { stdout, stderr };
  } catch (err) {
    const errMsg = (err.message || '') + (err.stdout || '') + (err.stderr || '');
    if (cmd.includes('commit') && (errMsg.includes('nothing to commit') || errMsg.includes('working tree clean'))) {
      return { stdout: '', stderr: err.message };
    }
    throw err;
  }
}

async function processGitQueue() {
  if (gitProcessing) return;
  gitProcessing = true;

  while (gitQueue.length > 0) {
    const task = gitQueue.shift();
    try {
      await task();
    } catch (err) {
      console.error('[Git Sync] Error processing sync task:', err);
    }
  }

  gitProcessing = false;
}

function enqueueGitTask(task) {
  gitQueue.push(task);
  processGitQueue();
}

export const gitSync = {
  async initGitRepo() {
    try {
      if (!fs.existsSync(GIT_REPO_DIR)) {
        fs.mkdirSync(GIT_REPO_DIR, { recursive: true });
      }

      if (!fs.existsSync(path.join(GIT_REPO_DIR, '.git'))) {
        console.log('[Git Sync] Cloning private repository into storage sync folder...');
        await execPromise('git clone https://github.com/shido275/The-g00j-Files.git .', { cwd: GIT_REPO_DIR });
        console.log('[Git Sync] Repository cloned successfully.');
      } else {
        console.log('[Git Sync] Initializing pull/rebase to ensure in sync...');
        await runGitCmd('git pull --rebase origin main').catch(() => {
          console.log('[Git Sync] Local repository is empty or origin/main not found, skipping initial pull.');
        });
      }
    } catch (err) {
      console.error('[Git Sync] Error in initGitRepo:', err);
    }
  },

  queueUpload(file) {
    enqueueGitTask(async () => {
      console.log(`[Git Sync] Syncing upload to GitHub: ${file.originalName}`);

      // 1. Pull latest to avoid push conflicts
      try {
        await runGitCmd('git pull --rebase origin main');
      } catch (err) {
        console.log('[Git Sync] Pull failed or branch not set up. Proceeding...');
      }

      // 2. Stage, commit and push
      try {
        await runGitCmd('git add -A');
        await runGitCmd(`git commit -m "Upload ${file.originalName}"`);
        await runGitCmd('git push origin main');
        console.log(`[Git Sync] Successfully synced upload to GitHub: ${file.originalName}`);

        // Tell git to skip worktree tracking for this file and physically remove it
        const folderPath = getFolderHierarchyPath(file.folderId);
        const relativePath = path.join(folderPath, file.originalName).replace(/\\/g, '/');
        await runGitCmd(`git update-index --skip-worktree "${relativePath}"`);
        const destFilePath = path.join(GIT_REPO_DIR, folderPath, file.originalName);
        if (fs.existsSync(destFilePath)) {
          fs.unlinkSync(destFilePath);
          console.log(`[Git Sync] Physically cleaned up local file after successful sync: ${file.originalName}`);
        }
      } catch (err) {
        console.error(`[Git Sync] Failed to commit/push upload: ${file.originalName}`, err);
      }
    });
  },

  queueDelete(file) {
    const folderPath = getFolderHierarchyPath(file.folderId);
    const relativePath = path.join(folderPath, file.originalName).replace(/\\/g, '/');
    enqueueGitTask(async () => {
      console.log(`[Git Sync] Syncing deletion from GitHub: ${file.originalName}`);
      const destFilePath = path.join(GIT_REPO_DIR, folderPath, file.originalName);

      // 1. Pull latest to avoid push conflicts
      try {
        await runGitCmd('git pull --rebase origin main');
      } catch (err) {
        console.log('[Git Sync] Pull failed or branch not set up. Proceeding...');
      }

      // 2. Stop skipping worktree so Git registers the deletion
      try {
        await runGitCmd(`git update-index --no-skip-worktree "${relativePath}"`);
      } catch (err) {
        // Ignore if file wasn't skipped
      }

      // 3. Delete file if exists
      if (fs.existsSync(destFilePath)) {
        fs.unlinkSync(destFilePath);
      }

      // 4. Stage, commit and push
      try {
        await runGitCmd('git add -A');
        await runGitCmd(`git commit -m "Delete ${file.originalName}"`);
        await runGitCmd('git push origin main');
        console.log(`[Git Sync] Successfully synced deletion from GitHub: ${file.originalName}`);
      } catch (err) {
        console.error(`[Git Sync] Failed to commit/push deletion: ${file.originalName}`, err);
      }
    });
  },

  async ensureFileOnDisk(file) {
    const folderPath = getFolderHierarchyPath(file.folderId);
    const destFilePath = path.join(GIT_REPO_DIR, folderPath, file.originalName);
    if (fs.existsSync(destFilePath)) {
      return destFilePath;
    }

    console.log(`[Git Sync] Checking out file on demand: ${file.originalName}`);
    const relativePath = path.join(folderPath, file.originalName).replace(/\\/g, '/');

    try {
      await runGitCmd(`git update-index --no-skip-worktree "${relativePath}"`);
    } catch (err) {
      // Ignore
    }

    await runGitCmd(`git checkout HEAD -- "${relativePath}"`);
    return destFilePath;
  },

  scheduleFileCleanup(file) {
    const folderPath = getFolderHierarchyPath(file.folderId);
    const destFilePath = path.join(GIT_REPO_DIR, folderPath, file.originalName);

    // Debounce/delay cleanup to avoid I/O thrashing during seekable range-request streaming
    setTimeout(async () => {
      try {
        if (fs.existsSync(destFilePath)) {
          const relativePath = path.join(folderPath, file.originalName).replace(/\\/g, '/');
          await runGitCmd(`git update-index --skip-worktree "${relativePath}"`);
          fs.unlinkSync(destFilePath);
          console.log(`[Git Sync] Cleaned up local file from disk (scheduled): ${file.originalName}`);
        }
      } catch (err) {
        console.error(`[Git Sync] Failed to clean up file ${file.originalName}:`, err.message);
      }
    }, 20000); // 20 seconds delay
  }
};
