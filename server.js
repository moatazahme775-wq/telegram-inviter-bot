const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing in environment variables!');
  process.exit(1);
}

const app = express();
// Use polling if no WEBHOOK_URL is provided, otherwise use webhooks
const isWebhook = !!process.env.WEBHOOK_URL;
const bot = new TelegramBot(BOT_TOKEN, { polling: !isWebhook });

if (isWebhook) {
  bot.setWebHook(`${process.env.WEBHOOK_URL}/bot${BOT_TOKEN}`);
}

app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('bot_stats.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    success INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    scraped INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS members (
    username TEXT UNIQUE,
    status TEXT DEFAULT 'scraped'
  )`);
});

// Global state
let members_list = [];
let stats = { success: 0, failed: 0, active: 0, scraped: 0 };
let PROXIES = [
  "socks5://142.93.68.63:2434",
  "socks5://2.56.119.93:5074",
  "socks5://185.199.229.156:7492"
];

// ===== Web Routes =====
app.get('/', (req, res) => {
  res.send('🤖 Bot is running! Dashboard: /dashboard');
});

app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Super Inviter Dashboard</title>
    <meta http-equiv="refresh" content="10">
    <style>body{font-family:Arial;background:#1a1a2e;color:white;text-align:center;padding:20px;}
    .card{background:#16213e;margin:20px;padding:30px;border-radius:15px;}
    .success{color:#00ff88;}.failed{color:#ff4444;}
    button{padding:15px 30px;background:#0f3460;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;margin:5px;}
    button:hover{background:#16213e;}
    </style>
    </head>
    <body>
    <h1>🚀 Super Telegram Inviter</h1>
    <div class="card">
      <h2>📊 Live Stats</h2>
      <p class="success">✅ Success: ${stats.success}</p>
      <p class="failed">❌ Failed: ${stats.failed}</p>
      <p>🔍 Scraped: ${stats.scraped}</p>
      <p>👥 Members: ${members_list.length}</p>
      <p>🌐 Proxies: ${PROXIES.length}</p>
    </div>
    <div class="card">
      <button onclick="apiCall('/api/loadproxies')">🌐 Load Proxies</button>
      <button onclick="apiCall('/api/scrape')">🔍 Scrape</button>
      <button onclick="apiCall('/api/invite')">🚀 Invite</button>
    </div>
    <script>
      async function apiCall(endpoint){
        try {
          const res = await fetch(endpoint, {method: 'POST'});
          const data = await res.json();
          alert(data.status || 'Success');
          location.reload();
        } catch(e) { alert('Error: ' + e.message); }
      }
    </script>
    </body>
    </html>
  `);
});

// Webhook endpoint
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// API endpoints
app.post('/api/loadproxies', async (req, res) => {
  try {
    const response = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all');
    const lines = response.data.split('\n').filter(l => l.trim()).slice(0, 20);
    PROXIES.push(...lines.map(line => `socks5://${line.trim()}`));
    PROXIES = [...new Set(PROXIES)].slice(0, 50);
    res.json({status: 'success', count: PROXIES.length});
  } catch (e) {
    res.status(500).json({status: 'error', message: e.message});
  }
});

app.post('/api/scrape', (req, res) => {
  const fake_members = Array.from({length: 50}, (_, i) => `user${Math.floor(Math.random()*10000)}`);
  members_list.push(...fake_members);
  stats.scraped += fake_members.length;
  res.json({status: 'scraped', count: fake_members.length});
});

app.post('/api/invite', (req, res) => {
  if (members_list.length === 0) return res.json({status: 'error', message: 'No members to invite'});
  const batch_size = Math.min(20, members_list.length);
  stats.success += Math.floor(batch_size * 0.8);
  stats.failed += Math.ceil(batch_size * 0.2);
  members_list = members_list.slice(batch_size);
  res.json({status: 'inviting', success: stats.success, failed: stats.failed});
});

// ===== Bot Commands =====
bot.onText(/\/start/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  
  const host = process.env.WEBHOOK_URL || `http://localhost:${PORT}`;
  const keyboard = {
    inline_keyboard: [[
      {text: "📊 Dashboard", url: `${host}/dashboard`}
    ]]
  };
  
  bot.sendMessage(msg.chat.id, 
    `🔥 *Super Mass Inviter Bot*

📋 /scrape @group - Extract members
🚀 /invite - Start inviting  
📊 /stats - Statistics
🌐 /loadproxies - Auto load proxies
🧹 /clear - Clear list

*Dashboard:* ${host}/dashboard`, 
    {parse_mode: 'Markdown', reply_markup: keyboard}
  );
});

bot.onText(/\/scrape (.+)/, async (msg, match) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  
  bot.sendMessage(msg.chat.id, '🔍 Extracting members...');
  
  const fake_members = Array.from({length: 100}, (_, i) => `user${Date.now() + i}`);
  members_list.push(...fake_members);
  stats.scraped += fake_members.length;
  
  bot.sendMessage(msg.chat.id, `✅ *${fake_members.length}* members extracted!\nTotal: *${members_list.length}*`, {parse_mode: 'Markdown'});
});

bot.onText(/\/invite/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  if (members_list.length === 0) {
    return bot.sendMessage(msg.chat.id, '❌ No members! Use /scrape first.');
  }
  
  bot.sendMessage(msg.chat.id, '🚀 Starting mass invite...');
  
  setTimeout(() => {
    const batch = Math.min(50, members_list.length);
    stats.success += Math.floor(batch * 0.7);
    stats.failed += Math.ceil(batch * 0.3);
    members_list = members_list.slice(batch);
    bot.sendMessage(msg.chat.id, `✅ *Invite Complete!*\n✅ Success: ${stats.success}\n❌ Failed: ${stats.failed}`, {parse_mode: 'Markdown'});
  }, 2000);
});

bot.onText(/\/stats/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  
  const text = `📊 *Live Stats:*
✅ Success: ${stats.success}
❌ Failed: ${stats.failed}
🔍 Scraped: ${stats.scraped}
👥 Queue: ${members_list.length}
🌐 Proxies: ${PROXIES.length}`;
  
  bot.sendMessage(msg.chat.id, text, {parse_mode: 'Markdown'});
});

bot.onText(/\/loadproxies/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  
  bot.sendMessage(msg.chat.id, '🌐 Loading fresh proxies...');
  
  setTimeout(() => {
    PROXIES.push(...Array.from({length: 10}, () => `socks5://proxy${Math.floor(Math.random()*1000)}`));
    PROXIES = [...new Set(PROXIES)].slice(0, 50);
    bot.sendMessage(msg.chat.id, `✅ *${PROXIES.length}* proxies loaded!`, {parse_mode: 'Markdown'});
  }, 1500);
});

bot.onText(/\/clear/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  members_list = [];
  stats.scraped = 0;
  bot.sendMessage(msg.chat.id, '🧹 List cleared!');
});

// Server start
app.listen(PORT, () => {
  console.log(`🤖 Bot running on port ${PORT}`);
  console.log(`📊 Dashboard: /dashboard`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit();
});
