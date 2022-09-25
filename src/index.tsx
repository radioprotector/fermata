import React from 'react';
import { createRoot } from 'react-dom/client';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faClockRotateLeft, faArrowRotateForward, faPause, faPlay, faForward, faVolumeUp, faVolumeMute } from '@fortawesome/free-solid-svg-icons';

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

library.add(faClockRotateLeft, faArrowRotateForward, faPause, faPlay, faForward, faVolumeUp, faVolumeMute);

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
