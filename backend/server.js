import express from 'express';
import cors from 'cors';
import { getCollectPureBid, clearCache, getCostcoPrice } from './scraper.js';
import { store } from './store.js';
import { startCronJob } from './cron.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://gold-flip-monitor.vercel.app',
];
// Also allow any *.vercel.app preview deployments
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get CollectPure highest bid
app.get('/api/collectpure-bid', async (req, res) => {
  try {
    const bidData = await getCollectPureBid();
    res.json(bidData);
  } catch (error) {
    console.error('Error in /api/collectpure-bid:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get current Costco price (fetches via Puppeteer stealth)
app.get('/api/costco-price', async (req, res) => {
  try {
    // Return stored price if fresh (< 15 min old)
    const stored = store.getCostcoPriceData();
    if (stored && stored.price && stored.timestamp) {
      const age = Date.now() - new Date(stored.timestamp).getTime();
      if (age < 15 * 60 * 1000) {
        return res.json(stored);
      }
    }

    const priceData = await getCostcoPrice();
    store.setCostcoPrice(priceData.price);
    res.json(priceData);
  } catch (error) {
    console.error('Error in /api/costco-price:', error.message);
    // Fall back to stored price if scrape fails
    const stored = store.getCostcoPriceData();
    if (stored && stored.price) {
      return res.json({ ...stored, stale: true });
    }
    res.status(500).json({ error: error.message });
  }
});

// Set Costco price (for manual override if needed)
app.post('/api/costco-price', (req, res) => {
  const { price } = req.body;

  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number' });
  }

  const result = store.setCostcoPrice(price);
  res.json(result);
});

// Get settings (password redacted)
app.get('/api/settings', (req, res) => {
  const settings = store.getSafeSettings();
  res.json(settings);
});

// Update settings
app.post('/api/settings', (req, res) => {
  const { platformFee, notificationThreshold, nftTopic, costcoEmail, costcoPassword } = req.body;
  const updates = {};

  if (typeof platformFee === 'number') updates.platformFee = platformFee;
  if (typeof notificationThreshold === 'number') updates.notificationThreshold = notificationThreshold;
  if (typeof nftTopic === 'string') updates.nftTopic = nftTopic;
  if (typeof costcoEmail === 'string') updates.costcoEmail = costcoEmail;
  if (typeof costcoPassword === 'string') updates.costcoPassword = costcoPassword;

  const result = store.updateSettings(updates);
  res.json(result);
});

// Manual refresh endpoint
app.post('/api/refresh', async (req, res) => {
  try {
    clearCache();
    const bidData = await getCollectPureBid();
    res.json(bidData);
  } catch (error) {
    console.error('Error in /api/refresh:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Calculate profit/loss
app.get('/api/calculate', async (req, res) => {
  try {
    const costcoPrice = store.getCostcoPrice();
    const settings = store.getSettings();

    if (!costcoPrice) {
      return res.status(400).json({ error: 'Costco price not set' });
    }

    const bidData = await getCollectPureBid();
    const bidPrice = bidData.bid;

    const platformFee = (bidPrice * settings.platformFee) / 100;
    const netPayout = bidPrice - platformFee;
    const effectiveCost = costcoPrice;
    const netProfit = netPayout - effectiveCost;
    const profitLossPercent = (netProfit / effectiveCost) * 100;

    res.json({
      costcoPrice,
      bidPrice,
      platformFee: parseFloat(platformFee.toFixed(2)),
      netPayout: parseFloat(netPayout.toFixed(2)),
      effectiveCost: parseFloat(effectiveCost.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      profitLossPercent: parseFloat(profitLossPercent.toFixed(2)),
      timestamp: bidData.timestamp
    });
  } catch (error) {
    console.error('Error in /api/calculate:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start cron job
startCronJob();

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gold Flip Monitor backend running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET /health');
  console.log('  GET /api/collectpure-bid');
  console.log('  GET /api/costco-price');
  console.log('  POST /api/costco-price');
  console.log('  GET /api/settings');
  console.log('  POST /api/settings');
  console.log('  POST /api/refresh');
  console.log('  GET /api/calculate');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});
