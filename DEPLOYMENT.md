# Plasm X Swap - Deployment Guide

Complete guide to deploy Plasm X Swap DEX aggregator to Vercel.

**GitHub Repository**: https://github.com/hyperflowprotocol/plasm-x-swap

## Overview

**Plasm X Swap** is a third-party DEX aggregator on Plasma Network (chain 9745) with:
- 2% platform fee on all swaps
- 100% fees go to platform wallet: `0x022ac0f0505be925e3863bb3af5f4c3aaacff1b0`
- Platform manually sends 30% to ReferrerVault: `0xB21486D9499a2cD8CE3e638E4077327affd8F24f`
- Automated referrer distribution via EIP-712 voucher-based claims
- Memorable referral codes (e.g., "catdog", "moonstar")

## Architecture

### Frontend
- **Path**: `plasm-x-swap/`
- **Framework**: React + Vite
- **Wallet**: Privy.io (embedded wallets)
- **Deploy to**: Vercel (Static)

### Backend API
- **Path**: `server/`
- **Framework**: Express.js (serverless-ready)
- **Database**: PostgreSQL (Neon/Vercel Postgres)
- **Deploy to**: Vercel (Serverless Functions)

## Prerequisites

1. **Vercel Account** - For deployment (free tier works)
2. **Neon/Vercel Postgres** - For database (free tier works)
3. **Privy.io Account** - For wallet authentication
4. **Deployer Private Key** - For signing EIP-712 vouchers (should already have this)

## Step 1: Set Up Database (Neon or Vercel Postgres)

### Option A: Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Create new project: "plasm-x-swap"
3. Copy the **Pooled Connection String** (important for serverless!)
4. Format: `postgresql://user:password@host/database?sslmode=require`

### Option B: Vercel Postgres
1. In Vercel dashboard, go to Storage → Create Database → Postgres
2. Select your project
3. Copy the **Pooled Connection String**

### 2.1 Create Database Schema
Run these SQL commands in your database console:

```sql
-- Referral codes table
CREATE TABLE referral_codes (
  code VARCHAR(20) PRIMARY KEY,
  owner_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User to referrer bindings
CREATE TABLE referrer_bindings (
  user_address VARCHAR(42) PRIMARY KEY,
  referrer_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Swap logs
CREATE TABLE swap_logs (
  tx_hash VARCHAR(66) PRIMARY KEY,
  user_address VARCHAR(42) NOT NULL,
  referrer_address VARCHAR(42),
  gross_amount_wei VARCHAR(78) NOT NULL,
  platform_fee_wei VARCHAR(78) NOT NULL,
  platform_cut_wei VARCHAR(78) NOT NULL,
  referrer_cut_wei VARCHAR(78) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral earnings tracking
CREATE TABLE referral_earnings (
  referrer_address VARCHAR(42) PRIMARY KEY,
  total_earned_wei VARCHAR(78) NOT NULL DEFAULT '0',
  total_claimed_wei VARCHAR(78) NOT NULL DEFAULT '0',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_bindings_referrer ON referrer_bindings(referrer_address);
CREATE INDEX idx_swaps_user ON swap_logs(user_address);
CREATE INDEX idx_swaps_referrer ON swap_logs(referrer_address);
CREATE INDEX idx_codes_owner ON referral_codes(owner_address);
```

## Step 2: Deploy Backend to Vercel

### 2.1 Create `vercel.json` in `server/` (Already exists!)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ]
}
```

### 2.2 Deploy Backend
```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to server directory
cd server

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: plasm-x-swap-api
# - Directory: . (current)
# - Override settings? No

# Deploy to production
vercel --prod
```

### 3.3 Set Environment Variables in Vercel
In Vercel dashboard → Settings → Environment Variables:

```
DATABASE_URL = postgresql://...  (your pooled connection string)
DEPLOYER_PRIVATE_KEY = 0x...  (your private key)
VAULT_ADDRESS = 0xB21486D9499a2cD8CE3e638E4077327affd8F24f
CHAIN_ID = 9745
PLASMA_RPC = https://rpc.plasma.to
FRONTEND_ORIGIN = https://your-frontend.vercel.app  (will update after frontend deploy)
```

**Copy your backend URL**: `https://plasm-x-swap-api.vercel.app`

## Step 4: Deploy Frontend to Vercel

