/**
 * Account Rotation & Management Service
 * Rotates between accounts and selects the safest one.
 */

class AccountManager {
  constructor(riskEngine) {
    this.riskEngine = riskEngine;
    this.accounts = [
      { id: 'primary', name: 'Main Account', status: 'active' },
      // Support for future multiple accounts
    ];
    this.currentIndex = 0;
  }

  async getBestAccount() {
    // Sort accounts by lowest risk score
    const scoredAccounts = await Promise.all(this.accounts.map(async (acc) => {
      const { score, level } = await this.riskEngine.getRiskStatus(acc.id);
      return { ...acc, score, level };
    }));

    // Filter out CRITICAL accounts
    const safeAccounts = scoredAccounts.filter(acc => acc.level !== 'CRITICAL');
    
    if (safeAccounts.length === 0) {
      console.log('[ACCOUNT] All accounts are in CRITICAL risk state. Pausing all activity.');
      return null;
    }

    // Sort by score ascending (lowest risk first)
    safeAccounts.sort((a, b) => a.score - b.score);
    
    return safeAccounts[0];
  }

  async updateAccountStatus(accountId, status) {
    const acc = this.accounts.find(a => a.id === accountId);
    if (acc) acc.status = status;
  }

  getAllStatus() {
    return this.accounts.map(acc => {
      const { score, level } = this.riskEngine.getRiskStatus(acc.id);
      return { ...acc, score, level };
    });
  }
}

module.exports = AccountManager;
