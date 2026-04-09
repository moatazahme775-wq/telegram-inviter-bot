/**
 * Human-like Delay Utility
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = async (min = 3000, max = 15000) => {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  const jitter = Math.floor(Math.random() * 2000); // Add up to 2s extra jitter
  const total = delay + jitter;
  console.log(`[ANTIBAN] Waiting ${Math.round(total / 1000)}s before next action...`);
  return sleep(total);
};

module.exports = { sleep, randomDelay };
