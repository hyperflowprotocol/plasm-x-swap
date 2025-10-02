import React from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

const PrivyWrapper = ({ children }) => {
  const appId = import.meta.env.VITE_PRIVY_APP_ID || 
                import.meta.env.PRIVY_APP_ID || 
                process.env.PRIVY_APP_ID

  console.log('🔐 Privy App ID configured:', appId ? 'Yes' : 'No')

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#E0004F'
        }
      }}
    >
      {children}
    </PrivyProvider>
  )
}

export default PrivyWrapper
