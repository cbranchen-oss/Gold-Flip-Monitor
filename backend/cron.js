import cron from 'node-cron';
import { getCollectPureBid, getCostcoPrice } from './scraper.js';
import { sendNotification } from './notifier.js';
import { store } from './store.js';

export function startCronJob() {
  // Run every 15 minutes
  const job = cron.schedule('*/15 * * * *', async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running gold flip monitor check...`);

      const settings = store.getSettings();

      // Fetch latest Costco price via Puppeteer stealth
      let costcoPrice;
      let costcoPriceChanged = false;
      let oldCostcoPrice = store.getCostcoPrice();

      try {
        const costcoData = await getCostcoPrice();
        costcoPrice = costcoData.price;

        // Check if price changed
        if (oldCostcoPrice !== null && oldCostcoPrice !== costcoPrice) {
          costcoPriceChanged = true;
          console.log(`Costco price changed: $${oldCostcoPrice} → $${costcoPrice}`);
        }

        // Store the new price
        store.setCostcoPrice(costcoPrice);
      } catch (error) {
        console.error('Error fetching Costco price:', error.message);
        // Use cached price if available
        costcoPrice = oldCostcoPrice;
        if (!costcoPrice) {
          console.log('No Costco price available, skipping check');
          return;
        }
      }

      // Fetch latest bid
      const bidData = await getCollectPureBid();
      const bidPrice = bidData.bid;

      // Calculate profit/loss
      const platformFee = (bidPrice * settings.platformFee) / 100;
      const netPayout = bidPrice - platformFee;
      const effectiveCost = costcoPrice;
      const netProfit = netPayout - effectiveCost;
      const profitLossPercent = (netProfit / effectiveCost) * 100;

      console.log('Profit/Loss calculation:');
      console.log(`  Costco Price: $${costcoPrice}`);
      console.log(`  Bid Price: $${bidPrice}`);
      console.log(`  Platform Fee (${settings.platformFee}%): $${platformFee.toFixed(2)}`);
      console.log(`  Net Payout: $${netPayout.toFixed(2)}`);
      console.log(`  Effective Cost: $${effectiveCost.toFixed(2)}`);
      console.log(`  Net Profit/Loss: $${netProfit.toFixed(2)}`);
      console.log(`  Profit/Loss %: ${profitLossPercent.toFixed(2)}%`);
      console.log(`  Threshold: ${settings.notificationThreshold}%`);

      // Send notification if Costco price changed
      if (costcoPriceChanged) {
        console.log('Sending notification (Costco price changed)');
        await sendNotification(
          settings.nftTopic,
          { oldPrice: oldCostcoPrice, newPrice: costcoPrice, bidPrice, profitLossPercent },
          null,
          null,
          null,
          'price_change'
        );
      }

      // Check if we should send notification (loss is less than threshold)
      const state = store.getNotificationState();
      const shouldNotify = profitLossPercent > settings.notificationThreshold && !state.lastNotified;

      if (shouldNotify) {
        console.log('Sending notification (loss is better than threshold)');
        await sendNotification(
          settings.nftTopic,
          profitLossPercent,
          costcoPrice,
          bidPrice,
          netPayout,
          'profit'
        );
        store.setNotificationState({ lastNotified: true, timestamp: new Date().toISOString() });
      } else if (profitLossPercent <= settings.notificationThreshold && state.lastNotified) {
        console.log('Resetting notification state (loss exceeded threshold again)');
        store.setNotificationState({ lastNotified: false });
      } else {
        console.log('No notification needed at this time');
      }
    } catch (error) {
      console.error('Cron job error:', error.message);
    }
  });

  console.log('Cron job started (runs every 15 minutes)');
  return job;
}
