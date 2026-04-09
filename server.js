/**
 * Telegram Mass Inviter Bot - Production Fix v2
 * Optimized for Render (Free Tier) with Webhook/Polling Auto-Switch
 */

require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// --- Global Configuration ---
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;
// Use Render's built-in URL variable, fallback to user-provided APP_URL
const APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;

// --- Validation ---
if (!BOT_TOKEN) {
  console.error('❌ CRITICAL ERROR: BOT_TOKEN is missing! Please set it in your environment variables.');
  process.exit(1);
}

// --- Database Setup ---
const db = new Database('bot_stats.db');
db.pragma('journal_mode = WAL');
db.prepare(`CREATE TABLE IF NOT EXISTS stats (key TEXT UNIQUE, value INTEGER DEFAULT 0)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS members (username TEXT UNIQUE, status TEXT DEFAULT 'scraped')`).run();
['success', 'failed', 'scraped'].forEach(k => db.prepare('INSERT OR IGNORE INTO stats (key, value) VALUES (?, 0)').run(k));
console.log('✅ [DB] Database connected and initialized.');

// --- Express App Setup ---
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// --- Bot Initialization (Smart Webhook/Polling) ---
let bot;

if (process.env.NODE_ENV === 'production' && APP_URL) {
  // PRODUCTION MODE: Use Webhook
  console.log('[SYSTEM] Production mode detected. Initializing bot with Webhook.');
  bot = new TelegramBot(BOT_TOKEN, { polling: false });
  const webhookPath = `/bot${BOT_TOKEN}`;
  const webhookUrl = `${APP_URL.replace(/\/$/, '')}${webhookPath}`;
  
  bot.setWebHook(webhookUrl)
    .then(() => console.log(`✅ [TELEGRAM] Webhook successfully set to: ${webhookUrl}`))
    .catch(err => console.error(`❌ [TELEGRAM] Webhook setup failed:`, err.message));

  // Webhook Route
  app.post(webhookPath, (req, res) => {
    console.log(`📩 [TELEGRAM] Incoming update received via Webhook.`);
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

} else {
  // DEVELOPMENT MODE: Use Polling
  console.log(`[SYSTEM] Development mode detected. Initializing bot with Polling.`);
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  bot.on('polling_error', (err) => console.error(`❌ [TELEGRAM] Polling error:`, err.code));
  console.log(`✅ [TELEGRAM] Polling started successfully.`);
}

// --- Bot Logic & Handlers ---

// Debug log for all messages
bot.on('message', (msg) => {
  console.log(`👤 [USER ${msg.from.id}] Message: "${msg.text || '[Non-text message]'}"`);
});

bot.onText(/\/start/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  
  const welcome = `🚀 *Bot is ACTIVE!*\n\nStatus: Online\nMode: ${APP_URL ? 'Webhook' : 'Polling'}\n\nUse /stats to see activity.`;
  bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' })
    .then(() => console.log(`📤 [BOT] Sent /start response to ${msg.from.id}`))
    .catch(e => console.error(`❌ [BOT] Failed to send message:`, e.message));
});

bot.onText(/\/stats/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  const stats = db.prepare('SELECT key, value FROM stats').all().reduce((a, r) => ({ ...a, [r.key]: r.value }), {});
  const queue = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
  
  const text = `📊 *Live Stats:*\n✅ Success: ${stats.success || 0}\n❌ Failed: ${stats.failed || 0}\n🔍 Scraped: ${stats.scraped || 0}\n👥 Queue: ${queue || 0}`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// --- Dashboard & API ---
app.get('/', (req, res) => res.send('🤖 Bot is Active. Dashboard: /dashboard'));
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/dashboard', (req, res) => {
  const stats = db.prepare('SELECT key, value FROM stats').all().reduce((a, r) => ({ ...a, [r.key]: r.value }), {});
  res.send(`<h1>Bot Dashboard</h1><p>Success: ${stats.success || 0}</p><p>Failed: ${stats.failed || 0}</p>`);
});

// --- Global Error Handlers ---
process.on('uncaughtException', (err, origin) => console.error(`🔥 CRITICAL UNCAUGHT EXCEPTION: ${err.message}`, { origin, err }));
process.on('unhandledRejection', (reason, promise) => console.error('🔥 UNHANDLED REJECTION:', { reason, promise }));

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [SERVER] Listening on port ${PORT}`);
  console.log(`🔗 [SERVER] Health check: http://localhost:${PORT}/health`);
});
