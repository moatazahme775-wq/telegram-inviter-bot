/**
 * Sequential Queue Service
 * Processes actions one by one with randomized delays.
 */

const { randomDelay } = require('../utils/delay');

class SequentialQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.status = 'idle';
  }

  async add(action) {
    this.queue.push(action);
    console.log(`[QUEUE] Action added. Total in queue: ${this.queue.length}`);
    if (!this.isProcessing) {
      this.process();
    }
  }

  async process() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.status = 'idle';
      console.log(`[QUEUE] All tasks completed. System idle.`);
      return;
    }

    this.isProcessing = true;
    this.status = 'processing';
    
    const currentAction = this.queue.shift();
    
    try {
      console.log(`[QUEUE] Processing action... Remaining: ${this.queue.length}`);
      await currentAction();
    } catch (error) {
      console.error(`[QUEUE] Error during action processing:`, error.message);
    } finally {
      // Always wait before next action to avoid burst behavior
      await randomDelay(5000, 15000); // 5s to 15s delay
      this.process();
    }
  }

  getQueueStatus() {
    return {
      status: this.status,
      count: this.queue.length,
    };
  }

  clear() {
    this.queue = [];
    console.log(`[QUEUE] Queue cleared.`);
  }
}

module.exports = new SequentialQueue();
