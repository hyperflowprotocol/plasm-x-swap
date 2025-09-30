import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PrivyWrapper from './PrivyWrapper.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrivyWrapper>
      <App />
    </PrivyWrapper>
  </StrictMode>,
)
