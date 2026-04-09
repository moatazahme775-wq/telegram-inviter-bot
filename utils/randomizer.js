/**
 * Smart Randomizer for Human-like behavior
 */

class Randomizer {
  static getDelay(base, riskScore = 0) {
    // Increase delay based on risk score: delay = base * (1 + risk/50)
    const riskMultiplier = 1 + (riskScore / 50);
    const adjustedBase = base * riskMultiplier;
    
    // Add jitter ±20%
    const jitterPercent = (Math.random() * 0.4) - 0.2; // -0.2 to +0.2
    const totalDelay = adjustedBase * (1 + jitterPercent);
    
    return Math.floor(totalDelay);
  }

  static getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  static shouldTakeBreak() {
    // 10% chance to take a random break after an action
    return Math.random() < 0.10;
  }
}

module.exports = Randomizer;
