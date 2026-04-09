const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const https = require('https');

// ACS uses self-signed certs — ignore cert errors for internal network calls
const acsAgent = new https.Agent({ rejectUnauthorized: false });

const app = express();
app.use(express.json());
app.use(cors());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {
      snipeItUrl: '',
      snipeItToken: '',
      cameraStreamUrl: '',
      cameraSnapshotUrl: '',
      cameraUsername: '',
      cameraPassword: '',
      cameraType: 'webcam',
      adminPin: '1234',
      durationPresets: [
        { label: '1 Hour', hours: 1 },
        { label: 'Half Day', hours: 4 },
        { label: '1 Day', hours: 24 },
        { label: '1 Week', hours: 168, default: true },
      ],
    };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function snipeHeaders(config) {
  return {
    Authorization: `Bearer ${config.snipeItToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

// --- ACS helpers ---

function acsHeaders(config) {
  const creds = Buffer.from(`${config.acsUsername}:${config.acsPassword}`).toString('base64');
  return {
    Authorization: `Basic ${creds}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function acsTimestamp(date = new Date()) {
  // ACS format: "YYYY-MM-DD hh:mm:ss.0000000"
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.0000000`;
}

async function sendToAcs(config, { assetName, assetModel, serial, userName, dueDate, action }) {
  if (!config.acsEnabled) { console.log('[ACS] Skipped — acsEnabled is false'); return; }
  if (!config.acsUrl || !config.acsUsername || !config.acsSourceKey) {
    console.log('[ACS] Skipped — missing url/username/sourceKey');
    return;
  }

  const data = {
    Asset:  { DataType: 'Text', Value: assetName  || '' },
    Model:  { DataType: 'Text', Value: assetModel || '' },
    Serial: { DataType: 'Text', Value: serial     || 'N/A' },
    User:   { DataType: 'Text', Value: userName   || '' },
    Action: { DataType: 'Text', Value: action     || '' },
  };
  if (action === 'Checkout' && dueDate) {
    data.Due = { DataType: 'Text', Value: dueDate };
  }

  const payload = {
    addExternalDataRequest: {
      source:           config.acsSourceKey,
      externalDataType: 'AssetCheckout',
      data,
    },
  };

  const acsEndpoint = `${config.acsUrl}/Acs/Api/ExternalDataFacade/AddExternalData`;
  console.log('[ACS] Sending to:', acsEndpoint);
  console.log('[ACS] Payload:', JSON.stringify(payload));

  const response = await axios.post(acsEndpoint, payload, { headers: acsHeaders(config), httpsAgent: acsAgent, timeout: 8000 });
  console.log('[ACS] Success — status:', response.status, 'response:', JSON.stringify(response.data));
}

function cameraAuth(config) {
  if (config.cameraUsername && config.cameraPassword) {
    return { username: config.cameraUsername, password: config.cameraPassword };
  }
  return undefined;
}

// --- Config endpoints ---

app.get('/api/config/public', (req, res) => {
  const config = loadConfig();
  res.json({
    cameraType: config.cameraType,
    cameraStreamUrl: config.cameraStreamUrl,
    durationPresets: config.durationPresets,
    hasSnipeIt: !!(config.snipeItUrl && config.snipeItToken),
    hasCamera: !!(config.cameraStreamUrl || config.cameraType === 'webcam'),
  });
});

function requireAdmin(req, res) {
  const config = loadConfig();
  const username = (req.body?.adminUsername || req.query?.adminUsername || '').toLowerCase();
  const adminUsers = (config.adminUsers || []).map((u) => u.toLowerCase());
  if (!username || !adminUsers.includes(username)) {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }
  return true;
}

app.get('/api/admin/config', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const config = loadConfig();
  res.json({
    snipeItUrl: config.snipeItUrl,
    snipeItToken: config.snipeItToken,
    cameraStreamUrl: config.cameraStreamUrl,
    cameraSnapshotUrl: config.cameraSnapshotUrl,
    cameraUsername: config.cameraUsername,
    cameraPassword: config.cameraPassword,
    cameraType: config.cameraType,
    adminUsers: config.adminUsers || [],
    durationPresets: config.durationPresets,
    acsEnabled: config.acsEnabled || false,
    acsUrl: config.acsUrl || '',
    acsUsername: config.acsUsername || '',
    acsPassword: config.acsPassword || '',
    acsSourceKey: config.acsSourceKey || 'predator-store-room',
  });
});

app.post('/api/admin/config', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { adminUsername, ...updates } = req.body;
  const config = loadConfig();
  saveConfig({ ...config, ...updates });
  res.json({ success: true });
});

// Test ACS connection
app.post('/api/acs/test', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const config = loadConfig();
  if (!config.acsUrl || !config.acsUsername) {
    return res.status(400).json({ error: 'ACS URL and username are required' });
  }
  console.log('[ACS TEST] Connecting to:', config.acsUrl);
  try {
    const response = await axios.post(
      `${config.acsUrl}/Acs/Api/VersionFacade/GetApiVersion`,
      {},
      { headers: acsHeaders(config), httpsAgent: acsAgent, timeout: 8000 }
    );
    console.log('[ACS TEST] Success:', response.data);
    res.json({ success: true, version: `${response.data.Major}.${response.data.Minor}` });
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error('[ACS TEST] Failed — status:', status, 'body:', body, 'msg:', err.message);
    res.status(502).json({
      error: status === 401 ? 'Invalid ACS credentials (401)' : 'Cannot connect to ACS',
      status,
      detail: body || err.message,
    });
  }
});

// Create external data source in ACS (one-time setup)
app.post('/api/acs/setup-source', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const config = loadConfig();
  if (!config.acsUrl || !config.acsUsername || !config.acsSourceKey) {
    return res.status(400).json({ error: 'ACS URL, username, and source key are required' });
  }
  console.log('[ACS SETUP] Creating source key:', config.acsSourceKey, 'at:', config.acsUrl);
  try {
    const response = await axios.post(
      `${config.acsUrl}/Acs/Api/ExternalDataSourceFacade/AddExternalDataSource`,
      {
        AddExternalDataSourceRequest: {
          Key:        config.acsSourceKey,
          Name:       'Predator Store Room',
          GroupNames: [],
        },
      },
      { headers: acsHeaders(config), httpsAgent: acsAgent, timeout: 8000 }
    );
    console.log('[ACS SETUP] Created:', response.data);
    res.json({ success: true, sourceId: response.data?.SourceId?.Id });
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error('[ACS SETUP] Failed — status:', status, 'body:', JSON.stringify(body), 'msg:', err.message);
    res.status(502).json({
      error: status === 401 ? 'Invalid ACS credentials (401)' : 'Failed to create data source',
      status,
      detail: body || err.message,
    });
  }
});

// Probe AddExternalData — tries the correct PS-script format and fallbacks
app.post('/api/acs/probe', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const config = loadConfig();
  const results = [];
  const base = `${config.acsUrl}/Acs/Api/ExternalDataFacade/AddExternalData`;
  const hdrs = acsHeaders(config);

  const testData = {
    Asset:  { DataType: 'Text', Value: 'Test Asset' },
    Tag:    { DataType: 'Text', Value: 'TEST-001' },
    Action: { DataType: 'Text', Value: 'Probe' },
  };

  const attempts = [
    // Correct format from PowerShell script
    {
      label: 'addExternalDataRequest wrapper (PS script format)',
      body: {
        addExternalDataRequest: {
          occurrenceTime:   acsTimestamp(),
          source:           config.acsSourceKey,
          externalDataType: 'AssetCheckout',
          data:             testData,
        },
      },
    },
    // Variations to try if above fails
    {
      label: 'AddExternalDataRequest wrapper (PascalCase)',
      body: {
        AddExternalDataRequest: {
          OccurrenceTime:   acsTimestamp(),
          Source:           config.acsSourceKey,
          ExternalDataType: 'AssetCheckout',
          Data:             testData,
        },
      },
    },
    // Flat camelCase
    {
      label: 'flat camelCase (source/externalDataType/data)',
      body: {
        occurrenceTime:   acsTimestamp(),
        source:           config.acsSourceKey,
        externalDataType: 'AssetCheckout',
        data:             testData,
      },
    },
  ];

  for (const attempt of attempts) {
    try {
      const r = await axios.post(base, attempt.body, { headers: hdrs, httpsAgent: acsAgent, timeout: 5000 });
      results.push({ label: attempt.label, status: r.status, response: r.data });
      break; // stop on first success
    } catch (e) {
      results.push({ label: attempt.label, status: e.response?.status, error: e.response?.data?.Message || e.message });
    }
  }

  console.log('[ACS PROBE]', JSON.stringify(results, null, 2));
  res.json(results);
});

// List existing external data in ACS to verify source is working
app.post('/api/acs/verify', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const config = loadConfig();
  try {
    const response = await axios.post(
      `${config.acsUrl}/Acs/Api/ExternalDataFacade/GetExternalData`,
      { Limit: 5, Sources: [config.acsSourceKey], StartTime: '2020-01-01 00:00:00' },
      { headers: acsHeaders(config), httpsAgent: acsAgent, timeout: 8000 }
    );
    console.log('[ACS VERIFY]', JSON.stringify(response.data));
    res.json({ success: true, data: response.data });
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error('[ACS VERIFY] Failed:', status, JSON.stringify(body));
    res.status(502).json({ error: 'Verify failed', status, detail: body || err.message });
  }
});

// --- Image proxy (avoids mixed-content when Snipe-IT serves HTTP images on an HTTPS kiosk) ---

app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');
  const config = loadConfig();
  // Only proxy images from the configured Snipe-IT host to prevent open-proxy abuse
  const snipeHost = config.snipeItUrl ? new URL(config.snipeItUrl).host : null;
  let targetHost;
  try { targetHost = new URL(url).host; } catch { return res.status(400).send('Invalid url'); }
  if (!snipeHost || targetHost !== snipeHost) {
    return res.status(403).send('Proxy only permitted for configured Snipe-IT host');
  }
  try {
    const response = await axios.get(url, { responseType: 'stream', timeout: 8000 });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.data.pipe(res);
    response.data.on('error', () => res.end());
  } catch {
    res.status(502).send('Image unavailable');
  }
});

// --- Camera endpoints ---

app.get('/api/camera/stream', (req, res) => {
  const config = loadConfig();
  if (!config.cameraStreamUrl) return res.status(404).send('Camera not configured');

  axios({
    method: 'get',
    url: config.cameraStreamUrl,
    responseType: 'stream',
    auth: cameraAuth(config),
    timeout: 30000,
  })
    .then((response) => {
      const contentType = response.headers['content-type'] || 'multipart/x-mixed-replace';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      response.data.pipe(res);
      response.data.on('error', () => res.end());
    })
    .catch(() => res.status(503).send('Camera unavailable'));
});

app.get('/api/camera/snapshot', async (req, res) => {
  const config = loadConfig();
  const url = config.cameraSnapshotUrl || config.cameraStreamUrl;
  if (!url) return res.status(404).send('Camera not configured');

  try {
    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      auth: cameraAuth(config),
      timeout: 5000,
    });
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('multipart')) {
      // MJPEG stream — extract the first complete JPEG frame (FF D8 … FF D9)
      const jpeg = await new Promise((resolve, reject) => {
        let done = false;
        const chunks = [];
        response.data.on('data', (chunk) => {
          if (done) return;
          chunks.push(chunk);
          const buf = Buffer.concat(chunks);
          const start = buf.indexOf(Buffer.from([0xff, 0xd8]));
          if (start === -1) return;
          const end = buf.indexOf(Buffer.from([0xff, 0xd9]), start);
          if (end === -1) return;
          done = true;
          response.data.destroy();
          resolve(buf.slice(start, end + 2));
        });
        response.data.on('error', (err) => { if (!done) reject(err); });
        response.data.on('end', () => { if (!done) reject(new Error('No JPEG frame')); });
      });
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(jpeg);
    } else {
      const chunks = [];
      response.data.on('data', (chunk) => chunks.push(chunk));
      response.data.on('end', () => {
        res.setHeader('Content-Type', contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(Buffer.concat(chunks));
      });
      response.data.on('error', () => res.status(503).send('Snapshot unavailable'));
    }
  } catch {
    res.status(503).send('Snapshot unavailable');
  }
});

// --- Auth ---

app.post('/api/auth/login', async (req, res) => {
  const config = loadConfig();
  const { username, password } = req.body;

  if (!config.snipeItUrl || !config.snipeItToken) {
    return res.status(503).json({ error: 'Snipe-IT not configured' });
  }
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Step 1: fetch the login page to get the CSRF token
    const loginPage = await axios.get(`${config.snipeItUrl}/login`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const csrfMatch = loginPage.data.match(/name="_token"[^>]+value="([^"]+)"/);
    if (!csrfMatch) {
      return res.status(502).json({ error: 'Could not read Snipe-IT login page' });
    }

    const csrfToken = csrfMatch[1];
    const rawCookies = loginPage.headers['set-cookie'] || [];
    const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');

    // Step 2: submit credentials
    const loginResponse = await axios.post(
      `${config.snipeItUrl}/login`,
      new URLSearchParams({ _token: csrfToken, username, password }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieHeader,
          'User-Agent': 'Mozilla/5.0',
        },
        maxRedirects: 0,
        validateStatus: (s) => s < 500,
      }
    );

    // A redirect away from /login means success; redirect back to /login means wrong password
    const location = loginResponse.headers.location || '';
    const succeeded = loginResponse.status === 302 && !location.includes('/login');

    if (!succeeded) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    // Step 3: look up the user record via admin API to get their ID
    const userSearch = await axios.get(
      `${config.snipeItUrl}/api/v1/users?search=${encodeURIComponent(username)}&limit=10`,
      { headers: snipeHeaders(config) }
    );

    const rows = userSearch.data?.rows || [];
    const user = rows.find(
      (u) => u.username?.toLowerCase() === username.toLowerCase()
    ) || rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Credentials valid but user not found in API' });
    }

    const adminUsers = (config.adminUsers || []).map((u) => u.toLowerCase());
    const isAdmin = adminUsers.includes(username.toLowerCase());

    res.json({ success: true, user: { id: user.id, name: user.name, username: user.username }, isAdmin });
  } catch (err) {
    res.status(502).json({ error: 'Authentication failed', detail: err.message });
  }
});

// --- Snipe-IT endpoints ---

app.get('/api/users/search', async (req, res) => {
  const config = loadConfig();
  const { q } = req.query;
  if (!config.snipeItUrl || !config.snipeItToken) {
    return res.status(503).json({ error: 'Snipe-IT not configured' });
  }
  try {
    const response = await axios.get(
      `${config.snipeItUrl}/api/v1/users?search=${encodeURIComponent(q)}&limit=10&sort=name&order=asc`,
      { headers: snipeHeaders(config) }
    );
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Snipe-IT', detail: err.message });
  }
});

// Smart asset lookup: handles Snipe-IT QR URLs, asset tags, and numeric IDs
app.get('/api/assets/bytag/:tag', async (req, res) => {
  const config = loadConfig();
  if (!config.snipeItUrl || !config.snipeItToken) {
    return res.status(503).json({ error: 'Snipe-IT not configured' });
  }

  let scanned = decodeURIComponent(req.params.tag);
  console.log('[SCAN] Raw value:', scanned);

  // Snipe-IT short URL format: http://your-snipeit/ht/ASSET-TAG
  const shortUrlMatch = scanned.match(/\/ht\/(.+)$/);
  if (shortUrlMatch) {
    const tag = shortUrlMatch[1];
    console.log('[SCAN] Short URL, extracted tag:', tag);
    try {
      const response = await axios.get(
        `${config.snipeItUrl}/api/v1/hardware/bytag/${encodeURIComponent(tag)}`,
        { headers: snipeHeaders(config) }
      );
      return res.json(response.data);
    } catch (err) {
      if (err.response?.status === 404) return res.status(404).json({ error: 'Asset not found' });
      return res.status(502).json({ error: 'Failed to reach Snipe-IT', detail: err.message });
    }
  }

  // Snipe-IT full URL format: http://your-snipeit/hardware/123
  const urlMatch = scanned.match(/\/hardware\/(\d+)/);
  if (urlMatch) {
    console.log('[SCAN] Full URL, extracted ID:', urlMatch[1]);
    try {
      const response = await axios.get(
        `${config.snipeItUrl}/api/v1/hardware/${urlMatch[1]}`,
        { headers: snipeHeaders(config) }
      );
      return res.json(response.data);
    } catch (err) {
      if (err.response?.status === 404) return res.status(404).json({ error: 'Asset not found' });
      return res.status(502).json({ error: 'Failed to reach Snipe-IT', detail: err.message });
    }
  }

  // Numeric ID only
  if (/^\d+$/.test(scanned)) {
    try {
      const response = await axios.get(
        `${config.snipeItUrl}/api/v1/hardware/${scanned}`,
        { headers: snipeHeaders(config) }
      );
      return res.json(response.data);
    } catch (err) {
      // fall through to bytag
    }
  }

  // Asset tag lookup — exact match first
  // Note: Snipe-IT sometimes returns HTTP 200 with {status:'error'} instead of 404
  try {
    const response = await axios.get(
      `${config.snipeItUrl}/api/v1/hardware/bytag/${encodeURIComponent(scanned)}`,
      { headers: snipeHeaders(config) }
    );
    if (response.data?.id) return res.json(response.data); // found — return it
    // else: Snipe-IT returned 200+error body — fall through to search
  } catch (err) {
    if (err.response?.status !== 404) {
      return res.status(502).json({ error: 'Failed to reach Snipe-IT', detail: err.message });
    }
    // 404 — fall through to search
  }

  // Partial / case-insensitive search fallback (handles manual typing, wrong case, etc.)
  try {
    const response = await axios.get(
      `${config.snipeItUrl}/api/v1/hardware?search=${encodeURIComponent(scanned)}&limit=10&sort=asset_tag&order=asc`,
      { headers: snipeHeaders(config) }
    );
    const rows = response.data?.rows || [];
    if (rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    // Prefer exact case-insensitive tag match; otherwise first result
    const lower = scanned.toLowerCase();
    const exact = rows.find((r) => r.asset_tag?.toLowerCase() === lower);
    return res.json(exact || rows[0]);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Snipe-IT', detail: err.message });
  }
});

app.post('/api/assets/:id/checkout', async (req, res) => {
  const config = loadConfig();
  const { userId, expectedCheckin, note, assetName, assetModel, serial, userName } = req.body;
  try {
    const response = await axios.post(
      `${config.snipeItUrl}/api/v1/hardware/${req.params.id}/checkout`,
      {
        checkout_to_type: 'user',
        assigned_user: userId,
        expected_checkin: expectedCheckin,
        note: note || 'Checked out via kiosk',
      },
      { headers: snipeHeaders(config) }
    );

    // Fire-and-forget to ACS DataSearch
    sendToAcs(config, {
      assetName, assetModel, serial, userName,
      dueDate: expectedCheckin,
      action: 'Checkout',
    }).catch((e) => console.error('[ACS] checkout event failed — status:', e.response?.status, 'body:', JSON.stringify(e.response?.data), 'msg:', e.message));

    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Checkout failed', detail: err.response?.data || err.message });
  }
});

app.post('/api/assets/:id/checkin', async (req, res) => {
  const config = loadConfig();
  const { note, assetName, assetModel, serial, userName } = req.body;
  try {
    const response = await axios.post(
      `${config.snipeItUrl}/api/v1/hardware/${req.params.id}/checkin`,
      { note: note || 'Checked in via kiosk' },
      { headers: snipeHeaders(config) }
    );

    // Fire-and-forget to ACS DataSearch
    sendToAcs(config, {
      assetName, assetModel, serial, userName,
      action: 'Return',
    }).catch((e) => console.error('[ACS] checkin event failed — status:', e.response?.status, 'body:', JSON.stringify(e.response?.data), 'msg:', e.message));

    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Checkin failed', detail: err.response?.data || err.message });
  }
});

app.post('/api/assets/:id/image', upload.single('image'), async (req, res) => {
  const config = loadConfig();
  if (!config.snipeItUrl || !config.snipeItToken) {
    return res.status(503).json({ error: 'Snipe-IT not configured' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const form = new FormData();
  form.append('image', req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });
  form.append('_method', 'PATCH');

  try {
    const response = await axios.post(
      `${config.snipeItUrl}/api/v1/hardware/${req.params.id}`,
      form,
      {
        headers: {
          Authorization: `Bearer ${config.snipeItToken}`,
          Accept: 'application/json',
          ...form.getHeaders(),
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 502).json({
      error: 'Image upload failed',
      detail: err.response?.data || err.message,
    });
  }
});

// Get assets currently checked out to a specific user
app.get('/api/users/:userId/checkouts', async (req, res) => {
  const config = loadConfig();
  if (!config.snipeItUrl || !config.snipeItToken) {
    return res.status(503).json({ error: 'Snipe-IT not configured' });
  }
  try {
    const response = await axios.get(
      `${config.snipeItUrl}/api/v1/users/${req.params.userId}/assets`,
      { headers: snipeHeaders(config) }
    );
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Snipe-IT', detail: err.message });
  }
});

// Recent activity log (checkout/checkin events)
app.get('/api/admin/activity', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const config = loadConfig();
  if (!config.snipeItUrl || !config.snipeItToken) {
    return res.status(503).json({ error: 'Snipe-IT not configured' });
  }
  try {
    const response = await axios.get(
      `${config.snipeItUrl}/api/v1/reports/activity?limit=50`,
      { headers: snipeHeaders(config) }
    );
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch activity log', detail: err.message });
  }
});

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Kiosk backend running on http://localhost:${PORT}`);
});
