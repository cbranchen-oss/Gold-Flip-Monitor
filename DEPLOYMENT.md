# Gold Flip Monitor - Deployment Guide

This guide covers deploying the Gold Flip Monitor PWA to production.

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (PWA)                         │
│  React + Vite                           │
│  Deployed on: Vercel                    │
│  URL: https://gold-flip-monitor.vercel.app │
└──────────────┬──────────────────────────┘
               │ API calls (CORS enabled)
               ▼
┌──────────────────────────────────────────────┐
│  Backend (Node.js + Express)                 │
│  Scraper + Cron + Storage                    │
│  Deployed on: Railway / Render               │
│  URL: https://gold-monitor-api.railway.app  │
└──────────────┬───────────────────────────────┘
               │ POST notifications
               ▼
         ┌─────────────────┐
         │  ntfy.sh        │
         │  (Free service) │
         └─────────────────┘
```

## Option 1: Deploy to Railway (Recommended - Simple)

### Backend Deployment

1. **Create a Railway account** at https://railway.app

2. **Connect your GitHub repo**:
   - Click "New Project" → "Deploy from GitHub"
   - Select your Gold-Flip-Monitor repo
   - Railway auto-detects it's a Node.js project

3. **Set environment variables**:
   - Go to Variables
   - Add: `PORT=3000`
   - Add: `NODE_ENV=production`

4. **Deploy**:
   - Railway auto-deploys on push to main
   - Copy the deployed URL (e.g., `https://gold-monitor-api-prod.railway.app`)

### Frontend Deployment

1. **Go to Vercel** at https://vercel.com

2. **Import project**:
   - New Project → Import Git Repository
   - Select your repo

3. **Configure**:
   - Root Directory: `./frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Add environment variable**:
   - Name: `VITE_API_URL`
   - Value: `https://gold-monitor-api-prod.railway.app` (your Railway URL)

5. **Deploy** - Vercel deploys automatically on push

---

## Option 2: Deploy to Render (Alternative)

### Backend on Render

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables (see Railway section)

---

## Monitoring the Cron Job

The backend cron runs every 5 minutes:

1. **View logs**:
   - Railway: Project → Logs
   - Render: Dashboard → Logs

2. **Expected log output**:
   ```
   [2026-05-06T19:00:00.000Z] Running gold flip monitor check...
   Profit/Loss calculation:
     Costco Price: $4,799.99
     Bid Price: $4,679.00
     ...
   ```

3. **Configure Costco cookie** (Required for automatic price monitoring):
   - In the app, go to Settings
   - Get your Costco session cookie:
     - Open Chrome DevTools (F12)
     - Go to Costco.com and log in
     - Go to Application → Cookies → costco.com
     - Copy the entire cookie string (usually starts with "cookie:")
     - Paste it into the "Costco Session Cookie" field
   - Save settings

4. **Test the setup**:
   - Check Costco price: `curl https://your-api.railway.app/api/costco-price`
   - Check CollectPure bid: `curl https://your-api.railway.app/api/collectpure-bid`
   - Test calculation: `curl https://your-api.railway.app/api/calculate`
   - Expected output:
     ```
     {
       "costcoPrice": 4799.99,
       "bidPrice": 4679.00,
       "platformFee": 32.75,
       "netPayout": 4646.25,
       "effectiveCost": 4799.99,
       "netProfit": -153.74,
       "profitLossPercent": -3.20,
       "timestamp": "2026-05-07T00:51:40.000Z"
     }
     ```

3. **Troubleshoot missing calculations**:
   - Check if Costco price is set: `curl https://your-api.railway.app/api/costco-price`
   - Test scraper: Check logs for "Found bid from text" or errors

---

## Setting Up Push Notifications

1. **No signup needed** - ntfy.sh is completely free and open source

2. **In the Gold Flip Monitor app**:
   - Go to Settings
   - Enter a topic name (e.g., `my-gold-monitor-secret-123`)
   - Save settings

