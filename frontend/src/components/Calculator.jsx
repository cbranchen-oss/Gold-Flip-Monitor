import React, { useState, useEffect } from 'react';

export default function Calculator() {
  const [costcoPrice, setCostcoPrice] = useState('');
  const [bidData, setBidData] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastBidTime, setLastBidTime] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    loadCostcoPrice();
    loadSettings();
    fetchBid();
    const interval = setInterval(fetchBid, 60000); // Auto-refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (costcoPrice && bidData) {
      calculateProfitLoss();
    }
  }, [costcoPrice, bidData]);

  const loadCostcoPrice = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/costco-price`);
      const data = await res.json();
      if (data.price) {
        setCostcoPrice(data.price.toString());
      }
    } catch (err) {
      console.error('Failed to load Costco price:', err);
      setError('Failed to load Costco price');
      setTimeout(() => setError(null), 5000);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/settings`);
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchBid = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/collectpure-bid`);
      if (!res.ok) throw new Error('Failed to fetch bid');
      const data = await res.json();
      setBidData(data);
      setLastBidTime(new Date(data.timestamp));
    } catch (err) {
      setError('Failed to fetch CollectPure bid: ' + err.message);
      console.error('Fetch bid error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateProfitLoss = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/calculate`);
      if (!res.ok) throw new Error('Failed to calculate');
      const data = await res.json();
      setCalculation(data);
    } catch (err) {
      console.error('Calculation error:', err);
    }
  };

  const handleRefresh = () => {
    fetchBid();
  };

  const getTimeAgo = (date) => {
    if (!date) return 'Unknown';
    const minutes = Math.floor((Date.now() - new Date(date)) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  const isStale = lastBidTime && Date.now() - new Date(lastBidTime) > 15 * 60 * 1000;

  return (
    <div className="calculator">
      <div className="card">
        <h2>Price Tracker</h2>

        <div className="form-group">
          <label htmlFor="costco-price">Costco Price ($)</label>
          <div className="input-group">
            <input
              id="costco-price"
              type="text"
              value={costcoPrice ? `$${parseFloat(costcoPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Loading...'}
              readOnly
              className="readonly"
            />
            <button onClick={() => { loadCostcoPrice(); fetchBid(); }} className="btn btn-secondary">
              Refresh
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="bid-price">CollectPure Highest Bid ($)</label>
          <div className="input-group">
            <input
              id="bid-price"
              type="text"
              value={bidData ? `$${bidData.bid.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Loading...'}
              readOnly
              className="readonly"
            />
            <button onClick={handleRefresh} disabled={loading} className="btn btn-secondary">
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {lastBidTime && (
            <div className={`time-info ${isStale ? 'stale' : ''}`}>
              Last updated: {getTimeAgo(lastBidTime)}
              {isStale && ' ⚠️ (data is 15+ minutes old)'}
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      {calculation && (
        <div className="card">
          <h2>Profit/Loss Analysis</h2>

          <div className="breakdown">
            <div className="row">
              <span>Amount Paid:</span>
              <span>${calculation.costcoPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="row">
              <span>Effective Cost:</span>
              <span>${calculation.effectiveCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="divider"></div>

            <div className="row">
              <span>Bid Price:</span>
              <span>${calculation.bidPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="row">
              <span>Platform Fee ({calculation.platformFee || 0.70}%):</span>
              <span className="negative">-${calculation.platformFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="row">
              <span>Net Payout:</span>
              <span>${calculation.netPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="divider"></div>

            <div className="profit-loss">
              <div className={`amount ${calculation.netProfit >= 0 ? 'profit' : 'loss'}`}>
                {calculation.netProfit >= 0 ? '+' : ''} ${calculation.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className={`percent ${calculation.profitLossPercent >= 0 ? 'profit' : 'loss'}`}>
                {calculation.profitLossPercent >= 0 ? '+' : ''}{calculation.profitLossPercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
