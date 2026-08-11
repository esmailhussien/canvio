import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/material-symbols-outlined';
import { App } from './App';
import '@canvio/ui/src/theme/tokens.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
