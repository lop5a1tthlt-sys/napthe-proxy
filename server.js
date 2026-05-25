const express = require('express');
const https   = require('https');
const http    = require('http');
const qs      = require('querystring');
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// CONFIG (tương đương config.php)
// ============================================================
const PARTNER_ID  = '60034605186';
const PARTNER_KEY = '83fcf6e737c746e2d2352bd8d55c430a';
const TSR_URL     = 'https://thesieure.com/chargingws/v2';
const LOG_FILE    = path.join(__dirname, 'lognapthe.txt');

// ============================================================
// HELPER: gọi HTTP/HTTPS POST (thay cURL)
// ============================================================
function postRequest(urlStr, postData) {
  return new Promise((resolve, reject) => {
    const u       = new URL(urlStr);
    const body    = qs.stringify(postData);
    const isHttps = u.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const options = {
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = lib.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// HELPER: MD5
// ============================================================
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// ============================================================
// HELPER: ghi log
// ============================================================
function writeLog(line) {
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
}

// ============================================================
// ROUTE: POST /napthe  (tương đương index.php)
// Nhận request từ index.html, ký MD5, gọi TSR, trả JSON
// ============================================================
app.post('/napthe', async (req, res) => {
  try {
    const { telco, code, serial, amount, request_id } = req.body;

    if (!telco || !code || !serial || !amount) {
      return res.status(400).json({ error: 'Thiếu tham số' });
    }

    // Tạo chữ ký MD5 (giống index.php)
    const payload = { request_id, code, partner_id: PARTNER_ID, serial, telco, command: 'charging' };
    const sorted  = Object.keys(payload).sort().reduce((o, k) => { o[k] = payload[k]; return o; }, {});
    let signStr   = PARTNER_KEY;
    Object.values(sorted).forEach(v => signStr += v);
    const sign    = md5(signStr);

    const postData = { ...sorted, amount, sign };

    const raw    = await postRequest(TSR_URL, postData);
    const result = JSON.parse(raw);

    // Ghi log
    writeLog(`${result.status}|${result.message}|${amount}|${code}|${serial}|${telco}|${result.trans_id || ''}`);

    res.json(result);
  } catch (err) {
    console.error('napthe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ROUTE: GET /callback  (tương đương callback.php)
// TSR gọi về đây sau khi xử lý thẻ pending
// ============================================================
app.get('/callback', (req, res) => {
  const { status, code, serial, trans_id, telco, callback_sign, message, value, amount } = req.query;

  if (!status || !code || !serial || !trans_id || !telco || !callback_sign) {
    return res.status(403).send('No permission to access here');
  }

  // Kiểm tra chữ ký MD5
  const checkSign = md5(PARTNER_KEY + code + serial);
  if (callback_sign !== checkSign) {
    writeLog('CHỮ KÝ MD5 KHÔNG HỢP LỆ');
    return res.status(403).send('Invalid sign');
  }

  // Ghi log callback
  writeLog(`${status}|${message}|${value}|${code}|${serial}|${telco}|${trans_id}`);

  // Xử lý theo trạng thái
  const s = parseInt(status);
  if (s === 1) {
    // Thẻ thành công → cộng tiền, cập nhật DB, v.v.
    console.log(`[CALLBACK] Thành công: ${telco} ${value}đ serial=${serial}`);
  } else if (s === 2) {
    // Thành công nhưng sai mệnh giá
    console.log(`[CALLBACK] Sai mệnh giá: nhận ${value}đ thay vì ${amount}đ`);
  } else if (s === 3) {
    // Thẻ sai
    console.log(`[CALLBACK] Thẻ sai: serial=${serial}`);
  } else if (s === 4) {
    // Nhà mạng bảo trì
    console.log(`[CALLBACK] Nhà mạng bảo trì: ${telco}`);
  } else if (s === 99) {
    // Vẫn đang chờ xử lý
    console.log(`[CALLBACK] Đang chờ xử lý: serial=${serial}`);
  }

  res.send('OK');
});

// ============================================================
// ROUTE: GET /log  (xem log nhanh, nên xoá khi chạy thật)
// ============================================================
app.get('/log', (req, res) => {
  try {
    const content = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '(chưa có log)';
    res.type('text/plain').send(content);
  } catch {
    res.send('Không đọc được log');
  }
});

// ============================================================
// Serve static files (index.html và assets)
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server chạy tại port ${PORT}`));
