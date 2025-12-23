// Navidrome/Subsonic Authentication
// Handles credential management and server connection testing

import { invoke } from '@tauri-apps/api/core';

/**
 * Simple MD5 implementation for Subsonic API authentication
 * The Subsonic API requires: token = md5(password + salt)
 */
async function md5(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('MD5', msgBuffer).catch(() => null);

  // MD5 not available in SubtleCrypto (deprecated), use fallback
  if (!hashBuffer) {
    return md5Fallback(message);
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fallback MD5 implementation (pure JS)
 */
function md5Fallback(string) {
  function rotateLeft(value, shift) {
    return (value << shift) | (value >>> (32 - shift));
  }

  function addUnsigned(x, y) {
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);
    if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
    if (x4 | y4) {
      if (result & 0x40000000) return result ^ 0xc0000000 ^ x8 ^ y8;
      return result ^ 0x40000000 ^ x8 ^ y8;
    }
    return result ^ x8 ^ y8;
  }

  function f(x, y, z) { return (x & y) | (~x & z); }
  function g(x, y, z) { return (x & z) | (y & ~z); }
  function h(x, y, z) { return x ^ y ^ z; }
  function i(x, y, z) { return y ^ (x | ~z); }

  function ff(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function gg(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function hh(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function ii(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str) {
    const wordCount = ((str.length + 8 - (str.length + 8) % 64) / 64 + 1) * 16;
    const wordArray = new Array(wordCount - 1).fill(0);
    let bytePos = 0;
    let byteCount = 0;
    while (byteCount < str.length) {
      const wordPos = (byteCount - byteCount % 4) / 4;
      bytePos = (byteCount % 4) * 8;
      wordArray[wordPos] = wordArray[wordPos] | (str.charCodeAt(byteCount) << bytePos);
      byteCount++;
    }
    const wordPos = (byteCount - byteCount % 4) / 4;
    bytePos = (byteCount % 4) * 8;
    wordArray[wordPos] = wordArray[wordPos] | (0x80 << bytePos);
    wordArray[wordCount - 2] = str.length << 3;
    wordArray[wordCount - 1] = str.length >>> 29;
    return wordArray;
  }

  function wordToHex(value) {
    let hex = '';
    for (let i = 0; i <= 3; i++) {
      const byte = (value >>> (i * 8)) & 255;
      hex += ('0' + byte.toString(16)).slice(-2);
    }
    return hex;
  }

  const x = convertToWordArray(string);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = ff(a, b, c, d, x[k], S11, 0xd76aa478);
    d = ff(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = ff(c, d, a, b, x[k + 2], S13, 0x242070db);
    b = ff(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = ff(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
    d = ff(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = ff(c, d, a, b, x[k + 6], S13, 0xa8304613);
    b = ff(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = ff(a, b, c, d, x[k + 8], S11, 0x698098d8);
    d = ff(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = ff(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
    b = ff(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = ff(a, b, c, d, x[k + 12], S11, 0x6b901122);
    d = ff(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = ff(c, d, a, b, x[k + 14], S13, 0xa679438e);
    b = ff(b, c, d, a, x[k + 15], S14, 0x49b40821);
    a = gg(a, b, c, d, x[k + 1], S21, 0xf61e2562);
    d = gg(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = gg(c, d, a, b, x[k + 11], S23, 0x265e5a51);
    b = gg(b, c, d, a, x[k], S24, 0xe9b6c7aa);
    a = gg(a, b, c, d, x[k + 5], S21, 0xd62f105d);
    d = gg(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = gg(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
    b = gg(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = gg(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
    d = gg(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = gg(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
    b = gg(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = gg(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
    d = gg(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = gg(c, d, a, b, x[k + 7], S23, 0x676f02d9);
    b = gg(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
    a = hh(a, b, c, d, x[k + 5], S31, 0xfffa3942);
    d = hh(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = hh(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
    b = hh(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = hh(a, b, c, d, x[k + 1], S31, 0xa4beea44);
    d = hh(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = hh(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
    b = hh(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = hh(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
    d = hh(d, a, b, c, x[k], S32, 0xeaa127fa);
    c = hh(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
    b = hh(b, c, d, a, x[k + 6], S34, 0x4881d05);
    a = hh(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
    d = hh(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = hh(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
    b = hh(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
    a = ii(a, b, c, d, x[k], S41, 0xf4292244);
    d = ii(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = ii(c, d, a, b, x[k + 14], S43, 0xab9423a7);
    b = ii(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = ii(a, b, c, d, x[k + 12], S41, 0x655b59c3);
    d = ii(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = ii(c, d, a, b, x[k + 10], S43, 0xffeff47d);
    b = ii(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = ii(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
    d = ii(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = ii(c, d, a, b, x[k + 6], S43, 0xa3014314);
    b = ii(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = ii(a, b, c, d, x[k + 4], S41, 0xf7537e82);
    d = ii(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = ii(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
    b = ii(b, c, d, a, x[k + 9], S44, 0xeb86d391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

export class NavidromeAuth {
  constructor() {
    this.serverUrl = null;
    this.username = null;
    this.token = null;
    this.salt = null;
  }

  /**
   * Generate Subsonic authentication token
   * Token = MD5(password + salt)
   * @param {string} password
   * @returns {{token: string, salt: string}}
   */
  async generateToken(password) {
    const salt = crypto.randomUUID().substring(0, 16);
    const token = md5Fallback(password + salt);
    return { token, salt };
  }

  /**
   * Build authentication parameters for Subsonic API
   * @returns {URLSearchParams}
   */
  getAuthParams() {
    return new URLSearchParams({
      u: this.username,
      t: this.token,
      s: this.salt,
      v: '1.16.1',
      c: 'musicViz',
      f: 'json'
    });
  }

  /**
   * Test connection to Navidrome server
   * @param {string} serverUrl
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{success: boolean, error?: string, serverInfo?: object}>}
   */
  async testConnection(serverUrl, username, password) {
    try {
      const { token, salt } = await this.generateToken(password);

      const params = new URLSearchParams({
        u: username,
        t: token,
        s: salt,
        v: '1.16.1',
        c: 'musicViz',
        f: 'json'
      });

      // Normalize server URL (remove trailing slash)
      const normalizedUrl = serverUrl.replace(/\/$/, '');
      const pingUrl = `${normalizedUrl}/rest/ping?${params}`;

      console.log('[NavidromeAuth] Testing connection to:', normalizedUrl);

      const response = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server returned ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      const subsonicResponse = data['subsonic-response'];

      if (!subsonicResponse) {
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }

      if (subsonicResponse.status === 'ok') {
        console.log('[NavidromeAuth] Connection successful:', subsonicResponse);
        return {
          success: true,
          serverInfo: {
            version: subsonicResponse.version,
            type: subsonicResponse.type || 'subsonic',
            serverVersion: subsonicResponse.serverVersion
          }
        };
      } else {
        const error = subsonicResponse.error;
        return {
          success: false,
          error: error?.message || `Error code ${error?.code}: Authentication failed`
        };
      }
    } catch (error) {
      console.error('[NavidromeAuth] Connection test failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to server'
      };
    }
  }

  /**
   * Store credentials securely via Tauri backend
   * @param {string} serverUrl
   * @param {string} username
   * @param {string} password
   * @returns {Promise<void>}
   */
  async storeCredentials(serverUrl, username, password) {
    // Normalize URL
    const normalizedUrl = serverUrl.replace(/\/$/, '');

    await invoke('store_navidrome_credentials', {
      serverUrl: normalizedUrl,
      username,
      password
    });

    // Generate and store token for this session
    const { token, salt } = await this.generateToken(password);
    this.serverUrl = normalizedUrl;
    this.username = username;
    this.token = token;
    this.salt = salt;

    console.log('[NavidromeAuth] Credentials stored for:', username);
  }

  /**
   * Load stored credentials from Tauri backend
   * @returns {Promise<{serverUrl: string, username: string, password: string} | null>}
   */
  async getStoredCredentials() {
    try {
      const creds = await invoke('get_navidrome_credentials');

      if (!creds) {
        return null;
      }

      // Generate token from stored password
      const { token, salt } = await this.generateToken(creds.password);
      this.serverUrl = creds.server_url;
      this.username = creds.username;
      this.token = token;
      this.salt = salt;

      return {
        serverUrl: creds.server_url,
        username: creds.username,
        password: creds.password
      };
    } catch (error) {
      console.error('[NavidromeAuth] Failed to get stored credentials:', error);
      return null;
    }
  }

  /**
   * Check if authenticated (has valid stored credentials)
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const creds = await this.getStoredCredentials();
      if (!creds) {
        return false;
      }

      // Verify credentials still work
      const result = await this.testConnection(creds.serverUrl, creds.username, creds.password);
      return result.success;
    } catch (error) {
      console.error('[NavidromeAuth] Auth check failed:', error);
      return false;
    }
  }

  /**
   * Logout - clear stored credentials
   * @returns {Promise<void>}
   */
  async logout() {
    await invoke('navidrome_logout');
    this.serverUrl = null;
    this.username = null;
    this.token = null;
    this.salt = null;
    console.log('[NavidromeAuth] Logged out');
  }

  /**
   * Get current server URL
   * @returns {string | null}
   */
  getServerUrl() {
    return this.serverUrl;
  }

  /**
   * Get current username
   * @returns {string | null}
   */
  getUsername() {
    return this.username;
  }

  /**
   * Check if session is initialized (token generated)
   * @returns {boolean}
   */
  isSessionInitialized() {
    return !!(this.serverUrl && this.username && this.token && this.salt);
  }
}
