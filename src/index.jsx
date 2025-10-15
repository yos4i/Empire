import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Load debug utilities in development
if (process.env.NODE_ENV === 'development') {
  import('./tests/shift-system.test').then(module => {
    window.shiftTests = module.manualTests;
  });
}

const rootEl = document.getElementById('root');
const root = ReactDOM.createRoot(rootEl);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


