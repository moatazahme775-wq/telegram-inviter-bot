/**
 * Anti-Ban System for Telegram
 * Handles rate limits, flood protection, and cooldowns.
 */

const { randomDelay, sleep } = require('./delay');

class AntiBanSystem {
  constructor(db) {
    this.db = db;
    this.limits = {
      hourly: 30, // Max 30 invites per hour
      daily: 120, // Max 120 invites per day
    };
    this.cooldownUntil = 0;
    this.consecutiveErrors = 0;
    this.maxRetries = 3;
  }

  async checkLimits() {
    if (Date.now() < this.cooldownUntil) {
      const waitTime = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
      console.log(`[ANTIBAN] System is in cooldown. Wait ${waitTime}s.`);
      return { allowed: false, reason: 'cooldown', waitTime };
    }

    const hourlyCount = this.db.prepare("SELECT value FROM stats WHERE key = 'hourly_count'").get()?.value || 0;
    const dailyCount = this.db.prepare("SELECT value FROM stats WHERE key = 'daily_count'").get()?.value || 0;

    if (hourlyCount >= this.limits.hourly) {
      return { allowed: false, reason: 'hourly_limit', waitTime: 3600 };
    }
    if (dailyCount >= this.limits.daily) {
      return { allowed: false, reason: 'daily_limit', waitTime: 86400 };
    }

    return { allowed: true };
  }

  async handleFlood(error) {
    const errorMsg = error.message || '';
    let waitTime = 600; // Default 10 mins

    if (errorMsg.includes('FLOOD_WAIT_')) {
      const seconds = parseInt(errorMsg.split('FLOOD_WAIT_')[1]) || 300;
      waitTime = seconds + 60; // Add 1 min buffer
      console.log(`[ANTIBAN] FLOOD_WAIT detected. Pausing for ${waitTime}s.`);
    } else if (errorMsg.includes('PEER_FLOOD')) {
      waitTime = 3600; // 1 hour for peer flood
      console.log(`[ANTIBAN] PEER_FLOOD detected. Cooldown for 1 hour.`);
    } else if (errorMsg.includes('USER_PRIVACY_RESTRICTED') || errorMsg.includes('USER_NOT_MUTUAL_CONTACT')) {
      console.log(`[ANTIBAN] User privacy restriction. Skipping safely.`);
      return { action: 'skip' };
    }

    this.cooldownUntil = Date.now() + (waitTime * 1000);
    this.consecutiveErrors++;
    
    if (this.consecutiveErrors >= 3) {
      this.cooldownUntil = Date.now() + (4 * 3600 * 1000); // 4 hours if repeated errors
      console.log(`[ANTIBAN] Too many errors. Extended cooldown activated.`);
    }

    return { action: 'pause', waitTime };
  }

  async recordSuccess() {
    this.consecutiveErrors = 0;
    this.db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'success'").run();
    this.db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'hourly_count'").run();
    this.db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'daily_count'").run();
  }

  async recordFailure() {
    this.db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'failed'").run();
  }

  resetCounters(type = 'hourly') {
    if (type === 'hourly') {
      this.db.prepare("UPDATE stats SET value = 0 WHERE key = 'hourly_count'").run();
      console.log(`[ANTIBAN] Hourly counter reset.`);
    } else {
      this.db.prepare("UPDATE stats SET value = 0 WHERE key = 'daily_count'").run();
      this.db.prepare("UPDATE stats SET value = 0 WHERE key = 'hourly_count'").run();
      console.log(`[ANTIBAN] Daily counter reset.`);
    }
  }
}

module.exports = AntiBanSystem;
