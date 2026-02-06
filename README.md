# Allium Intelligence Dashboard

Real-time blockchain analytics dashboard powered by [Allium](https://allium.so) and Claude AI.

## Features
- 🔍 **Wallet Lookup** — AI-powered wallet analysis via Claude + Allium MCP
- 🐋 **Whale Feed** — Real $1M+ transfers with entity labels from Allium Explorer
- 📊 **Market Overview** — Cross-chain metrics, DEX rankings, TVL, fees, stablecoin volume
- 🤖 **Ask Allium** — Natural language queries against 130+ blockchains
- 🔥 **Market Freakout** — Current dip vs historical crashes comparison
- 🔮 **What If Calculator** — Price projection tool with Giphy celebrations

## Deploy to Vercel

### Option 1: CLI
```bash
npm install
npm run dev          # local dev
npm run build        # production build
npx vercel           # deploy
```

### Option 2: GitHub
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import from GitHub
3. Vercel auto-detects Vite — just click Deploy

## Configuration

### API Keys (already embedded)
- **Allium API Key**: Used for real-time token prices (direct REST API)
- **Anthropic API**: Used for AI features (wallet lookup, ask allium, whale feed)
- **Allium MCP**: Connected via `https://mcp-oauth.allium.so`

### Price Updates
Prices refresh every 30 seconds via:
1. **Direct Allium API** (`api.allium.so`) — primary, used on Vercel
2. **MCP fallback** (via `api.anthropic.com`) — used in Claude artifact sandbox

### Data Sources
All market data comes from Allium Explorer SQL queries:
- `crosschain.metrics.overview` — chain activity, TVL, fees, addresses
- `crosschain.metrics.dex_overview` — DEX volume by project
- `crosschain.metrics.stablecoin_volume` — stablecoin transfer volumes
- `crosschain.assets.transfers` — real-time whale transfers
- `common.identity.address_names` — entity labels (CEX, DeFi, etc.)

## Tech Stack
- React 18 + Vite
- Anthropic Claude API (claude-sonnet-4-20250514)
- Allium MCP + REST API
- Giphy (celebration GIFs)
- Pure CSS animations (no Tailwind dependency)
