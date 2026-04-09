/**
 * AI Behavior Controller
 * Adjusts bot behavior based on risk score.
 */

const Randomizer = require('../utils/randomizer');

class BehaviorController {
  constructor(riskEngine) {
    this.riskEngine = riskEngine;
    this.baseDelay = 10000; // Base delay: 10s
    this.isSleeping = false;
  }

  async getNextActionDelay(accountId) {
    const { score, level } = await this.riskEngine.getRiskStatus(accountId);
    
    // Dynamic delay calculation: delay = base * (1 + risk/50)
    let delay = Randomizer.getDelay(this.baseDelay, score);
    
    // Additional behavior based on risk levels
    switch (level) {
      case 'SAFE':
        // Normal speed (no extra delay)
        break;
      case 'WARNING':
        delay *= 1.5; // Increase delays (+50%)
        break;
      case 'DANGER':
        delay *= 3.0; // Heavy delays (30s - 60s)
        break;
      case 'CRITICAL':
        delay = 3600000; // STOP account immediately (1 hour cooldown)
        console.log(`[BEHAVIOR] Account ${accountId} is CRITICAL. Enforcing 1-hour stop.`);
        break;
    }

    return delay;
  }

  async shouldTakeBreak() {
    // 10% chance to take a random break (human-like)
    if (Randomizer.shouldTakeBreak()) {
      const breakDuration = Randomizer.getRandomInt(600000, 3600000); // 10-60 mins
      console.log(`[BEHAVIOR] Taking a human-like break for ${Math.round(breakDuration / 60000)} mins.`);
      return { takeBreak: true, duration: breakDuration };
    }
    return { takeBreak: false };
  }

  async simulateHumanSchedule() {
    const now = new Date();
    const hour = now.getHours();
    
    // Simulate night time (00:00 - 06:00)
    if (hour >= 0 && hour <= 6) {
      console.log(`[BEHAVIOR] Night time detected. Entering sleep mode.`);
      return { sleep: true, duration: 3600000 }; // 1 hour sleep check
    }
    return { sleep: false };
  }
}

module.exports = BehaviorController;