### 4.1 Update Frontend Environment
Create `plasm-x-swap/.env`:
```
VITE_BACKEND_URL=https://plasm-x-swap-api.vercel.app
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_CHAIN_ID=9745
VITE_VAULT_ADDRESS=0xB21486D9499a2cD8CE3e638E4077327affd8F24f
```

### 4.2 Deploy Frontend
```bash
# Navigate to frontend directory
cd plasm-x-swap

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: plasm-x-swap
# - Directory: . (current)
# - Build command: npm run build
# - Output directory: dist
# - Override settings? No

# Deploy to production
vercel --prod
```

### 4.3 Set Environment Variables in Vercel
In Vercel dashboard → Settings → Environment Variables:

```
VITE_BACKEND_URL = https://plasm-x-swap-api.vercel.app
VITE_PRIVY_APP_ID = your-privy-app-id
VITE_CHAIN_ID = 9745
VITE_VAULT_ADDRESS = 0xB21486D9499a2cD8CE3e638E4077327affd8F24f
```

**Copy your frontend URL**: `https://plasm-x-swap.vercel.app`

### 4.4 Update Backend CORS
Go back to backend Vercel → Settings → Environment Variables:
```
FRONTEND_ORIGIN = https://plasm-x-swap.vercel.app
```

Redeploy backend: `vercel --prod` (from server directory)

## Step 5: Configure Privy

1. Go to [dashboard.privy.io](https://dashboard.privy.io)
2. Select your app
3. Go to Settings → Domain allowlist
4. Add your Vercel frontend URL: `https://plasm-x-swap.vercel.app`
5. Add allowed chains:
   - Chain ID: 9745
   - RPC URL: https://rpc.plasma.to
   - Name: Plasma Network

## Step 6: Test Production

### 6.1 Test Swap Flow
1. Visit `https://plasm-x-swap.vercel.app`
2. Connect wallet (Privy)
3. Execute a swap
4. Verify 2% fee deduction
5. Check platform wallet receives 100% of fees

### 6.2 Test Referral System
1. Create referral code: Click "Share & Earn" → "Create Referral Code"
2. Copy referral link: `https://plasm-x-swap.vercel.app?ref=YOUR_CODE`
3. Open in incognito/different wallet
4. Execute swap with referral
5. Check referrer earnings in "Share & Earn" modal
6. Test claim function

## Verification Checklist

- [ ] Frontend deployed and accessible
- [ ] Backend API responding (test `/api/tokens`)
- [ ] Database connected (check Vercel logs)
- [ ] Swaps execute with 2% fee
- [ ] Platform wallet receives fees
- [ ] Referral codes work
- [ ] Referral earnings tracked correctly
- [ ] Claim function works (EIP-712 voucher)
- [ ] Mobile responsive (test on phone)

## Troubleshooting

### Frontend can't connect to backend
- Check `VITE_BACKEND_URL` is set correctly
- Verify CORS `FRONTEND_ORIGIN` in backend env vars
- Check browser console for CORS errors

### Database connection fails
- Ensure you're using **pooled connection string** (not direct)
- Check DATABASE_URL format includes `?sslmode=require`
- Verify database tables are created

### Claim fails
- Check `DEPLOYER_PRIVATE_KEY` is set in backend
- Verify wallet has correct chain ID (9745)
- Check browser console for detailed error

### Privy wallet issues
- Verify domain is allowlisted in Privy dashboard
- Check Plasma Network (9745) is added to allowed chains
- Ensure Privy App ID matches in frontend env

## Manual Fee Distribution

Platform must manually send 30% of accumulated fees to ReferrerVault:

```javascript
// Calculate 30% of platform balance
const balance = await ethers.provider.getBalance(PLATFORM_WALLET);
const amountToSend = balance * 30n / 100n;

// Send to ReferrerVault
const tx = await wallet.sendTransaction({
  to: '0xB21486D9499a2cD8CE3e638E4077327affd8F24f',
  value: amountToSend
});
```

## Support

For issues, check:
- Vercel deployment logs
- Browser console (frontend errors)
- Database query logs
- Network tab (API calls)

## Live URLs (Update after deployment)

- **Frontend**: https://plasm-x-swap.vercel.app
- **Backend API**: https://plasm-x-swap-api.vercel.app
- **Platform Wallet**: 0x022ac0f0505be925e3863bb3af5f4c3aaacff1b0
- **ReferrerVault**: 0xB21486D9499a2cD8CE3e638E4077327affd8F24f
- **Plasma Network**: Chain ID 9745
