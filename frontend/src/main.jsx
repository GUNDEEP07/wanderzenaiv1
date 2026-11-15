import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { registerServiceWorker } from './utils/registerSw'
import { prepareRoot } from './seo/ready'

// A prerendered page stays on screen until the app has drawn the same page (seo/ready.js).
ReactDOM.createRoot(prepareRoot()).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

registerServiceWorker()
