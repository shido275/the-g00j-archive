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
const activeCleanups = new Map();

// Resolve folder hierarchy to create directory path in git clone
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

async function runGitCmd(cmd, dir = GIT_REPO_DIR) {
  try {
    const { stdout, stderr } = await execPromise(cmd, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: 'echo',
        SSH_ASKPASS: 'echo'
      }
    });
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

      let cloneUrl = 'https://github.com/shido275/The-g00j-Files.git';
      if (process.env.GITHUB_TOKEN) {
        cloneUrl = `https://${process.env.GITHUB_TOKEN}@github.com/shido275/The-g00j-Files.git`;
      }

      if (!fs.existsSync(path.join(GIT_REPO_DIR, '.git'))) {
        console.log('[Git Sync] Cloning private repository into storage sync folder...');
        await execPromise(`git clone ${cloneUrl} .`, { cwd: GIT_REPO_DIR });
        console.log('[Git Sync] Repository cloned successfully.');
      } else {
        console.log('[Git Sync] Initializing pull/rebase to ensure in sync...');
        await runGitCmd('git pull --rebase origin main').catch(() => {
          console.log('[Git Sync] Local repository is empty or origin/main not found, skipping initial pull.');
        });
      }

      // Configure default local git user identity for commits
      await runGitCmd('git config user.name "G00J Archives Server"');
      await runGitCmd('git config user.email "server@g00j-archives.local"');

      // Database Restoration on Startup
      const repoDbPath = path.join(GIT_REPO_DIR, 'db.json');
      const localDbPath = path.join(DATA_DIR, 'db.json');
      if (fs.existsSync(repoDbPath)) {
        console.log('[Git Sync] Restoring database state from remote GitHub repository...');
        fs.copyFileSync(repoDbPath, localDbPath);
      } else {
        console.log('[Git Sync] No remote database found, starting with local instance.');
      }
    } catch (err) {
      console.error('[Git Sync] Error in initGitRepo:', err);
    }
  },

  queueUpload(file) {
    const fileNameOnDisk = file.isVault ? `${file.id}.enc` : file.originalName;
    const commitMsg = file.isVault ? "Upload secure file" : `Upload ${file.originalName}`;
    enqueueGitTask(async () => {
      console.log(`[Git Sync] Syncing upload to GitHub: ${file.isVault ? 'secure file' : file.originalName}`);

      // 1. Pull latest to avoid push conflicts
      try {
        await runGitCmd('git pull --rebase origin main');
      } catch (err) {
        console.log('[Git Sync] Pull failed or branch not set up. Proceeding...');
      }

      // 2. Stage, commit and push
      try {
        await runGitCmd('git add -A');
        await runGitCmd(`git commit -m "${commitMsg}"`);
        await runGitCmd('git push origin main');
        console.log(`[Git Sync] Successfully synced upload to GitHub: ${file.isVault ? 'secure file' : file.originalName}`);

        // Tell git to skip worktree tracking for this file and physically remove it
        const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
        const relativePath = path.join(folderPath, fileNameOnDisk).replace(/\\/g, '/');
        await runGitCmd(`git update-index --skip-worktree "${relativePath}"`);
        const destFilePath = path.join(GIT_REPO_DIR, folderPath, fileNameOnDisk);
        if (fs.existsSync(destFilePath)) {
          fs.unlinkSync(destFilePath);
          console.log(`[Git Sync] Physically cleaned up local file after successful sync: ${file.isVault ? 'secure file' : file.originalName}`);
        }
      } catch (err) {
        console.error(`[Git Sync] Failed to commit/push upload: ${file.isVault ? 'secure file' : file.originalName}`, err);
      }
    });
  },

  queueDelete(file) {
    const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
    const fileNameOnDisk = file.isVault ? `${file.id}.enc` : file.originalName;
    const relativePath = path.join(folderPath, fileNameOnDisk).replace(/\\/g, '/');
    const commitMsg = file.isVault ? "Delete secure file" : `Delete ${file.originalName}`;
    enqueueGitTask(async () => {
      console.log(`[Git Sync] Syncing deletion from GitHub: ${file.isVault ? 'secure file' : file.originalName}`);
      const destFilePath = path.join(GIT_REPO_DIR, folderPath, fileNameOnDisk);

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
        await runGitCmd(`git commit -m "${commitMsg}"`);
        await runGitCmd('git push origin main');
        console.log(`[Git Sync] Successfully synced deletion from GitHub: ${file.isVault ? 'secure file' : file.originalName}`);
      } catch (err) {
        console.error(`[Git Sync] Failed to commit/push deletion: ${file.isVault ? 'secure file' : file.originalName}`, err);
      }
    });
  },

  async ensureFileOnDisk(file) {
    // Cancel any pending cleanup for this file since it's being accessed/streamed
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

    console.log(`[Git Sync] Checking out file on demand: ${file.isVault ? 'secure file' : file.originalName}`);
    const relativePath = path.join(folderPath, fileNameOnDisk).replace(/\\/g, '/');

    const destDir = path.dirname(destFilePath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    try {
      // Use ultra-fast git show redirection (takes ~150ms instead of ~400ms sequential checkout)
      await runGitCmd(`git show HEAD:"${relativePath}" > "${destFilePath}"`);
    } catch (err) {
      // Fallback if git show fails
      try {
        await runGitCmd(`git update-index --no-skip-worktree "${relativePath}"`);
      } catch (e) { }
      await runGitCmd(`git checkout HEAD -- "${relativePath}"`);
    }
    return destFilePath;
  },

  scheduleFileCleanup(file) {
    const folderPath = getFolderHierarchyPath(file.folderId, file.ownerUsername);
    const fileNameOnDisk = file.isVault ? `${file.id}.enc` : file.originalName;
    const destFilePath = path.join(GIT_REPO_DIR, folderPath, fileNameOnDisk);

    // Clear any existing timer to debounce
    if (activeCleanups.has(file.id)) {
      clearTimeout(activeCleanups.get(file.id));
    }

    // Debounce/delay cleanup to avoid I/O thrashing during seekable range-request streaming
    const timeoutId = setTimeout(async () => {
      activeCleanups.delete(file.id);
      try {
        if (fs.existsSync(destFilePath)) {
          const relativePath = path.join(folderPath, fileNameOnDisk).replace(/\\/g, '/');
          await runGitCmd(`git update-index --skip-worktree "${relativePath}"`);
          fs.unlinkSync(destFilePath);
          console.log(`[Git Sync] Cleaned up local file from disk (scheduled): ${file.isVault ? 'secure file' : file.originalName}`);
        }
      } catch (err) {
        console.error(`[Git Sync] Failed to clean up file ${file.isVault ? 'secure file' : file.originalName}:`, err.message);
      }
    }, 1000); // 1 second debounce delay

    activeCleanups.set(file.id, timeoutId);
  },

  queueDbSync() {
    enqueueGitTask(async () => {
      console.log('[Git Sync] Syncing database to GitHub...');
      const srcPath = path.join(DATA_DIR, 'db.json');
      const destPath = path.join(GIT_REPO_DIR, 'db.json');
      
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }

      try {
        await runGitCmd('git pull --rebase origin main').catch(() => {});
        
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }

        await runGitCmd('git add db.json');
        await runGitCmd('git commit -m "Sync database state"');
        await runGitCmd('git push origin main');
        console.log('[Git Sync] Database state successfully synced to GitHub.');
      } catch (err) {
        console.error('[Git Sync] Failed to sync database to GitHub:', err);
      }
    });
  },

  syncVeraCryptFile(username) {
    const relativePath = path.join(username, 'personal_vault.hc').replace(/\\/g, '/');
    enqueueGitTask(async () => {
      console.log(`[Git Sync] Syncing VeraCrypt container for ${username} to GitHub...`);
      try {
        await runGitCmd('git pull --rebase origin main').catch(() => {});
        await runGitCmd(`git add "${relativePath}"`);
        await runGitCmd(`git commit -m "Update VeraCrypt vault for ${username}"`);
        await runGitCmd('git push origin main');
        console.log(`[Git Sync] Successfully synced VeraCrypt container for ${username}`);
      } catch (err) {
        console.error(`[Git Sync] Failed to sync VeraCrypt container for ${username}`, err);
      }
    });
  }
};
