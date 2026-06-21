import { db } from './db.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.PORT = '5002';

console.log('[Test] Starting Display Names, Invite Keys & Vault Rotation E2E Test...');

const TEST_USER = 'routruser';
const TEST_PASS = 'userpass123';
const TEST_DISPLAY = 'Routr Explorer';
const TEST_VAULT_PASS_1 = 'vaultpass1';
const TEST_VAULT_PASS_2 = 'vaultpass2';

// Import and boot server
console.log('[Test] Booting server on port 5002...');
import('./server.js').then(async () => {
  await new Promise(r => setTimeout(r, 6000));

  try {
    // 1. Pre-cleanup after db restore
    console.log('[Test] Performing pre-cleanup...');
    const existingUser = db.getUserByUsername(TEST_USER);
    if (existingUser) {
      db.deleteUser(existingUser.id);
    }
    db.getFiles().forEach(f => {
      if (f.ownerUsername === TEST_USER) {
        db.deleteFile(f.id);
      }
    });

    // 2. Verify admin display name seeding
    console.log('[Test] Checking seeded admin display name...');
    const adminUser = db.getUserByUsername('maoriboishido');
    if (!adminUser || adminUser.displayName !== 'RoutrMann') {
      throw new Error(`Expected admin user RoutrMann, got: ${JSON.stringify(adminUser)}`);
    }
    console.log('[Test] Seeded admin verified: display name is RoutrMann');

    // 3. Login as Admin to get Admin Token
    console.log('[Test] Logging in as Admin...');
    const adminLoginRes = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'maoriboishido', password: 'DanteRK5405' })
    });
    if (!adminLoginRes.ok) {
      throw new Error(`Admin login failed: ${await adminLoginRes.text()}`);
    }
    const { token: adminToken, user: loggedAdmin } = await adminLoginRes.json();
    if (loggedAdmin.displayName !== 'RoutrMann') {
      throw new Error('Logged-in admin profile missing display name!');
    }
    console.log('[Test] Logged in as Admin. Token received.');

    // 4. Create an invite key (g00j key)
    console.log('[Test] Generating invite key...');
    const keyGenRes = await fetch('http://localhost:5002/api/admin/g00j-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ description: 'Invite for Routr Explorer', role: 'premium' })
    });
    if (!keyGenRes.ok) {
      throw new Error('Failed to generate invite key');
    }
    const { key: keyObj } = await keyGenRes.json();
    const g00jKey = keyObj.key;
    console.log('[Test] Generated key:', g00jKey);

    // 5. Sign up a new Premium User using the invite key
    console.log('[Test] Registering new premium user with g00j key...');
    const signupRes = await fetch('http://localhost:5002/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER,
        password: TEST_PASS,
        displayName: TEST_DISPLAY,
        g00jKey: g00jKey
      })
    });
    if (!signupRes.ok) {
      throw new Error(`Signup failed: ${await signupRes.text()}`);
    }
    console.log('[Test] Premium user registered successfully.');

    // 6. Verify invite key was consumed (deleted)
    console.log('[Test] Verifying key consumption...');
    const signupReusedRes = await fetch('http://localhost:5002/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'anotheruser',
        password: 'pass',
        g00jKey: g00jKey
      })
    });
    if (signupReusedRes.ok) {
      throw new Error('Security Breach: Invite key was reused!');
    }
    console.log('[Test] Verified invite key was consumed and cannot be reused.');

    // 7. Login as the newly created Premium User
    console.log('[Test] Logging in as Premium User...');
    const userLoginRes = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS })
    });
    if (!userLoginRes.ok) {
      throw new Error('User login failed');
    }
    const { token: userToken, user: loggedUser } = await userLoginRes.json();
    if (loggedUser.displayName !== TEST_DISPLAY || loggedUser.role !== 'premium') {
      throw new Error(`Profile check failed: ${JSON.stringify(loggedUser)}`);
    }
    console.log('[Test] Premium user logged in successfully. Role and display name verified.');

    // Helper fetch for user requests
    const userFetch = async (url, options = {}) => {
      const headers = options.headers ? { ...options.headers } : {};
      headers['Authorization'] = `Bearer ${userToken}`;
      return fetch(url, { ...options, headers });
    };

    // 8. Initialize Vault for Premium User
    console.log('[Test] Initializing vault...');
    const vaultInitRes = await userFetch('http://localhost:5002/api/vault/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: TEST_VAULT_PASS_1 })
    });
    if (!vaultInitRes.ok) {
      throw new Error('Vault initialization failed');
    }
    console.log('[Test] Vault initialized.');

    // 9. Upload a file in vault to rotate later
    console.log('[Test] Uploading secure file into vault...');
    const uploadId = crypto.randomBytes(16).toString('hex');
    const fileName = 'vault-secrets.txt';
    const fileContent = 'ROUTR-VAULT-SECRET-PLAINTEXT-DATA';
    
    const serverDir = path.resolve(__dirname, 'data/temp', uploadId);
    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(path.join(serverDir, '0'), fileContent, 'utf8');

    const completeRes = await userFetch('http://localhost:5002/api/upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Key': TEST_VAULT_PASS_1
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
    const encryptedDiskPath = path.resolve(__dirname, 'data/github-repo', TEST_USER, `${uploadedFile.id}.enc`);
    console.log('[Test] Secure file uploaded. ID:', uploadedFile.id);

    // Verify it is encrypted under TEST_VAULT_PASS_1
    const fileContentEnc1 = fs.readFileSync(encryptedDiskPath);
    if (fileContentEnc1.toString('utf8').includes(fileContent)) {
      throw new Error('File content stored in plaintext!');
    }

    // 10. Rotate vault key/password
    console.log('[Test] Performing vault password change/rotation...');
    const rotateRes = await userFetch('http://localhost:5002/api/vault/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Key': TEST_VAULT_PASS_1
      },
      body: JSON.stringify({
        oldPassword: TEST_VAULT_PASS_1,
        newPassword: TEST_VAULT_PASS_2
      })
    });
    if (!rotateRes.ok) {
      throw new Error(`Vault password rotation failed: ${await rotateRes.text()}`);
    }
    console.log('[Test] Vault password rotation successfully completed.');

    // 11. Verify vault unlock with new password
    console.log('[Test] Verifying unlock with new password...');
    const unlockRes = await userFetch('http://localhost:5002/api/vault/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: TEST_VAULT_PASS_2 })
    });
    const unlockData = await unlockRes.json();
    if (!unlockData.unlocked) {
      throw new Error('Could not unlock vault with the new rotated password');
    }
    console.log('[Test] Vault successfully unlocked with new password.');

    // 12. Verify file content can be decrypted with the new password
    console.log('[Test] Verifying file download decrypts successfully with new password...');
    const downloadRes = await userFetch(`http://localhost:5002/api/files/download/${uploadedFile.id}`, {
      headers: { 'X-Vault-Key': TEST_VAULT_PASS_2 }
    });
    if (!downloadRes.ok) {
      throw new Error(`Download failed: ${await downloadRes.text()}`);
    }
    const decryptedContent = await downloadRes.text();
    if (decryptedContent !== fileContent) {
      throw new Error(`Content mismatch. Expected "${fileContent}", got "${decryptedContent}"`);
    }
    console.log('[Test] Stream decryption under rotated key verified successfully!');

    // 13. Create a reset key and perform password reset
    console.log('[Test] Generating g00j key for password reset...');
    const resetKeyGenRes = await fetch('http://localhost:5002/api/admin/g00j-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ description: 'Password reset key for RoutrUser' })
    });
    const { key: resetKeyObj } = await resetKeyGenRes.json();
    const resetG00jKey = resetKeyObj.key;

    console.log('[Test] Resetting user password via public endpoint...');
    const NEW_USER_PASS = 'newSuperPass555';
    const resetRes = await fetch('http://localhost:5002/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER,
        newPassword: NEW_USER_PASS,
        g00jKey: resetG00jKey
      })
    });
    if (!resetRes.ok) {
      throw new Error(`Password reset failed: ${await resetRes.text()}`);
    }
    console.log('[Test] Public password reset request completed.');

    // 14. Verify login succeeds with the new password
    console.log('[Test] Logging in with new reset password...');
    const userLoginNewRes = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER, password: NEW_USER_PASS })
    });
    if (!userLoginNewRes.ok) {
      throw new Error('User login failed with reset password');
    }
    console.log('[Test] Login with reset password verified.');

    // 14b. Verify Key Expiration
    console.log('[Test] Verification of Key Expiration...');
    // Create an expired key
    const expiredKeyGenRes = await fetch('http://localhost:5002/api/admin/g00j-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        description: 'Expired Key Test',
        expirationType: 'custom',
        customDate: new Date(Date.now() - 10000).toISOString() // expired 10 seconds ago
      })
    });
    const { key: expiredKeyObj } = await expiredKeyGenRes.json();
    const expiredG00jKey = expiredKeyObj.key;
    console.log('[Test] Created expired key:', expiredG00jKey);

    // Try signing up with the expired key
    const expiredSignupRes = await fetch('http://localhost:5002/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'expiredtestuser',
        password: 'somepassword123',
        displayName: 'Expired Test',
        g00jKey: expiredG00jKey
      })
    });
    if (expiredSignupRes.ok) {
      throw new Error('Security Breach: Registered account using an expired invite key!');
    }
    console.log('[Test] Verified expired key was rejected for signup.');

    // Create a key with 1 day expiration and assert it is set in future
    const dayKeyGenRes = await fetch('http://localhost:5002/api/admin/g00j-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        description: '1 Day Key Test',
        expirationType: 'day'
      })
    });
    const { key: dayKeyObj } = await dayKeyGenRes.json();
    if (!dayKeyObj.expiresAt || new Date(dayKeyObj.expiresAt) <= new Date()) {
      throw new Error('Key with 1 day expiration does not have a future expiresAt!');
    }
    console.log('[Test] Verified 1 day expiration calculation.');

    // Clean up expired key and day key from database
    db.deleteG00JKey(expiredG00jKey);
    db.deleteG00JKey(dayKeyObj.key);

    // 15. Clean up test database assets
    console.log('[Test] Cleaning up...');
    if (fs.existsSync(encryptedDiskPath)) {
      fs.unlinkSync(encryptedDiskPath);
    }
    db.deleteFile(uploadedFile.id);
    db.deleteUser(db.getUserByUsername(TEST_USER).id);

    console.log('\n====================================');
    console.log('  ALL SECURE ADMIN E2E TESTS PASSED!  ');
    console.log('====================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n[Test Failure] Admin tests failed:', err.message);
    process.exit(1);
  }
});