3. **On your phone**:
   - Download the ntfy.sh app (iOS: App Store, Android: Google Play)
   - Open app
   - Add subscription: `https://ntfy.sh/my-gold-monitor-secret-123`
   - You'll receive notifications when threshold is crossed

4. **Testing notifications**:
   ```bash
   curl -X POST https://ntfy.sh/my-gold-monitor-secret-123 \
     -H "Content-Type: application/json" \
     -d '{"title":"Test","message":"Hello!"}'
   ```

---

## Custom Domain (Optional)

### Frontend on Vercel
1. Go to Vercel → Project → Domains
2. Add your domain (e.g., gold-monitor.example.com)
3. Point DNS to Vercel nameservers

### Backend on Railway
1. Go to Railway → Project → Domain
2. Add custom domain
3. Update frontend `VITE_API_URL` environment variable

---

## Troubleshooting

### Frontend can't connect to backend
- Check `VITE_API_URL` env variable is correct
- Ensure backend is running: `curl https://your-api-url/health`
- Check browser console (F12) for CORS errors

### Scraper failing to get CollectPure bid
- CollectPure might have changed their HTML structure
- Update the regex in `backend/scraper.js`
- Test locally: `cd backend && npm test`

### Notifications not arriving
- Verify topic name in app settings
- Test manually with curl (command above)
- Check ntfy.sh is accessible from your backend

### Prices not saving
- Check backend logs for database errors
- Verify `data/` directory exists and is writable
- Check `/api/costco-price` returns saved value

---

## Environment Variables Reference

### Backend (.env or Railway Variables)
```
PORT=3000                    # Server port
NODE_ENV=production          # Environment
```

### Frontend (.env.local or Vercel Variables)
```
VITE_API_URL=https://your-backend-url.railway.app
```

---

## Scaling & Performance

- **Cron frequency**: Edit `backend/cron.js` line with `*/5 * * * *` (currently 5 minutes)
- **Cache duration**: Edit `backend/scraper.js` `CACHE_DURATION` (currently 2 minutes)
- **Database**: Replace JSON storage with SQLite if needed (see backend/store.js)

---

## Cost Breakdown

- **Vercel** (Frontend): Free tier supports high traffic
- **Railway** (Backend): $5/month free tier, pay-as-you-go after
- **ntfy.sh** (Notifications): Completely free, open source
- **CollectPure Scraping**: Free, no API key needed
- **Total**: ~$0-5/month

---

## SSL/HTTPS

Both Vercel and Railway automatically provide SSL certificates. No additional setup needed.

---

## Backup & Data

Your Costco prices and settings are stored in:
- `backend/data/costco-price.json`
- `backend/data/settings.json`
- `backend/data/notification-state.json`

To back up:
1. Download from your server
2. Or connect to Railway disk via SSH
3. Or set up automatic backups with GitHub

---

## Updates & Maintenance

1. **Push updates to GitHub** - Vercel and Railway auto-deploy
2. **Monitor logs weekly** - Check for errors
3. **Update dependencies** - `npm update` then test locally
4. **CollectPure changes** - May need to update scraper regex

---

## Support

- Railway Support: https://railway.app/support
- Vercel Support: https://vercel.com/support
- ntfy.sh: https://ntfy.sh
- GitHub Issues: Add to your repo

---

## Production Checklist

- [ ] Backend deployed and running
- [ ] Frontend deployed and points to correct API URL
- [ ] Costco session cookie configured in settings
- [ ] Costco price monitoring works (check logs)
- [ ] CollectPure bid scraping works (check logs)
- [ ] ntfy.sh topic configured in app
- [ ] Phone has ntfy app installed and subscribed
- [ ] Cron job runs every 5 minutes (check logs)
- [ ] Test notification received when threshold crossed
- [ ] Test notification received when Costco price changes
- [ ] SSL certificates valid (check browser)
- [ ] Domains configured correctly

**You're ready to flip gold! 🪙**
