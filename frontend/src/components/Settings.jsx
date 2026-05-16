import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [platformFee, setPlatformFee] = useState(0.70);
  const [threshold, setThreshold] = useState(-2.0);
  const [costcoEmail, setCostcoEmail] = useState('');
  const [costcoPassword, setCostcoPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/settings`);
      const data = await res.json();
      setPlatformFee(data.platformFee || 0.70);
      setThreshold(data.notificationThreshold || -2.0);
      setCostcoEmail(data.costcoEmail || '');
      setCostcoPassword(data.costcoPassword || '');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const body = {
        platformFee: parseFloat(platformFee),
        notificationThreshold: parseFloat(threshold),
        costcoEmail: costcoEmail
      };
      // Only send password if user typed a new one (not the redacted placeholder)
      if (costcoPassword && !costcoPassword.includes('••')) {
        body.costcoPassword = costcoPassword;
      }

      const res = await fetch(`${apiUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage('Error: ' + err.message);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings">
      <div className="card">
        <h2>Settings</h2>

        <div className="form-group">
          <label htmlFor="platform-fee">
            CollectPure Platform Fee (%)
            <span className="help">Default: 0.70%</span>
          </label>
          <input
            id="platform-fee"
            type="number"
            value={platformFee}
            onChange={(e) => setPlatformFee(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="threshold">
            Notification Threshold (%)
            <span className="help">Alert if loss is less than this. -2.0 = alert if only 2% loss</span>
          </label>
          <input
            id="threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="costco-email">
            Costco Email
            <span className="help">Your Costco account email (stored locally on server only)</span>
          </label>
          <input
            id="costco-email"
            type="email"
            value={costcoEmail}
            onChange={(e) => setCostcoEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label htmlFor="costco-password">
            Costco Password
            <span className="help">Your Costco account password (stored locally on server only)</span>
          </label>
          <input
            id="costco-password"
            type="password"
            value={costcoPassword}
            onChange={(e) => setCostcoPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="off"
          />
        </div>

        {message && <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

        <button onClick={handleSave} disabled={loading} className="btn btn-primary">
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
