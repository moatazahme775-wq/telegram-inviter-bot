/**
 * AI Risk Engine for Telegram Accounts
 * Predicts ban risk and assigns safety levels (0-100).
 */

class RiskEngine {
  constructor(db) {
    this.db = db;
    this.riskScores = new Map(); // accountId -> score
  }

  async calculateRisk(accountId) {
    let score = 0;

    // 1. Hourly/Daily Activity (Weight: 40%)
    const stats = this.db.prepare("SELECT value FROM stats WHERE key = 'hourly_count'").get()?.value || 0;
    const daily = this.db.prepare("SELECT value FROM stats WHERE key = 'daily_count'").get()?.value || 0;
    
    score += (stats / 30) * 20; // Max 20 points if near hourly limit
    score += (daily / 120) * 20; // Max 20 points if near daily limit

    // 2. Error Rate (Weight: 40%)
    const errors = this.db.prepare("SELECT value FROM stats WHERE key = 'failed'").get()?.value || 0;
    const total = this.db.prepare("SELECT value FROM stats WHERE key = 'success'").get()?.value || 0 + errors;
    
    if (total > 0) {
      const errorRate = errors / total;
      score += (errorRate * 40); // High error rate = high risk
    }

    // 3. Consecutive Actions (Weight: 20%)
    // Simulated: if we detect rapid actions, add risk
    const lastActionTime = this.riskScores.get(`${accountId}_last_time`) || 0;
    const timeSinceLast = Date.now() - lastActionTime;
    if (timeSinceLast < 5000) { // Action within 5 seconds
      score += 20;
    }

    // Cap at 100
    score = Math.min(100, Math.max(0, Math.round(score)));
    this.riskScores.set(accountId, score);
    this.riskScores.set(`${accountId}_last_time`, Date.now());

    return {
      score,
      level: this.getRiskLevel(score)
    };
  }

  getRiskLevel(score) {
    if (score < 30) return 'SAFE';
    if (score < 60) return 'WARNING';
    if (score < 80) return 'DANGER';
    return 'CRITICAL';
  }

  async recordEvent(accountId, eventType, data = {}) {
    if (eventType === 'FLOOD_WAIT') {
      const current = this.riskScores.get(accountId) || 0;
      this.riskScores.set(accountId, Math.min(100, current + 25)); // Instant risk jump
    } else if (eventType === 'PEER_FLOOD') {
      this.riskScores.set(accountId, 90); // Near critical
    }
  }

  getRiskStatus(accountId) {
    const score = this.riskScores.get(accountId) || 0;
    return { score, level: this.getRiskLevel(score) };
  }
}

module.exports = RiskEngine;
