import { spawn } from 'child_process';

const NOTIFY_SCRIPT = '/Users/chris/telegram-bot/notify.py';

function formatPrice(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function sendNotification(data, costcoPrice, bidPrice, netPayout, type = 'profit') {
  try {
    let message;

    if (type === 'profit') {
      const lossPercent = data.toFixed(2);
      message = `🪙 Gold Flip Alert!\nLoss is only ${lossPercent}%!\nCostco: $${formatPrice(costcoPrice)}\nCollectPure Bid: $${formatPrice(bidPrice)}\nNet Payout: $${formatPrice(netPayout)}`;
    } else if (type === 'price_change') {
      const { oldPrice, newPrice, bidPrice: bid, profitLossPercent } = data;
      message = `🪙 Costco Price Changed\nOld: $${formatPrice(oldPrice)} → New: $${formatPrice(newPrice)}\nCollectPure Bid: $${formatPrice(bid)}\nFlip Loss: ${profitLossPercent.toFixed(2)}%`;
    } else if (type === 'warning') {
      message = `⚠️ ${data}\n${costcoPrice}`;
    } else {
      throw new Error(`Unknown notification type: ${type}`);
    }

    console.log('Sending Telegram notification...');

    await new Promise((resolve, reject) => {
      const child = spawn('python3', [NOTIFY_SCRIPT, message]);
      let stderr = '';
      child.stdout.on('data', (data) => console.log('notify.py:', data.toString().trim()));
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`notify.py exited with code ${code}: ${stderr}`));
        } else {
          if (stderr) console.warn('notify.py stderr:', stderr);
          resolve();
        }
      });
      child.on('error', reject);
    });

    console.log('Notification sent successfully');
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Error sending notification:', error.message);
    throw error;
  }
}
