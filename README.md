# Gold Flip Monitor 🪙

A full-stack PWA (Progressive Web App) that monitors the profitability of buying 1 oz PAMP Lady Fortuna VERISCAN Gold Bars from Costco and reselling them on CollectPure.com.

## Architecture

```
Frontend (PWA)          Backend                 Notifications
React + Vite            Node.js + Express       ntfy.sh
Vercel                  Railway/Render          (Free, no auth)
     ↓                       ↓                        ↓
  [App] ←────API────→ [Scraper + Cron] ←────POST─→ [ntfy.sh]
                       (every 5 min)
```

## Features

### Frontend
- ✅ Mobile-first PWA (installable on home screen)
- ✅ Automatic Costco price monitoring (requires session cookie)
- ✅ Real-time CollectPure highest bid fetching
- ✅ Profit/loss breakdown with detailed calculations
- ✅ Configurable notification thresholds
- ✅ Dark/light mode support
- ✅ Offline capable with service worker
- ✅ Push notifications via ntfy.sh

### Backend
- ✅ Scrapes CollectPure for highest bid (with caching)
- ✅ Scrapes Costco API for current price (with session cookies)
- ✅ Cron job runs every 5 minutes
- ✅ Smart notification logic (no spam)
- ✅ Price change notifications
- ✅ Cookie expiration alerts
- ✅ JSON-based data storage (no DB setup needed)
- ✅ REST API for all operations
- ✅ Graceful error handling

## Stack

**Frontend:**
- React 18
- Vite (blazing fast dev server)
- Service Worker for offline support
- No heavy frameworks - clean CSS

**Backend:**
- Node.js + Express
- cheerio (HTML parsing)
- node-cron (scheduled tasks)
- Built-in JSON file storage

**Deployment:**
- Frontend: Vercel (free tier)
- Backend: Railway or Render (free tier)
- Notifications: ntfy.sh (free, no signup)

## Quick Start (Local Development)

### Prerequisites
- Node.js 16+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

Server runs on `http://localhost:3000`

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/collectpure-bid` - Get highest bid
- `GET /api/costco-price` - Get saved price
- `POST /api/costco-price` - Save Costco price
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings
- `POST /api/refresh` - Force refresh bid
- `GET /api/calculate` - Calculate profit/loss

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`

Visit `http://localhost:5173` in your browser. Open DevTools → Network → right-click → Save all as HAR, then check that API calls are reaching `http://localhost:3000`.

## Testing the Scraper

```bash
cd backend
npm test
```

This will fetch the real CollectPure bid and verify parsing works.

## Configuration

### Frontend Environment Variables
Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:3000  # For dev
```

For production, update to your deployed backend URL.

### Backend Data Storage
All data is stored in `backend/data/`:
- `costco-price.json` - Current Costco price
- `settings.json` - User settings and notification thresholds
- `notification-state.json` - Last notification state (to avoid spam)

## How It Works

### Profit Calculation
```
Net Payout = Bid Price - (Bid Price × Platform Fee %)
Effective Cost = Costco Price
Net Profit = Net Payout - Effective Cost
Profit % = (Net Profit / Effective Cost) × 100
```

### Notification Logic
1. Cron runs every 5 minutes
2. Fetches latest Costco price using session cookie
3. Fetches latest CollectPure bid (cached for 2 min)
4. **Notifies on price changes:** When Costco price changes, sends notification with old/new prices and updated profit/loss
5. **Notifies on cookie expiration:** If Costco cookie expires (403 response), sends warning notification
6. **Notifies on profit opportunities:** Only if loss % is BETTER than threshold (e.g., -2% threshold = only 1% loss) AND this is the first time crossing that threshold (no spam)
7. Sends push via `POST https://ntfy.sh/{topic_name}`

### Mobile Push Notifications
Powered by **ntfy.sh** - completely free, no signup required, works on iOS + Android:
1. Creates a private topic on ntfy.sh (e.g., `https://ntfy.sh/my-private-gold-topic`)
2. Sends JSON payload with title and message
3. You subscribe to the topic in ntfy.sh app
4. Receive notifications on your phone in real-time

No Firebase, no AWS, no third-party account needed.

## Deployment

### Deploy Backend (Railway)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub"
4. Select your repo
5. Set `NODE_ENV=production`
6. Railway auto-detects Node.js and runs `npm start`
7. Copy the deployment URL (e.g., `https://gold-monitor-api.railway.app`)

### Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variable: `VITE_API_URL=https://gold-monitor-api.railway.app`
6. Deploy!

