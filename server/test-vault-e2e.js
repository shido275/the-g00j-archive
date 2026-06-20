import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the database and server
import { db } from './db.js';

// Setup environment variables for test
process.env.PORT = '5001';

const TEST_USERNAME = 'vaultuser';
const TEST_PASSWORD = 'vaultpassword123';
const VAULT_PASS = 'mysecurevaultkey!!!';

console.log('[Test] Starting Zero-Knowledge Vault E2E Test...');

// Import and boot server
console.log('[Test] Booting server on port 5001...');
import('./server.js').then(async () => {
  // Wait a moment for server initialization
  await new Promise(r => setTimeout(r, 2000));

  // Clean test user and files from database after boot/restore
  try {
    const existingUser = db.getUserByUsername(TEST_USERNAME);
    if (existingUser) {
      db.deleteUser(existingUser.id);
    }

    db.getFiles().forEach(f => {
      if (f.ownerUsername === TEST_USERNAME) {
        db.deleteFile(f.id);
      }
    });
  } catch (err) {
    console.warn('[Test] Warning during database pre-cleanup:', err.message);
  }

  try {
    // 1. Create a User via Admin Account (or seed first)
    console.log('[Test] Creating test user account...');
    // Login as Admin first to create user
    const loginRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'maoriboishido', password: 'DanteRK5405' })
    });
    
    if (!loginRes.ok) {
      throw new Error(`Admin login failed: ${await loginRes.text()}`);
    }
    const { token: adminToken } = await loginRes.json();

    // Create the test user
    const createRes = await fetch('http://localhost:5001/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        role: 'user'
      })
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create test user: ${await createRes.text()}`);
    }
    console.log('[Test] Test user created successfully.');

    // 2. Login as the new test user
    const userLoginRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD })
    });
    const { token: userToken } = await userLoginRes.json();
    console.log('[Test] Logged in as test user. Token received.');

    // Helper fetch that handles auth automatically
    const testFetch = async (url, options = {}) => {
      const headers = options.headers ? { ...options.headers } : {};
      headers['Authorization'] = `Bearer ${userToken}`;
      return fetch(url, { ...options, headers });
    };

    // 3. Check vault status (should be uninitialized)
    const checkInitRes = await testFetch('http://localhost:5001/api/vault/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'dummy' })
    });
    const checkInitData = await checkInitRes.json();
    if (checkInitData.initialized !== false) {
      throw new Error('Expected vault to be uninitialized.');
    }
    console.log('[Test] Verified vault is initially uninitialized.');

    // 4. Initialize Vault
    console.log('[Test] Initializing vault...');
    const initRes = await testFetch('http://localhost:5001/api/vault/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VAULT_PASS })
    });
    if (!initRes.ok) {
      throw new Error('Vault initialization failed.');
    }
    console.log('[Test] Vault successfully initialized.');

    // 5. Unlock Vault
    console.log('[Test] Verifying unlock...');
    const unlockRes = await testFetch('http://localhost:5001/api/vault/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VAULT_PASS })
    });
    const unlockData = await unlockRes.json();
    if (!unlockData.unlocked) {
      throw new Error('Unlock verification failed.');
    }
    console.log('[Test] Unlock verified with correct password.');

    // 6. Test wrong password unlock
    const unlockWrongRes = await testFetch('http://localhost:5001/api/vault/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong_password_here' })
    });
    if (unlockWrongRes.ok) {
      throw new Error('Expected unlock with incorrect password to fail.');
    }
    console.log('[Test] Verified wrong password unlock fails.');

    // 7. Perform vault upload
    console.log('[Test] Uploading file to vault...');
    // Create a temporary file upload
    const uploadId = crypto.randomBytes(16).toString('hex');
    const fileName = 'topsecret.txt';
    const fileContent = 'G00J-VAULT-SECRET-DATA-PLAINTEXT';
    
    // Create temp directory and chunk files
    const serverDir = path.resolve(__dirname, 'data/temp', uploadId);
    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(path.join(serverDir, '0'), fileContent, 'utf8');

    // Complete upload
    const completeRes = await testFetch('http://localhost:5001/api/upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Key': VAULT_PASS
      },
      body: JSON.stringify({
        uploadId,
        fileName,
        fileType: 'text/plain',
        totalChunks: 1,
        folderId: null,
        vault: true
      })
    });

    if (!completeRes.ok) {
      throw new Error(`Upload completion failed: ${await completeRes.text()}`);
    }
    const { file: uploadedFile } = await completeRes.json();
    console.log('[Test] File upload completed successfully. File ID:', uploadedFile.id);

    // 8. Verify at-rest encryption on disk
    console.log('[Test] Verifying file content encryption at-rest...');
    const userFolder = path.resolve(__dirname, 'data/github-repo', TEST_USERNAME);
    const diskPath = path.join(userFolder, `${uploadedFile.id}.enc`);
    
    if (!fs.existsSync(diskPath)) {
      throw new Error(`Encrypted file not found on disk at: ${diskPath}`);
    }

    const encryptedData = fs.readFileSync(diskPath);
    if (encryptedData.toString('utf8').includes(fileContent)) {
      throw new Error('Security Breach: File content was saved in plaintext on disk!');
    }
    console.log('[Test] Verified at-rest content is encrypted (no plaintext matches).');

    // 9. Verify database metadata encryption
    console.log('[Test] Verifying db metadata encryption...');
    const dbFile = db.getFile(uploadedFile.id);
    if (dbFile.originalName.includes(fileName)) {
      throw new Error('Security Breach: Original filename was stored in plaintext in the DB!');
    }
    console.log('[Test] Verified metadata filename is encrypted in database.');

    // 10. Verify listing vault files
    console.log('[Test] Listing files with correct key...');
    const listRes = await testFetch('http://localhost:5001/api/files?vault=true', {
      headers: { 'X-Vault-Key': VAULT_PASS }
    });
    const filesList = await listRes.json();
    const foundFile = filesList.find(f => f.id === uploadedFile.id);
    if (!foundFile || foundFile.originalName !== fileName) {
      throw new Error('Failed to retrieve decrypted file listing.');
    }
    console.log('[Test] Successfully listed decrypted file in vault.');

    // 11. Verify listing files without key (should exclude vault files)
    console.log('[Test] Listing files without key (should exclude vault)...');
    const listNoKeyRes = await testFetch('http://localhost:5001/api/files?vault=true');
    const listNoKey = await listNoKeyRes.json();
    if (listNoKey.some(f => f.id === uploadedFile.id)) {
      throw new Error('Security Leak: Vault files were listed without correct key!');
    }
    console.log('[Test] Verified vault files are excluded when listing without key.');

    // 12. Verify streaming download & decryption
    console.log('[Test] Testing streaming download & decryption...');
    const downloadRes = await testFetch(`http://localhost:5001/api/files/download/${uploadedFile.id}`, {
      headers: { 'X-Vault-Key': VAULT_PASS }
    });
    if (!downloadRes.ok) {
      throw new Error(`Download failed: ${await downloadRes.text()}`);
    }
    const decryptedContent = await downloadRes.text();
    if (decryptedContent !== fileContent) {
      throw new Error(`Decrypted content mismatch. Expected "${fileContent}", got "${decryptedContent}"`);
    }
    console.log('[Test] Stream decryption verified successfully!');

    // 13. Verify download with query param vaultKey (for preview players)
    console.log('[Test] Testing download with query param vaultKey...');
    const downloadQueryRes = await testFetch(`http://localhost:5001/api/files/download/${uploadedFile.id}?vaultKey=${encodeURIComponent(VAULT_PASS)}`);
    if (!downloadQueryRes.ok) {
      throw new Error(`Query param download failed: ${await downloadQueryRes.text()}`);
    }
    const decryptedQueryContent = await downloadQueryRes.text();
    if (decryptedQueryContent !== fileContent) {
      throw new Error(`Query param decrypted content mismatch.`);
    }
    console.log('[Test] Query parameter decryption verified successfully!');

    // 14. Clean up test assets
    console.log('[Test] Cleaning up...');
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }
    db.deleteFile(uploadedFile.id);
    db.deleteUser(db.getUserByUsername(TEST_USERNAME).id);
    
    console.log('\n====================================');
    console.log('  ALL VAULT INTEGRATION TESTS PASSED!  ');
    console.log('====================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n[Test Failure] Vault integration tests failed:', err.message);
    process.exit(1);
  }
});
