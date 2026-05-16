import React, { useState } from 'react';
import Calculator from './components/Calculator';
import Settings from './components/Settings';
import './App.css';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🪙 Gold Flip Monitor</h1>
        <p>Costco → CollectPure Profit Calculator</p>
      </header>

      <main className="app-main">
        {!showSettings ? (
          <>
            <Calculator />
            <button onClick={() => setShowSettings(true)} className="btn btn-link">
              ⚙️ Settings
            </button>
          </>
        ) : (
          <>
            <Settings />
            <button onClick={() => setShowSettings(false)} className="btn btn-link">
              ← Back to Calculator
            </button>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Powered by <strong>Telegram</strong> for notifications
        </p>
        <p className="version">v1.0.0</p>
      </footer>
    </div>
  );
}

export default App;
