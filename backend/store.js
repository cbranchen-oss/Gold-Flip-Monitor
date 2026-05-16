import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const priceFile = path.join(dataDir, 'costco-price.json');
const settingsFile = path.join(dataDir, 'settings.json');
const notificationStateFile = path.join(dataDir, 'notification-state.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Default settings — env vars override file values on Railway where the
// filesystem is ephemeral and settings.json won't persist across deploys
const defaultSettings = {
  platformFee: parseFloat(process.env.PLATFORM_FEE) || 0.70,
  notificationThreshold: parseFloat(process.env.NOTIFICATION_THRESHOLD) || -2.0,
  costcoEmail: process.env.COSTCO_EMAIL || '',
  costcoPassword: process.env.COSTCO_PASSWORD || ''
};

// Initialize files if they don't exist
function initializeFiles() {
  if (!fs.existsSync(priceFile)) {
    fs.writeFileSync(priceFile, JSON.stringify({ price: null, timestamp: null }, null, 2));
  }
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2));
  }
  if (!fs.existsSync(notificationStateFile)) {
    fs.writeFileSync(notificationStateFile, JSON.stringify({ lastNotified: false }, null, 2));
  }
}

initializeFiles();

// Migrate old settings (remove costcoCookie if present)
function migrateSettings() {
  try {
    const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    if ('costcoCookie' in data) {
      delete data.costcoCookie;
      if (!data.costcoEmail) data.costcoEmail = '';
      if (!data.costcoPassword) data.costcoPassword = '';
      fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2));
      console.log('Migrated settings: removed costcoCookie, added costcoEmail/costcoPassword');
    }
  } catch (e) {
    // Ignore migration errors
  }
}

migrateSettings();

export const store = {
  getCostcoPrice() {
    try {
      const data = JSON.parse(fs.readFileSync(priceFile, 'utf-8'));
      return data.price;
    } catch (e) {
      return null;
    }
  },

  getCostcoPriceData() {
    try {
      return JSON.parse(fs.readFileSync(priceFile, 'utf-8'));
    } catch (e) {
      return null;
    }
  },

  setCostcoPrice(price) {
    const data = { price, timestamp: new Date().toISOString() };
    fs.writeFileSync(priceFile, JSON.stringify(data, null, 2));
    return data;
  },

  getSettings() {
    try {
      const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      return { ...defaultSettings, ...data };
    } catch (e) {
      return defaultSettings;
    }
  },

  // Returns settings with password redacted for API responses
  getSafeSettings() {
    const settings = this.getSettings();
    return {
      ...settings,
      costcoPassword: settings.costcoPassword ? '••••••••' : ''
    };
  },

  updateSettings(updates) {
    const current = this.getSettings();
    const updated = { ...current, ...updates };
    fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2));
    return this.getSafeSettings();
  },

  getNotificationState() {
    try {
      const data = JSON.parse(fs.readFileSync(notificationStateFile, 'utf-8'));
      return data;
    } catch (e) {
      return { lastNotified: false };
    }
  },

  setNotificationState(state) {
    fs.writeFileSync(notificationStateFile, JSON.stringify(state, null, 2));
    return state;
  }
};
