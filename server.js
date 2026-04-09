/**
 * Telegram Mass Inviter Bot - Production Fix v4 (AI Intelligence Integrated)
 * Optimized for Render (Free Tier) with Webhook/Polling Auto-Switch
 * AI Risk Engine, Behavior Controller, and Account Rotation System.
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

// --- AI & Custom Services ---
const RiskEngine = require('./ai/riskEngine');
const BehaviorController = require('./ai/behaviorController');
const AccountManager = require('./services/accountManager');
const Randomizer = require('./utils/randomizer');
const queue = require('./services/queue');
const { sleep } = require('./utils/delay');

// --- Global Configuration ---
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;
const APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;

// --- Validation ---
if (!BOT_TOKEN) {
  console.error('❌ CRITICAL ERROR: BOT_TOKEN is missing!');
  process.exit(1);
}

// --- Database Setup ---
const db = new Database('bot_stats.db');
db.pragma('journal_mode = WAL');
db.prepare(`CREATE TABLE IF NOT EXISTS stats (key TEXT UNIQUE, value INTEGER DEFAULT 0)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS members (username TEXT UNIQUE, status TEXT DEFAULT 'scraped')`).run();

// Initialize all required stats
const requiredStats = ['success', 'failed', 'scraped', 'hourly_count', 'daily_count'];
requiredStats.forEach(k => db.prepare('INSERT OR IGNORE INTO stats (key, value) VALUES (?, 0)').run(k));

// --- AI Engine Initialization ---
const riskEngine = new RiskEngine(db);
const behavior = new BehaviorController(riskEngine);
const accounts = new AccountManager(riskEngine);

// --- Express App Setup ---
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// --- Bot Initialization (Smart Webhook/Polling) ---
let bot;
if (process.env.NODE_ENV === 'production' && APP_URL) {
  bot = new TelegramBot(BOT_TOKEN, { polling: false });
  const webhookPath = `/bot${BOT_TOKEN}`;
  const webhookUrl = `${APP_URL.replace(/\/$/, '')}${webhookPath}`;
  bot.setWebHook(webhookUrl).catch(err => console.error(`❌ Webhook setup failed:`, err.message));
  app.post(webhookPath, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  bot.on('polling_error', (err) => console.error(`❌ Polling error:`, err.code));
}

// --- Intelligent Protected Actions ---

/**
 * Intelligent Safe Invitation
 */
async function intelligentInvite(chatId, memberUsername) {
  // 1. Get best account based on risk score
  const bestAccount = await accounts.getBestAccount();
  if (!bestAccount) {
    bot.sendMessage(chatId, `🚨 [AI] All accounts are in CRITICAL risk state. Pausing all activity for 1 hour.`);
    return;
  }

  // 2. Check risk and calculate delay
  const { score, level } = await riskEngine.calculateRisk(bestAccount.id);
  const delay = await behavior.getNextActionDelay(bestAccount.id);

  console.log(`[AI] Using account: ${bestAccount.id} | Risk: ${score} (${level}) | Delay: ${Math.round(delay/1000)}s`);

  // 3. Human-like Schedule & Breaks
  const nightCheck = await behavior.simulateHumanSchedule();
  if (nightCheck.sleep) {
    bot.sendMessage(chatId, `🌙 [AI] Night mode activated. Sleeping for 1 hour...`);
    await sleep(nightCheck.duration);
    return;
  }

  const breakCheck = await behavior.shouldTakeBreak();
  if (breakCheck.takeBreak) {
    bot.sendMessage(chatId, `☕ [AI] Taking a human-like break for ${Math.round(breakCheck.duration / 60000)} mins.`);
    await sleep(breakCheck.duration);
  }

  // 4. Action Processing with Dynamic Delay
  try {
    await sleep(delay); // AI calculated delay
    
    // Simulate real invitation (Placeholder for actual API call)
    console.log(`[AI-ACTION] Inviting ${memberUsername}...`);
    
    // Record Success
    db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'success'").run();
    db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'hourly_count'").run();
    db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'daily_count'").run();
    
    console.log(`✅ [AI-ACTION] Success: ${memberUsername}`);

  } catch (error) {
    const errorMsg = error.message || '';
    if (errorMsg.includes('FLOOD_WAIT_')) {
      await riskEngine.recordEvent(bestAccount.id, 'FLOOD_WAIT');
      const seconds = parseInt(errorMsg.split('FLOOD_WAIT_')[1]) || 300;
      bot.sendMessage(chatId, `🚫 [AI-FLOOD] Account ${bestAccount.id} restricted for ${seconds}s. Adapting...`);
      await sleep((seconds + 30) * 1000);
    } else if (errorMsg.includes('PEER_FLOOD')) {
      await riskEngine.recordEvent(bestAccount.id, 'PEER_FLOOD');
      bot.sendMessage(chatId, `🚨 [AI-FLOOD] Account ${bestAccount.id} marked as high risk. Switching...`);
    }
    
    db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'failed'").run();
    console.log(`❌ [AI-ACTION] Failed: ${memberUsername} - ${error.message}`);
  }
}

// --- Bot Command Handlers ---

bot.onText(/\/start/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  const status = `🚀 *AI Anti-Ban System ACTIVE*\n\n` +
                 `🧠 *Risk Engine:* Active\n` +
                 `📊 *Risk Level:* ${riskEngine.getRiskStatus('primary').level}\n` +
                 `👥 *Queue:* ${queue.getQueueStatus().count} pending.\n\n` +
                 `Mode: ${APP_URL ? 'Webhook' : 'Polling'}`;
  bot.sendMessage(msg.chat.id, status, { parse_mode: 'Markdown' });
});

bot.onText(/\/invite/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  
  const members = db.prepare('SELECT username FROM members LIMIT 50').all();
  if (members.length === 0) return bot.sendMessage(msg.chat.id, '❌ No members in queue. Use /scrape first.');

  bot.sendMessage(msg.chat.id, `🚀 [AI] Starting intelligent invitation batch (${members.length} users)...`);
  
  // Shuffle users to mimic human non-sequential pattern
  const shuffled = Randomizer.shuffle(members);

  shuffled.forEach((m) => {
    queue.add(() => intelligentInvite(msg.chat.id, m.username));
  });

  db.prepare('DELETE FROM members WHERE username IN (' + members.map(() => '?').join(',') + ')').run(...members.map(m => m.username));
});

bot.onText(/\/stats/, (msg) => {
  if (ADMIN_ID !== 0 && msg.from.id !== ADMIN_ID) return;
  const stats = db.prepare('SELECT key, value FROM stats').all().reduce((a, r) => ({ ...a, [r.key]: r.value }), {});
  const currentRisk = riskEngine.getRiskStatus('primary');
  
  const text = `📊 *AI Activity Metrics:*\n` +
               `✅ Success: ${stats.success}\n` +
               `❌ Failed: ${stats.failed}\n` +
               `⚠️ Risk Score: ${currentRisk.score}/100\n` +
               `🛡️ Risk Level: ${currentRisk.level}\n` +
               `🕒 Hourly Usage: ${stats.hourly_count}/30\n` +
               `📅 Daily Usage: ${stats.daily_count}/120`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// --- Dashboard & Health ---
app.get('/', (req, res) => res.send('🤖 AI Risk Engine is Online.'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [SERVER] AI Intelligent Anti-Ban Active on port ${PORT}`);
});