### Configure Production URLs
After deployment, update:
- **Frontend** → Add backend URL to env vars
- **Backend** → CORS is already configured for any origin (safe for production)

## Troubleshooting

### Scraper Returns Empty Bid
- CollectPure might have changed their HTML structure
- Check if page still has "Highest Bid" text
- Try fallback parsing from script tags
- Manual update in `backend/scraper.js` if needed

### Notifications Not Arriving
1. Ensure `VITE_API_URL` in frontend env points to correct backend
2. Check ntfy topic name in settings (default: `gold-flip-monitor`)
3. Test manually: `curl -X POST https://ntfy.sh/your-topic -H "Content-Type: application/json" -d '{"title":"Test","message":"Hello"}'`
4. Subscribe to the topic in ntfy.sh app

### Frontend Can't Connect to Backend
- Check `VITE_API_URL` env variable
- Ensure backend is running
- Check CORS headers (should be `*`)
- Browser console for fetch errors

### Offline Mode Not Working
- Service Worker requires HTTPS (or localhost)
- Check browser DevTools → Application → Service Workers
- Clear site data if service worker isn't updating

## API Response Examples

### GET /api/collectpure-bid
```json
{
  "bid": 4678.50,
  "timestamp": "2026-05-06T14:30:00Z",
  "cached": false
}
```

### GET /api/costco-price
```json
{
  "price": 4799.99,
  "timestamp": "2026-05-06T14:30:00Z"
}
```

### GET /api/calculate
```json
{
  "costcoPrice": 4799.99,
  "bidPrice": 4678.50,
  "platformFee": 32.75,
  "netPayout": 4645.75,
  "effectiveCost": 4799.99,
  "netProfit": -154.24,
  "profitLossPercent": -3.21,
  "timestamp": "2026-05-06T14:30:00Z"
}
```

## File Structure

```
gold-monitor/
├── backend/
│   ├── server.js          # Express server & routes
│   ├── scraper.js         # CollectPure scraping logic
│   ├── notifier.js        # ntfy.sh push notifications
│   ├── cron.js            # 5-min check scheduler
│   ├── store.js           # JSON file storage
│   ├── test-scraper.js    # Scraper tests
│   ├── data/              # Auto-created (price, settings, state)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main app component
│   │   ├── App.css        # Styles (mobile-first)
│   │   ├── main.jsx       # React entry
│   │   └── components/
│   │       ├── Calculator.jsx
│   │       └── Settings.jsx
│   ├── public/
│   │   ├── sw.js          # Service worker
│   │   └── manifest.json  # PWA manifest
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.local
│   └── package.json
└── README.md
```

## Environment Variables

### Frontend
- `VITE_API_URL` - Backend API URL (default: `http://localhost:3000`)

### Backend
- `PORT` - Server port (default: `3000`)
- `NODE_ENV` - `production` or `development`

## Development Tips

### Debug Cron Job
Logs print to console every 5 minutes. For instant testing:
```bash
# In backend/cron.js, change schedule to:
cron.schedule('*/1 * * * *', async () => { // Runs every minute
```

### Test API Directly
```bash
# Get current settings
curl http://localhost:3000/api/settings

# Save a Costco price
curl -X POST http://localhost:3000/api/costco-price \
  -H "Content-Type: application/json" \
  -d '{"price": 4799.99}'

# Force bid refresh
curl -X POST http://localhost:3000/api/refresh

# Calculate profit
curl http://localhost:3000/api/calculate
```

### Edit HTML/CSS on Fly
Vite dev server has hot reload. Just save and browser refreshes automatically.

## Performance

- **Frontend:** ~45 KB gzipped (Vite optimized)
- **Backend:** Lightweight Node.js, ~12 MB total with node_modules
- **API Response:** <500ms (CollectPure scrape cached for 2 min)
- **Cron Interval:** 5 minutes (configurable)

## Security

- ✅ No sensitive data stored in frontend
- ✅ CORS allows any origin (safe for public API)
- ✅ ntfy.sh topics are private (long UUID format recommended)
- ✅ No auth required (your backend is personal use)
- ✅ Costco/CollectPure data never stored, only prices

## License

MIT - Use freely for personal use.

## Support

For issues:
1. Check backend logs: `npm run dev`
2. Check browser console (F12)
3. Test scraper: `npm test` in backend
4. Verify CORS: API should return `Access-Control-Allow-Origin: *`

---

**Built with ❤️ for gold flippers everywhere 🪙**
