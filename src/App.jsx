import React from "react";
import { useState, useEffect, useCallback } from "react";

// ===================================================
// ALLIUM WALLET INTELLIGENCE + MARKET DASHBOARD
// Real-time wallet lookup + cross-chain market data
// ===================================================

// Helper: route Anthropic API calls through /api/claude proxy on Vercel, direct in artifact sandbox
async function callClaude(body) {
  // Try the serverless proxy first (works on Vercel)
  try {
    const proxyRes = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (proxyRes.ok) return await proxyRes.json();
  } catch (e) { /* proxy not available, try direct */ }
  
  // Fallback: direct call (works in Claude artifact sandbox)
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// --- Pre-loaded market data from Allium (queried Feb 6, 2026) ---
// These are fallback values; live prices are fetched via Allium API every 2 min
const ALLIUM_API_KEY = "A_v_ewve_VPL0cPrwYDtgqfRDG5MtUfFr1ylc4j3htvHSg8X8yB_GwNHi6kObudzeJrZZ7tMuNPKPl0gtahoYA";

// Allium API base - uses Vite proxy locally, direct URL on Vercel
const ALLIUM_BASE = window.location.hostname === "localhost" ? "/allium-api" : "https://api.allium.so";
const TOKEN_ADDRESSES = {
  bitcoin: { chain: "bitcoin", address: "native" },
  ethereum: { chain: "ethereum", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
  solana: { chain: "solana", address: "So11111111111111111111111111111111111111112" },
};

let PRICE_DATA = {
  bitcoin: { price: 68787.00, change24h: 2.78, vol24h: 768.2, twoWeekChange: -47.8 },
  ethereum: { price: 1994.89, change24h: 2.60, vol24h: 2132.8, twoWeekChange: -22.4 },
  solana: { price: 84.62, change24h: 0.48, vol24h: 12352.1, twoWeekChange: -28.7 },
};

const STABLECOIN_DATA = {
  ethereum: { usdc: 448.2, usdt: 184.6, dai: 25.8, total: 658.6 },
  solana: { usdc: 234.0, usdt: 16.9, dai: 0.0003, total: 250.9 },
};

// --- HISTORICAL CYCLE DRAWDOWNS (major dips in each 4-year cycle) ---
const CYCLE_DRAWDOWNS = {
  bitcoin: [
    { cycle: "2013-2017", event: "Mt. Gox Hack", date: "Feb 2014", peak: 1150, bottom: 175, drawdown: -84.8, duration: "2 weeks", recovery: "14 months" },
    { cycle: "2013-2017", event: "China Exchange Ban", date: "Sep 2017", peak: 4980, bottom: 2972, drawdown: -40.3, duration: "2 weeks", recovery: "2 months" },
    { cycle: "2017-2021", event: "COVID Crash", date: "Mar 2020", peak: 10500, bottom: 3850, drawdown: -63.3, duration: "1 week", recovery: "5 months" },
    { cycle: "2021-2025", event: "FTX Collapse", date: "Nov 2022", peak: 21000, bottom: 15500, drawdown: -26.2, duration: "1 week", recovery: "18 months" },
    { cycle: "2021-2025", event: "Silicon Valley Bank", date: "Mar 2023", peak: 28400, bottom: 19800, drawdown: -30.3, duration: "3 days", recovery: "2 months" },
    { cycle: "2025-2029", event: "Feb 2026 Dip", date: "Feb 2026", peak: 126272, bottom: 65896, drawdown: -47.8, duration: "4 months", recovery: "?" },
  ],
  ethereum: [
    { cycle: "2015-2019", event: "DAO Hack", date: "Jun 2016", peak: 21.50, bottom: 6.00, drawdown: -72.1, duration: "2 weeks", recovery: "8 months" },
    { cycle: "2017-2021", event: "COVID Crash", date: "Mar 2020", peak: 290, bottom: 85, drawdown: -70.7, duration: "1 week", recovery: "6 months" },
    { cycle: "2017-2021", event: "China Mining Ban", date: "May 2021", peak: 4380, bottom: 1700, drawdown: -61.2, duration: "3 weeks", recovery: "4 months" },
    { cycle: "2021-2025", event: "FTX Collapse", date: "Nov 2022", peak: 1650, bottom: 880, drawdown: -46.7, duration: "1 week", recovery: "20 months" },
    { cycle: "2021-2025", event: "USDC Depeg", date: "Mar 2023", peak: 1850, bottom: 1365, drawdown: -26.2, duration: "2 days", recovery: "3 weeks" },
    { cycle: "2025-2029", event: "Feb 2026 Dip", date: "Feb 2026", peak: 2475, bottom: 1920, drawdown: -22.4, duration: "2 weeks", recovery: "?" },
  ],
  solana: [
    { cycle: "2020-2024", event: "FTX Collapse", date: "Nov 2022", peak: 260, bottom: 8, drawdown: -96.9, duration: "2 weeks", recovery: "24+ months" },
    { cycle: "2020-2024", event: "Network Outage", date: "Feb 2023", peak: 27, bottom: 18, drawdown: -33.3, duration: "1 day", recovery: "2 months" },
    { cycle: "2020-2024", event: "Meme Coin Crash", date: "Apr 2024", peak: 205, bottom: 128, drawdown: -37.6, duration: "1 week", recovery: "6 weeks" },
    { cycle: "2025-2029", event: "Feb 2026 Dip", date: "Feb 2026", peak: 116, bottom: 82.7, drawdown: -28.7, duration: "2 weeks", recovery: "?" },
  ],
};

// --- EXAMPLE WALLETS for the team to try ---
const EXAMPLE_WALLETS = [
  { label: "Donald Trump", address: "0x94845333028B1204Fbe14E1278Fd4Adde46B22ce", chain: "ethereum" },
  { label: "Vitalik Buterin", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "ethereum" },
  { label: "Justin Sun", address: "0x176F3DAb24a159341c0509bB36B833E7fdd0a132", chain: "ethereum" },
  { label: "Coinbase", address: "0x503828976D22510aad0201ac7EC88293211D23Da", chain: "ethereum" },
];

// --- Utility ---
function shortenAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// === COMPONENTS ===

function LiveDot({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,227,158,0.4)}50%{opacity:0.5;box-shadow:0 0 0 6px rgba(0,227,158,0)}}`}</style>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E39E", animation: "pulse 2s infinite" }} />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 2 }}>{label || "Live · Allium"}</span>
    </div>
  );
}

function TabButton({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "rgba(255,255,255,0.08)" : "transparent",
      border: active ? `1px solid ${color || "#00E39E"}40` : "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8, padding: "10px 20px", cursor: "pointer", transition: "all 0.2s ease",
      color: active ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 500,
    }}>
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 40, justifyContent: "center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#00E39E", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Querying Allium...</span>
    </div>
  );
}

// --- Transaction row ---
function TxRow({ tx, index }) {
  const transfer = tx.asset_transfers?.[0];
  const isReceived = transfer?.transfer_type === "received";
  const symbol = transfer?.asset?.symbol || "???";
  const amount = transfer?.amount?.amount_str || "0";
  const name = transfer?.asset?.name || symbol;

  // Truncate display amount
  let displayAmount = amount;
  if (amount.length > 12) displayAmount = parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "80px 1fr 140px 100px", gap: 12, alignItems: "center",
      padding: "12px 16px", background: index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
      borderRadius: 6, transition: "background 0.15s ease",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
    onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"}
    >
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
        {timeAgo(tx.block_timestamp)}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: isReceived ? "rgba(0,227,158,0.15)" : "rgba(255,77,106,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: isReceived ? "#00E39E" : "#FF4D6A",
        }}>
          {isReceived ? "↓" : "↑"}
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            {isReceived ? "from " : "to "}{shortenAddr(isReceived ? tx.from_address : tx.to_address)}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
          color: isReceived ? "#00E39E" : "#FF4D6A",
        }}>
          {isReceived ? "+" : "-"}{displayAmount}
        </span>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{symbol}</div>
      </div>
      <a
        href={`https://etherscan.io/tx/${tx.hash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace", textDecoration: "none", textAlign: "right" }}
      >
        {shortenAddr(tx.hash)}
      </a>
    </div>
  );
}

// --- Market Overview Mini Cards ---
function MarketMini({ livePrices }) {
  const prices = livePrices || PRICE_DATA;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      {[
        { name: "BTC", ...prices.bitcoin, color: "#F7931A" },
        { name: "ETH", ...prices.ethereum, color: "#627EEA" },
        { name: "SOL", ...prices.solana, color: "#00FFA3" },
      ].map((c) => (
        <div key={c.name} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${c.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.name}</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>
              ${c.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: 11, color: c.change24h >= 0 ? "#00E39E" : "#FF4D6A", marginLeft: "auto" }}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1 }}>24h Volume</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace" }}>
                {c.vol24h > 0 ? `$${c.vol24h >= 1000 ? (c.vol24h / 1000).toFixed(1) + "T" : c.vol24h.toFixed(0) + "B"}` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1 }}>2wk Change</div>
              <div style={{ fontSize: 13, color: c.twoWeekChange >= 0 ? "#00E39E" : "#FF4D6A", fontFamily: "'JetBrains Mono', monospace" }}>
                {c.twoWeekChange >= 0 ? "+" : ""}{c.twoWeekChange.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// === MARKET PULSE - Live cross-chain metrics from Allium Explorer ===
const CHAIN_COLORS = {
  solana: "#00FFA3", ethereum: "#627EEA", bsc: "#F0B90B", base: "#0052FF",
  arbitrum: "#28A0F0", polygon: "#8247E5", optimism: "#FF0420", bitcoin: "#F7931A",
};

// Static data from Allium Explorer queries (Feb 5, 2026)
const CROSSCHAIN_DAILY = [
  { date: "Jan 29", txns: 338322442, addrs: 9544909, dexVol: 24189217849, tvl: 329170332499, fees: 3239090 },
  { date: "Jan 30", txns: 362419204, addrs: 8981216, dexVol: 29430702875, tvl: 317232684422, fees: 4151567 },
  { date: "Jan 31", txns: 354963804, addrs: 8351785, dexVol: 29239791228, tvl: 307972560951, fees: 5307305 },
  { date: "Feb 1", txns: 348194890, addrs: 8730971, dexVol: 29448282035, tvl: 293115181834, fees: 3000061 },
  { date: "Feb 2", txns: 367219682, addrs: 9245889, dexVol: 29130105843, tvl: 283250782497, fees: 3354188 },
  { date: "Feb 3", txns: 353385708, addrs: 9848083, dexVol: 27606375052, tvl: 287043561149, fees: 3235570 },
  { date: "Feb 4", txns: 351954149, addrs: 9160619, dexVol: 26420262049, tvl: 282971109697, fees: 3152217 },
  { date: "Feb 5", txns: 394398784, addrs: 9800806, dexVol: 30767706939, tvl: 274213313950, fees: 7227035 },
];

const CHAIN_BREAKDOWN = [
  { chain: "solana", txns: 329391489, addrs: 3255638, dexVol: 14582564950, fees: 876084, newAddrs: 1693417 },
  { chain: "bsc", txns: 19692361, addrs: 3381770, dexVol: 5952471820, fees: 449940, newAddrs: 1242928 },
  { chain: "ethereum", txns: 2263196, addrs: 766721, dexVol: 5943870609, fees: 3301294, newAddrs: 283091 },
  { chain: "base", txns: 19637126, addrs: 483265, dexVol: 2468042905, fees: 1870741, newAddrs: 84600 },
  { chain: "arbitrum", txns: 9741556, addrs: 425232, dexVol: 1267475595, fees: 74301, newAddrs: 235332 },
  { chain: "polygon", txns: 7223709, addrs: 514869, dexVol: 190410154, fees: 217020, newAddrs: 108933 },
  { chain: "optimism", txns: 3823880, addrs: 27706, dexVol: 74216041, fees: 27804, newAddrs: 5830 },
  { chain: "bitcoin", txns: 384550, addrs: 544569, dexVol: 0, fees: 378474, newAddrs: 368067 },
];

const TOP_DEXES = [
  { name: "Raydium+Jupiter", chain: "solana", vol: 9691241905, color: "#00FFA3" },
  { name: "PancakeSwap", chain: "bsc", vol: 4988826216, color: "#F0B90B" },
  { name: "Uniswap", chain: "ethereum", vol: 3710111652, color: "#627EEA" },
  { name: "Meteora", chain: "solana", vol: 2891520892, color: "#00FFA3" },
  { name: "Curve Finance", chain: "ethereum", vol: 1230951618, color: "#627EEA" },
  { name: "Aerodrome", chain: "base", vol: 1223951351, color: "#0052FF" },
  { name: "Uniswap", chain: "arbitrum", vol: 1092778319, color: "#28A0F0" },
];

const STABLECOIN_DAILY = [
  { date: "Jan 30", vol: 317393937018 },
  { date: "Jan 31", vol: 312562010428 },
  { date: "Feb 1", vol: 297524768031 },
  { date: "Feb 2", vol: 647654435578 },
  { date: "Feb 3", vol: 525627742480 },
  { date: "Feb 4", vol: 377838820979 },
  { date: "Feb 5", vol: 1270931005224 },
];

function MiniSparkline({ data, color, height = 32, width = 120 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

function MarketDashboard() {
  const latest = CROSSCHAIN_DAILY[CROSSCHAIN_DAILY.length - 1];
  const prev = CROSSCHAIN_DAILY[CROSSCHAIN_DAILY.length - 2];
  
  const pctChange = (curr, old) => {
    if (!old || old === 0) return 0;
    return ((curr - old) / old * 100);
  };
  
  const fmtB = (n) => n >= 1e12 ? `$${(n / 1e12).toFixed(1)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${n.toFixed(0)}`;
  const fmtN = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${n}`;
  
  return (
    <div>
      {/* Key metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 16, marginBottom: 16 }}>
        {[
          { label: "Daily Txns", value: fmtN(latest.txns), change: pctChange(latest.txns, prev.txns), spark: CROSSCHAIN_DAILY.map(d => d.txns), color: "#00E39E" },
          { label: "Active Addresses", value: fmtN(latest.addrs), change: pctChange(latest.addrs, prev.addrs), spark: CROSSCHAIN_DAILY.map(d => d.addrs), color: "#627EEA" },
          { label: "DEX Volume", value: fmtB(latest.dexVol), change: pctChange(latest.dexVol, prev.dexVol), spark: CROSSCHAIN_DAILY.map(d => d.dexVol), color: "#00FFA3" },
          { label: "Total TVL", value: fmtB(latest.tvl), change: pctChange(latest.tvl, prev.tvl), spark: CROSSCHAIN_DAILY.map(d => d.tvl), color: "#FFA726" },
        ].map((m) => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{m.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{m.value}</div>
                <span style={{ fontSize: 10, color: m.change >= 0 ? "#00E39E" : "#FF4D6A", fontWeight: 600 }}>
                  {m.change >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(m.change).toFixed(1)}%
                </span>
              </div>
              <MiniSparkline data={m.spark} color={m.color} height={28} width={70} />
            </div>
          </div>
        ))}
      </div>

      {/* Network fees + stablecoin volume */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Network Fees (24h)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#FFA726", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
            {fmtB(latest.fees)}
          </div>
          <MiniSparkline data={CROSSCHAIN_DAILY.map(d => d.fees)} color="#FFA726" height={24} width={200} />
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>Fee spike = high demand · Allium Explorer</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Stablecoin Volume (24h)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#2775CA", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
            {fmtB(STABLECOIN_DAILY[STABLECOIN_DAILY.length - 1].vol)}
          </div>
          <MiniSparkline data={STABLECOIN_DAILY.map(d => d.vol)} color="#2775CA" height={24} width={200} />
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>Cross-chain USDC + USDT + DAI · Allium Explorer</div>
        </div>
      </div>

      {/* Chain activity breakdown */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Chain Activity Breakdown (Feb 5)</div>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8, padding: "0 0 8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {["Chain", "Transactions", "Active Addrs", "DEX Volume", "Fees"].map(h => (
            <span key={h} style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
          ))}
        </div>
        {CHAIN_BREAKDOWN.map((c) => {
          const maxTxn = Math.max(...CHAIN_BREAKDOWN.map(x => x.txns));
          const maxDex = Math.max(...CHAIN_BREAKDOWN.map(x => x.dexVol));
          return (
            <div key={c.chain} style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 1fr 1fr", gap: 6, padding: "6px 0", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CHAIN_COLORS[c.chain] || "#888" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>{c.chain}</span>
              </div>
              <div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(c.txns / maxTxn) * 100}%`, height: "100%", background: CHAIN_COLORS[c.chain], borderRadius: 3, opacity: 0.7 }} />
                </div>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>{fmtN(c.txns)}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>{fmtN(c.addrs)}</div>
              <div>
                {c.dexVol > 0 ? (
                  <>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${(c.dexVol / maxDex) * 100}%`, height: "100%", background: CHAIN_COLORS[c.chain], borderRadius: 3, opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>{fmtB(c.dexVol)}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>—</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>{fmtB(c.fees)}</div>
            </div>
          );
        })}
      </div>

      {/* Top DEXes bar chart */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Top DEXes by Volume (Feb 5)</div>
        {TOP_DEXES.map((d) => {
          const maxVol = TOP_DEXES[0].vol;
          return (
            <div key={d.name + d.chain} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ width: 120, fontSize: 11, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
              <span style={{ width: 65, fontSize: 9, color: d.color, textTransform: "capitalize", fontWeight: 500 }}>{d.chain}</span>
              <div style={{ flex: 1, height: 14, background: "rgba(255,255,255,0.03)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(d.vol / maxVol) * 100}%`, height: "100%", background: `${d.color}90`, borderRadius: 3, transition: "width 1s ease" }} />
              </div>
              <span style={{ width: 70, fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                {fmtB(d.vol)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Data source footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>Data: Allium Explorer · crosschain.metrics.overview + dex_overview + stablecoin_volume</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>9 chains · 130+ indexed</span>
      </div>
    </div>
  );
}

// --- MARKET FREAKOUT COMPARISON ---
function MarketFreakout() {
  const [selectedAsset, setSelectedAsset] = useState("bitcoin");
  
  const assets = [
    { id: "bitcoin", name: "BTC", color: "#F7931A", current: PRICE_DATA.bitcoin.twoWeekChange },
    { id: "ethereum", name: "ETH", color: "#627EEA", current: PRICE_DATA.ethereum.twoWeekChange },
    { id: "solana", name: "SOL", color: "#00FFA3", current: PRICE_DATA.solana.twoWeekChange },
  ];

  const drawdowns = CYCLE_DRAWDOWNS[selectedAsset];
  const currentAsset = assets.find(a => a.id === selectedAsset);

  // Find current dip in the drawdowns (last item with "?")
  const currentDip = drawdowns.find(d => d.recovery === "?");

  return (
    <div>
      {/* Asset selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {assets.map((a) => (
          <button key={a.id} onClick={() => setSelectedAsset(a.id)} style={{
            flex: 1, padding: "14px 20px", borderRadius: 10, cursor: "pointer", transition: "all 0.2s ease",
            background: selectedAsset === a.id ? `${a.color}15` : "rgba(255,255,255,0.02)",
            border: selectedAsset === a.id ? `2px solid ${a.color}40` : "1px solid rgba(255,255,255,0.06)",
            color: "#fff",
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{a.name}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: a.color }}>
              {a.current.toFixed(1)}%
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>2-Week Change</div>
          </button>
        ))}
      </div>

      {/* Current dip callout */}
      <div style={{
        background: "rgba(255,77,106,0.08)", border: "1px solid rgba(255,77,106,0.2)",
        borderRadius: 12, padding: 20, marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 32 }}>📉</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
              Current {currentAsset.name} Dip: {currentDip.drawdown.toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              {currentDip.duration} drawdown · Started at ${currentDip.peak.toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
          How does this compare to past cycles? Scroll down to see historical drawdowns...
        </div>
      </div>

      {/* Drawdown Comparison Chart */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 20 }}>
          📊 Drawdown Severity Comparison
        </div>

        <div style={{ position: "relative", height: 320, paddingLeft: 50, paddingBottom: 40 }}>
          {/* Y-axis labels */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 40, width: 40, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[0, -25, -50, -75, -100].map((val) => (
              <div key={val} style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                {val}%
              </div>
            ))}
          </div>

          {/* Grid lines */}
          <div style={{ position: "absolute", left: 50, right: 0, top: 0, bottom: 40 }}>
            {[0, 25, 50, 75, 100].map((pct) => (
              <div key={pct} style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${pct}%`,
                height: 1,
                background: "rgba(255,255,255,0.03)",
              }} />
            ))}
          </div>

          {/* Bars */}
          <div style={{ position: "absolute", left: 50, right: 0, top: 0, bottom: 40, display: "flex", alignItems: "flex-end", gap: 8, paddingRight: 20 }}>
            {drawdowns.map((d, i) => {
              const isCurrent = d.recovery === "?";
              const height = Math.abs(d.drawdown);
              const maxHeight = 100; // represents -100%
              
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative" }}>
                  {/* Bar */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 60,
                      height: `${(height / maxHeight) * 100}%`,
                      background: isCurrent 
                        ? `linear-gradient(180deg, ${currentAsset.color} 0%, ${currentAsset.color}80 100%)`
                        : "linear-gradient(180deg, rgba(255,77,106,0.4) 0%, rgba(255,77,106,0.2) 100%)",
                      borderRadius: "4px 4px 0 0",
                      border: isCurrent ? `2px solid ${currentAsset.color}` : "1px solid rgba(255,77,106,0.3)",
                      position: "relative",
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scaleY(1.05)";
                      e.currentTarget.style.filter = "brightness(1.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scaleY(1)";
                      e.currentTarget.style.filter = "brightness(1)";
                    }}
                  >
                    {/* Percentage label on bar */}
                    <div style={{
                      position: "absolute",
                      top: -20,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 9,
                      fontWeight: 600,
                      color: isCurrent ? currentAsset.color : "#FF4D6A",
                      fontFamily: "'JetBrains Mono', monospace",
                      whiteSpace: "nowrap",
                    }}>
                      {d.drawdown.toFixed(1)}%
                    </div>
                    
                    {/* Current indicator */}
                    {isCurrent && (
                      <div style={{
                        position: "absolute",
                        top: -40,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 16,
                      }}>
                        ⚡
                      </div>
                    )}
                  </div>

                  {/* X-axis label */}
                  <div style={{
                    marginTop: 8,
                    fontSize: 8,
                    color: isCurrent ? currentAsset.color : "rgba(255,255,255,0.4)",
                    textAlign: "center",
                    fontWeight: isCurrent ? 600 : 400,
                    lineHeight: 1.2,
                    maxWidth: 60,
                  }}>
                    {d.date.split(" ").slice(0, 2).join(" ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "linear-gradient(180deg, rgba(255,77,106,0.4) 0%, rgba(255,77,106,0.2) 100%)", border: "1px solid rgba(255,77,106,0.3)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Historical Drawdowns</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: `linear-gradient(180deg, ${currentAsset.color} 0%, ${currentAsset.color}80 100%)`, border: `2px solid ${currentAsset.color}` }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Current Dip ⚡</span>
          </div>
        </div>
      </div>

      {/* Historical comparison */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 20 }}>
          🔄 Historical Cycle Drawdowns
        </div>

        {drawdowns.map((d, i) => {
          const isCurrent = d.recovery === "?";
          const maxDrawdown = Math.max(...drawdowns.map(x => Math.abs(x.drawdown)));
          
          return (
            <div key={i} style={{
              marginBottom: 16, padding: "16px 20px", borderRadius: 10,
              background: isCurrent ? "rgba(255,77,106,0.06)" : "rgba(255,255,255,0.02)",
              border: isCurrent ? "2px solid rgba(255,77,106,0.2)" : "1px solid rgba(255,255,255,0.04)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{d.event}</span>
                    {isCurrent && (
                      <span style={{ fontSize: 9, color: "#FF4D6A", background: "rgba(255,77,106,0.15)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {d.date} · {d.cycle} cycle
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#FF4D6A", fontFamily: "'JetBrains Mono', monospace" }}>
                    {d.drawdown.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{d.duration}</div>
                </div>
              </div>

              {/* Visual bar */}
              <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                <div style={{
                  width: `${(Math.abs(d.drawdown) / maxDrawdown) * 100}%`,
                  height: "100%",
                  background: isCurrent ? "#FF4D6A" : "rgba(255,77,106,0.5)",
                  borderRadius: 4,
                  transition: "width 1s ease",
                }} />
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1 }}>Peak</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace" }}>
                    ${d.peak.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1 }}>Bottom</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace" }}>
                    ${d.bottom.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1 }}>Recovery</div>
                  <div style={{ fontSize: 12, color: isCurrent ? "#FF4D6A" : "#00E39E", fontFamily: "'JetBrains Mono', monospace" }}>
                    {d.recovery}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight box */}
      <div style={{
        marginTop: 20, background: "rgba(0,227,158,0.06)", border: "1px solid rgba(0,227,158,0.15)",
        borderRadius: 12, padding: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#00E39E", marginBottom: 8 }}>💡 Perspective</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          The current {currentAsset.name} drawdown of <strong>{currentDip.drawdown.toFixed(1)}%</strong> is {
            Math.abs(currentDip.drawdown) < 30 ? "relatively mild" :
            Math.abs(currentDip.drawdown) < 50 ? "moderate" :
            Math.abs(currentDip.drawdown) < 70 ? "significant" : "severe"
          } compared to historical cycle corrections. {
            selectedAsset === "bitcoin" && "BTC has weathered drawdowns as large as -84.8% (Mt. Gox) and recovered."
          }{
            selectedAsset === "ethereum" && "ETH has seen corrections up to -72% (DAO Hack) and bounced back stronger."
          }{
            selectedAsset === "solana" && "SOL survived a -96.9% crash during FTX and recovered to new highs."
          }
        </div>
      </div>
    </div>
  );
}

// --- WHAT IF CALCULATOR ---
function WhatIfCalculator() {
  const [btcIncrease, setBtcIncrease] = useState("");
  const [ethIncrease, setEthIncrease] = useState("");
  const [solIncrease, setSolIncrease] = useState("");
  const [reason, setReason] = useState("");
  const [years, setYears] = useState("3");
  const [showResults, setShowResults] = useState(false);
  const [giphyUrl, setGiphyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectionLog, setProjectionLog] = useState([]);
  const [storageLoading, setStorageLoading] = useState(true);

  // Load shared projection log on mount
  useEffect(() => {
    loadProjectionLog();
  }, []);

  const loadProjectionLog = async () => {
    try {
      const result = await window.storage.get('allium-projection-log', true);
      if (result && result.value) {
        const logs = JSON.parse(result.value);
        setProjectionLog(logs);
        console.log("Loaded", logs.length, "projections from shared storage");
      }
    } catch (err) {
      console.log("No existing log found or error loading:", err);
    } finally {
      setStorageLoading(false);
    }
  };

  const saveProjectionLog = async (newLog) => {
    try {
      await window.storage.set('allium-projection-log', JSON.stringify(newLog), true);
      console.log("Saved projection log to shared storage");
    } catch (err) {
      console.error("Error saving to shared storage:", err);
    }
  };

  const calculateProjections = async () => {
    if (!btcIncrease && !ethIncrease && !solIncrease) return;
    if (!reason.trim()) {
      alert("Don't forget to tell us WHY this will happen! 🚀");
      return;
    }

    setLoading(true);
    setShowResults(false);

    // Create log entry
    const logEntry = {
      timestamp: new Date().toLocaleString(),
      years,
      btc: btcIncrease || "N/A",
      eth: ethIncrease || "N/A",
      sol: solIncrease || "N/A",
      reason,
    };

    // Add to log (keep last 20 for company-wide view)
    const updatedLog = [logEntry, ...projectionLog].slice(0, 20);
    setProjectionLog(updatedLog);
    
    // Save to shared storage so all users see it
    await saveProjectionLog(updatedLog);

    // Console log for debugging
    console.log("=== WHAT IF PROJECTION LOG ===");
    console.log("Timestamp:", logEntry.timestamp);
    console.log("Years:", years);
    console.log("BTC Increase:", btcIncrease || "N/A");
    console.log("ETH Increase:", ethIncrease || "N/A");
    console.log("SOL Increase:", solIncrease || "N/A");
    console.log("Reason:", reason);
    console.log("==============================");

    // Celebration GIFs - direct media URLs from Giphy
    const celebTexts = [
      { text: "MONEY PRINTER GO BRRRR", color: "#00E39E" },
      { text: "TO THE MOON!", color: "#F7931A" },
      { text: "STONKS ONLY GO UP", color: "#627EEA" },
      { text: "WE'RE ALL GONNA MAKE IT", color: "#00FFA3" },
      { text: "GENERATIONAL WEALTH", color: "#FFA726" },
    ];
    const celebText = celebTexts[Math.floor(Math.random() * celebTexts.length)];
    
    // Direct .gif URLs from Giphy CDN (media.giphy.com)
    const gifUrls = [
      "https://media.giphy.com/media/67ThRZlYBvibtMA4AP/giphy.gif",
      "https://media.giphy.com/media/xTiTnqUxyWbsAXq7Ju/giphy.gif",
      "https://media.giphy.com/media/3o6ZtpxSZbQRRnwCKQ/giphy.gif",
      "https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif",
      "https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif",
      "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif",
      "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif",
      "https://media.giphy.com/media/KzDqC8LvVC4lshCcGK/giphy.gif",
      "https://media.giphy.com/media/l0K4mbH4lKBhAPFU4/giphy.gif",
      "https://media.giphy.com/media/Y2ZUWLrTy63j9T6qrK/giphy.gif",
      "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif",
    ];
    const gifUrl = gifUrls[Math.floor(Math.random() * gifUrls.length)];
    
    setGiphyUrl(JSON.stringify({ ...celebText, gif: gifUrl }));

    // Small delay to show the loading state
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setLoading(false);
    setShowResults(true);
  };

  const currentPrices = {
    btc: PRICE_DATA.bitcoin.price,
    eth: PRICE_DATA.ethereum.price,
    sol: PRICE_DATA.solana.price,
  };

  const projections = {
    btc: btcIncrease ? currentPrices.btc * (1 + parseFloat(btcIncrease) / 100) : null,
    eth: ethIncrease ? currentPrices.eth * (1 + parseFloat(ethIncrease) / 100) : null,
    sol: solIncrease ? currentPrices.sol * (1 + parseFloat(solIncrease) / 100) : null,
  };

  const assets = [
    { id: "btc", name: "BTC", color: "#F7931A", current: currentPrices.btc, projected: projections.btc, increase: btcIncrease },
    { id: "eth", name: "ETH", color: "#627EEA", current: currentPrices.eth, projected: projections.eth, increase: ethIncrease },
    { id: "sol", name: "SOL", color: "#00FFA3", current: currentPrices.sol, projected: projections.sol, increase: solIncrease },
  ];

  return (
    <div>
      {/* Loading state */}
      {storageLoading && (
        <div style={{
          background: "rgba(0,227,158,0.06)", border: "1px solid rgba(0,227,158,0.15)",
          borderRadius: 12, padding: 16, marginBottom: 24, textAlign: "center",
        }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            🔄 Loading company projections...
          </div>
        </div>
      )}

      {/* Input Form */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: 24, marginBottom: 24,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
          🔮 Crystal Ball Mode
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
          Enter your wildly optimistic (or realistic?) price projections
        </div>

        {/* Years selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8 }}>
            Time Horizon
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {["2", "3", "4", "5"].map((y) => (
              <button key={y} onClick={() => setYears(y)} style={{
                flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer", transition: "all 0.2s ease",
                background: years === y ? "rgba(0,227,158,0.15)" : "rgba(255,255,255,0.04)",
                border: years === y ? "1px solid rgba(0,227,158,0.3)" : "1px solid rgba(255,255,255,0.06)",
                color: years === y ? "#00E39E" : "rgba(255,255,255,0.5)",
                fontSize: 13, fontWeight: years === y ? 600 : 400,
              }}>
                {y} years
              </button>
            ))}
          </div>
        </div>

        {/* Price increase inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "BTC", value: btcIncrease, setter: setBtcIncrease, color: "#F7931A" },
            { label: "ETH", value: ethIncrease, setter: setEthIncrease, color: "#627EEA" },
            { label: "SOL", value: solIncrease, setter: setSolIncrease, color: "#00FFA3" },
          ].map((asset) => (
            <div key={asset.label}>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
                {asset.label} % Increase
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  value={asset.value}
                  onChange={(e) => asset.setter(e.target.value)}
                  placeholder="0"
                  style={{
                    width: "100%", padding: "12px 32px 12px 12px", background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${asset.value ? asset.color + "40" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
                    outline: "none", transition: "all 0.2s ease",
                  }}
                />
                <span style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace",
                }}>
                  %
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Reason input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
            Why Will This Happen? 🤔
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Trump re-elected, ETF approval, hyperbitcoinization..."
            style={{
              width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff",
              fontSize: 13, outline: "none",
            }}
          />
        </div>

        {/* Calculate button */}
        <button onClick={calculateProjections} disabled={loading} style={{
          width: "100%", padding: "14px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #00E39E, #00B87C)",
          color: "#0A0B0E", fontSize: 14, fontWeight: 700, transition: "all 0.2s ease",
          opacity: loading ? 0.6 : 1,
        }}
        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          {loading ? "🔮 Consulting the Oracle..." : "🚀 Show Me the Money!"}
        </button>
      </div>

      {/* Results */}
      {showResults && (
        <div>
          {/* Reason banner */}
          <div style={{
            background: "rgba(0,227,158,0.08)", border: "1px solid rgba(0,227,158,0.2)",
            borderRadius: 12, padding: 20, marginBottom: 24, textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
              The Catalyst
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#00E39E", marginBottom: 4 }}>
              "{reason}"
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              {years}-year projection · Because obviously this will happen 📈
            </div>
          </div>

          {/* Celebration Animation - No external resources! */}
          <div style={{
            marginBottom: 24, borderRadius: 12, overflow: "hidden",
            border: "3px solid rgba(0,227,158,0.4)", background: "linear-gradient(135deg, #0A0B0E 0%, #1a1b1f 100%)",
            boxShadow: "0 8px 32px rgba(0,227,158,0.2)",
            minHeight: 300,
            position: "relative",
          }}>
            <style>{`
              @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(5deg); }
              }
              @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 20px currentColor, 0 0 40px currentColor; }
                50% { box-shadow: 0 0 40px currentColor, 0 0 80px currentColor; }
              }
              @keyframes sparkle {
                0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
                50% { opacity: 1; transform: scale(1) rotate(180deg); }
              }
              @keyframes slide-up {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
            
            {giphyUrl ? (() => {
              const celebration = JSON.parse(giphyUrl);
              return (
                <div style={{
                  padding: 40, textAlign: "center", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", minHeight: 300,
                  position: "relative",
                }}>
                  {/* Sparkles background */}
                  {[...Array(8)].map((_, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      top: `${20 + (i * 10)}%`,
                      left: `${10 + (i * 11)}%`,
                      fontSize: 20,
                      animation: `sparkle ${1.5 + (i * 0.2)}s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`,
                    }}>
                      ✨
                    </div>
                  ))}
                  
                  {/* GIF or fallback emoji */}
                  {celebration.gif ? (
                    <div style={{
                      marginBottom: 20, borderRadius: 12, overflow: "hidden",
                      boxShadow: `0 0 30px ${celebration.color}40`,
                      animation: "slide-up 0.5s ease-out",
                      border: `2px solid ${celebration.color}40`,
                    }}>
                      <img 
                        src={celebration.gif} 
                        alt="celebration" 
                        style={{ maxHeight: 200, maxWidth: 300, display: "block" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: 120, 
                      marginBottom: 20,
                      animation: "float 2s ease-in-out infinite",
                      filter: "drop-shadow(0 10px 30px rgba(0,227,158,0.3))",
                    }}>
                      {celebration.emoji || "🚀"}
                    </div>
                  )}
                  
                  {/* Text */}
                  <div style={{ 
                    fontSize: 28, 
                    color: celebration.color, 
                    fontWeight: 900, 
                    marginBottom: 12,
                    textShadow: `0 0 20px ${celebration.color}, 0 0 40px ${celebration.color}`,
                    animation: "slide-up 0.5s ease-out",
                    letterSpacing: 2,
                  }}>
                    {celebration.text}
                  </div>
                  
                  {/* Sub text */}
                  <div style={{ 
                    fontSize: 14, 
                    color: "rgba(255,255,255,0.6)", 
                    fontWeight: 600,
                    animation: "slide-up 0.7s ease-out",
                  }}>
                    Your projection has been saved! 🎉
                  </div>
                  
                  {celebration.gif && (
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.1)", marginTop: 8 }}>Powered by GIPHY</div>
                  )}
                </div>
              );
            })() : (
              <div style={{
                padding: 40, textAlign: "center", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", minHeight: 300,
              }}>
                <div style={{ fontSize: 64, marginBottom: 12 }}>🚀</div>
                <div style={{ fontSize: 14, color: "#00E39E", fontWeight: 600, marginBottom: 4 }}>
                  To the moon!
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  (Loading celebration...)
                </div>
              </div>
            )}
          </div>

          {/* Price projections */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            {assets.filter(a => a.projected).map((asset) => {
              const gain = asset.projected - asset.current;
              const mult = asset.projected / asset.current;

              return (
                <div key={asset.id} style={{
                  background: `${asset.color}08`, border: `1px solid ${asset.color}20`,
                  borderRadius: 12, padding: 20,
                }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                    {asset.name}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                    Current: ${asset.current.toLocaleString()}
                  </div>
                  
                  <div style={{ fontSize: 24, fontWeight: 700, color: asset.color, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
                    ${asset.projected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  
                  <div style={{ fontSize: 11, color: "#00E39E", marginBottom: 8 }}>
                    +{asset.increase}% ({mult.toFixed(1)}x)
                  </div>
                  
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    Gain: ${gain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Portfolio calculator */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 16 }}>
              💰 If You Invested $10,000 Today...
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {assets.filter(a => a.projected).map((asset) => {
                const futureValue = 10000 * (asset.projected / asset.current);
                const profit = futureValue - 10000;

                return (
                  <div key={asset.id} style={{
                    background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 16,
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                      $10k in {asset.name}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: asset.color, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                      ${futureValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: 10, color: "#00E39E" }}>
                      Profit: ${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{
            marginTop: 20, padding: 16, background: "rgba(255,255,255,0.02)",
            borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, textAlign: "center" }}>
              ⚠️ This is for entertainment purposes only. Past performance doesn't guarantee future results.
              Markets can go down too (see the Market Freakout tab for proof). DYOR. NFA. WAGMI? 🚀
            </div>
          </div>
        </div>
      )}

      {/* Projection Log */}
      {projectionLog.length > 0 && (
        <div style={{
          marginTop: 32, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>📊 Company-Wide Projections Log</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                Last {projectionLog.length} projection{projectionLog.length > 1 ? 's' : ''} · Shared across your team
              </div>
            </div>
            <button onClick={async () => { 
              setProjectionLog([]);
              await window.storage.delete('allium-projection-log', true);
              console.log("Cleared shared projection log");
            }} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)",
              fontSize: 10, cursor: "pointer", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,77,106,0.1)"; e.currentTarget.style.color = "#FF4D6A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >
              Clear Log
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projectionLog.map((log, i) => (
              <div key={i} style={{
                padding: "12px 16px", background: i === 0 ? "rgba(0,227,158,0.04)" : "rgba(255,255,255,0.02)",
                border: i === 0 ? "1px solid rgba(0,227,158,0.15)" : "1px solid rgba(255,255,255,0.04)",
                borderRadius: 8, transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = i === 0 ? "rgba(0,227,158,0.04)" : "rgba(255,255,255,0.02)"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 4 }}>
                      "{log.reason}"
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                      {log.timestamp} · {log.years}-year projection
                    </div>
                  </div>
                  {i === 0 && (
                    <span style={{ fontSize: 9, color: "#00E39E", background: "rgba(0,227,158,0.15)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                      LATEST
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  {log.btc !== "N/A" && (
                    <div style={{ fontSize: 11, color: "#F7931A", fontFamily: "'JetBrains Mono', monospace" }}>
                      BTC: +{log.btc}%
                    </div>
                  )}
                  {log.eth !== "N/A" && (
                    <div style={{ fontSize: 11, color: "#627EEA", fontFamily: "'JetBrains Mono', monospace" }}>
                      ETH: +{log.eth}%
                    </div>
                  )}
                  {log.sol !== "N/A" && (
                    <div style={{ fontSize: 11, color: "#00FFA3", fontFamily: "'JetBrains Mono', monospace" }}>
                      SOL: +{log.sol}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// === WALLET LOOKUP (uses Claude API → Allium MCP) ===
function WalletLookup() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [transactions, setTransactions] = useState(null);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Demo data from Vitalik's wallet (pre-loaded from our earlier query)
  const DEMO_TXS = [
    { hash: "0xba2b8b31...3be9eb", block_timestamp: "2026-02-05T16:31:47", from_address: "0x74c10e4bbe847d68ce02a9abb4bab8dbedfd4675", to_address: "0xd714a9c3836edd56198576ebfbc8d23ea3cb405e", labels: ["transfer"], asset_transfers: [{ transfer_type: "received", asset: { type: "evm_erc20", symbol: "CTO", name: "Ethereum CTO", decimals: 9 }, amount: { amount_str: "1000000", amount: 1000000 } }] },
    { hash: "0x5b0d81ba...1b898", block_timestamp: "2026-02-05T13:43:47", from_address: "0xf8fc9a91349ebd2033d53f2b97245102f00aba96", to_address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", labels: ["transfer"], asset_transfers: [{ transfer_type: "received", asset: { type: "native", symbol: "ETH", name: "Ether", decimals: 18 }, amount: { amount_str: "0.000505", amount: 0.000505 } }] },
    { hash: "0x92434a46...1b383d", block_timestamp: "2026-02-05T09:43:23", from_address: "0xb063b093f7cd53165b4e7d32ff85803ae0572ea9", to_address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", labels: ["transfer"], asset_transfers: [{ transfer_type: "received", asset: { type: "native", symbol: "ETH", name: "Ether", decimals: 18 }, amount: { amount_str: "0.000000001", amount: 1e-9 } }] },
    { hash: "0x67852cbf...c4bbb0", block_timestamp: "2026-02-05T09:42:47", from_address: "0xb06896fbc28370a70b86bda84db0931f09f99ea9", to_address: "0x761d38e5ddf6ccf6cf7c55759d5210750b5d60f3", labels: ["transfer"], asset_transfers: [{ transfer_type: "received", asset: { type: "evm_erc20", symbol: "ELON", name: "Dogelon", decimals: 18 }, amount: { amount_str: "0.0000666", amount: 0.0000666 } }] },
    { hash: "0xd5efd7dc...7d69c", block_timestamp: "2026-02-05T09:40:35", from_address: "0xf250259b35bda8c3e1b3f0b46ce4cd9b503c865b", to_address: "0x761d38e5ddf6ccf6cf7c55759d5210750b5d60f3", labels: ["transfer"], asset_transfers: [{ transfer_type: "received", asset: { type: "evm_erc20", symbol: "ELON", name: "Dogelon", decimals: 18 }, amount: { amount_str: "0.0000666", amount: 0.0000666 } }] },
  ];

  const fetchWallet = useCallback(async (addr, ch) => {
    if (!addr || addr.length < 10) return;
    setLoading(true);
    setError(null);
    setTransactions(null);
    setBalances(null);

    try {
      // Fetch transactions and balances in parallel via Allium REST API
      const [txRes, balRes] = await Promise.all([
        fetch(`${ALLIUM_BASE}/api/v1/developer/wallet/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": ALLIUM_API_KEY },
          body: JSON.stringify({ addresses: [{ address: addr, chain: ch }], limit: 10 }),
        }),
        fetch(`${ALLIUM_BASE}/api/v1/developer/wallet/balances`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": ALLIUM_API_KEY },
          body: JSON.stringify({ address: addr, chain: ch }),
        }),
      ]);

      if (txRes.ok) {
        const txData = await txRes.json();
        const items = txData?.items || txData || [];
        if (items.length > 0) setTransactions(items);
      }

      if (balRes.ok) {
        const balData = await balRes.json();
        const items = balData?.items || balData || [];
        if (items.length > 0) setBalances(items.filter(b => b.amount > 0).sort((a, b) => (b.usd_value || 0) - (a.usd_value || 0)).slice(0, 10));
      }

      if (!txRes.ok && !balRes.ok) {
        // Fallback: show demo data when API is blocked (e.g. artifact sandbox)
        setTransactions(DEMO_TXS);
        setError("Using demo data (Allium API not reachable from this environment — works on Vercel)");
      }
    } catch (err) {
      // Network error = likely blocked sandbox, show demo data
      setTransactions(DEMO_TXS);
      setError("Using demo data (Allium API not reachable — works on Vercel)");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLookup = () => fetchWallet(address, chain);

  const displayTxs = transactions || DEMO_TXS;
  const isDemo = !transactions;

  return (
    <div>
      {/* Search bar */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          🔍 Wallet Lookup
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["ethereum", "solana"].map((c) => (
            <button key={c} onClick={() => setChain(c)} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", transition: "all 0.15s ease",
              background: chain === c ? (c === "ethereum" ? "rgba(98,126,234,0.2)" : "rgba(0,255,163,0.2)") : "rgba(255,255,255,0.04)",
              border: chain === c ? `1px solid ${c === "ethereum" ? "#627EEA" : "#00FFA3"}40` : "1px solid rgba(255,255,255,0.06)",
              color: chain === c ? "#fff" : "rgba(255,255,255,0.4)",
            }}>
              {c === "ethereum" ? "Ethereum" : "Solana"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste any wallet address..."
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            style={{
              flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff",
              fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none",
            }}
          />
          <button onClick={handleLookup} disabled={loading || address.length < 10} style={{
            padding: "12px 24px", borderRadius: 8, border: "none", cursor: address.length >= 10 ? "pointer" : "default",
            background: address.length >= 10 ? "#00E39E" : "rgba(255,255,255,0.06)",
            color: address.length >= 10 ? "#0A0B0E" : "rgba(255,255,255,0.3)",
            fontWeight: 600, fontSize: 13, transition: "all 0.2s ease",
          }}>
            {loading ? "..." : "Lookup"}
          </button>
        </div>

        {/* Example wallets */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", alignSelf: "center" }}>Try:</span>
          {EXAMPLE_WALLETS.map((w) => (
            <button key={w.address} onClick={() => { setAddress(w.address); setChain(w.chain); }} style={{
              padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)",
              fontSize: 10, cursor: "pointer", transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: error.includes("demo") ? "rgba(255,167,38,0.06)" : "rgba(255,77,106,0.06)", border: `1px solid ${error.includes("demo") ? "rgba(255,167,38,0.15)" : "rgba(255,77,106,0.15)"}`, borderRadius: 10, padding: "14px 20px", marginBottom: 16, fontSize: 12, color: error.includes("demo") ? "#FFA726" : "#FF4D6A" }}>
          {error.includes("demo") ? "⚠️ " : ""}{error}
        </div>
      )}

      {loading && <Spinner />}

      {/* Balances */}
      {!loading && balances && balances.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Token Balances</span>
            <span style={{ fontSize: 10, color: "#00E39E", marginLeft: 8 }}>✅ Live from Allium</span>
          </div>
          {balances.map((b, i) => {
            const token = b.token || b;
            const symbol = token.symbol || token.asset_symbol || "???";
            const name = token.name || token.asset_name || "";
            const amount = b.amount || b.balance || 0;
            const usd = b.usd_value || b.amount_usd || 0;
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{symbol}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 6 }}>{name}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>
                    {typeof amount === "number" ? (amount < 0.001 ? amount.toExponential(2) : amount.toLocaleString(undefined, { maximumFractionDigits: 4 })) : amount}
                  </div>
                  {usd > 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction feed */}
      {!loading && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Recent Transactions</span>
              {isDemo && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 8, padding: "2px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 4 }}>
                  Demo: vitalik.eth
                </span>
              )}
            </div>
            {!isDemo && <span style={{ fontSize: 10, color: "#00E39E" }}>{shortenAddr(address)}</span>}
          </div>

          {typeof displayTxs === "string" ? (
            <pre style={{ padding: 20, fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>
              {displayTxs}
            </pre>
          ) : Array.isArray(displayTxs) ? (
            displayTxs.map((tx, i) => <TxRow key={tx.hash || i} tx={tx} index={i} />)
          ) : null}
        </div>
      )}
    </div>
  );
}

// === WHALE FEED - Live $1M+ trades ===
const WHALE_CHAINS = [
  { id: "all", name: "All Chains", color: "#00E39E" },
  { id: "bitcoin", name: "BTC", color: "#F7931A", icon: "\u20BF" },
  { id: "ethereum", name: "ETH", color: "#627EEA", icon: "\u039E" },
  { id: "solana", name: "SOL", color: "#00FFA3", icon: "\u25CE" },
];

const WHALE_LABELS = [
  "Unknown Whale", "Institutional", "DEX Aggregator", "Market Maker", "CEX Hot Wallet",
  "Whale Alert", "Smart Money", "MEV Bot", "OTC Desk", "Fund",
];

function generateWhaleTrade(chain) {
  const chains = chain === "all" 
    ? ["bitcoin", "ethereum", "solana"] 
    : [chain];
  const ch = chains[Math.floor(Math.random() * chains.length)];
  const meta = WHALE_CHAINS.find(c => c.id === ch);
  
  const amounts = {
    bitcoin: () => {
      const btc = (Math.random() * 200 + 10).toFixed(4);
      const usd = (parseFloat(btc) * PRICE_DATA.bitcoin.price);
      return { amount: btc, symbol: "BTC", usd };
    },
    ethereum: () => {
      const eth = (Math.random() * 5000 + 500).toFixed(2);
      const usd = (parseFloat(eth) * PRICE_DATA.ethereum.price);
      return { amount: eth, symbol: "ETH", usd };
    },
    solana: () => {
      const sol = (Math.random() * 50000 + 12000).toFixed(0);
      const usd = (parseFloat(sol) * PRICE_DATA.solana.price);
      return { amount: sol, symbol: "SOL", usd };
    },
  };
  
  let trade = amounts[ch]();
  // Ensure > $1M
  while (trade.usd < 1000000) {
    trade = amounts[ch]();
  }
  
  const types = ["Transfer", "Swap", "Bridge", "Deposit", "Withdrawal"];
  const type = types[Math.floor(Math.random() * types.length)];
  const fromAddr = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const toAddr = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const hash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  
  return {
    id: Date.now() + Math.random(),
    chain: ch,
    chainColor: meta.color,
    chainIcon: meta.icon,
    chainName: meta.name,
    type,
    amount: trade.amount,
    symbol: trade.symbol,
    usd: trade.usd,
    from: fromAddr,
    to: toAddr,
    hash,
    label: Math.random() > 0.4 ? WHALE_LABELS[Math.floor(Math.random() * WHALE_LABELS.length)] : null,
    timestamp: new Date(),
    isNew: true,
  };
}

function WhaleFeed() {
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState("all");
  const [paused, setPaused] = useState(false);
  const [totalVolume, setTotalVolume] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState("loading");
  const [lastRefresh, setLastRefresh] = useState(null);

  // Fetch real whale data from Allium Explorer
  const fetchWhaleData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callClaude({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `Query the Allium database for the largest token transfers in the last 6 hours across ethereum, solana, and bitcoin chains where USD value >= $1,000,000. Include ETH, WETH, SOL, WSOL, BTC, WBTC, USDC, USDT, DAI tokens. Also try to get entity names/labels for the from and to addresses using the common.identity.address_names table. Return ONLY a JSON array of objects with fields: chain, token_symbol, amount, usd_amount, from_address, to_address, from_name (entity name or null), to_name (entity name or null), transaction_hash, block_timestamp. Order by block_timestamp DESC, limit 40. Deduplicate by transaction_hash (keep highest usd_amount per hash). Return only valid JSON array, nothing else.`
          }],
          mcp_servers: [{ type: "url", url: "https://mcp-oauth.allium.so", name: "allium" }]
      });
      
      // Parse results from MCP tool results or text
      const toolResults = data.content?.filter(c => c.type === "mcp_tool_result").map(c => c.content?.[0]?.text).filter(Boolean);
      const textResults = data.content?.filter(c => c.type === "text").map(c => c.text).join("\n");
      
      let parsed = null;
      for (const result of [...(toolResults || []), textResults]) {
        if (!result) continue;
        try {
          const clean = result.replace(/```json\n?|```/g, "").trim();
          // Try to find a JSON array in the text
          const arrMatch = clean.match(/\[[\s\S]*\]/);
          if (arrMatch) {
            parsed = JSON.parse(arrMatch[0]);
            break;
          }
        } catch (e) { /* continue */ }
      }
      
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        // Deduplicate by tx hash, keeping highest USD
        const seen = {};
        const deduped = [];
        for (const t of parsed) {
          const key = t.transaction_hash;
          if (!seen[key] || t.usd_amount > seen[key]) {
            seen[key] = t.usd_amount;
            deduped.push({
              ...t,
              id: key + Math.random(),
              chainColor: CHAIN_COLORS[t.chain] || "#888",
              isNew: false,
              timestamp: t.block_timestamp,
            });
          }
        }
        setTrades(deduped.slice(0, 30));
        setTotalVolume(deduped.reduce((s, t) => s + (t.usd_amount || 0), 0));
        setTradeCount(deduped.length);
        setDataSource("allium");
        setLastRefresh(new Date());
        setLoading(false);
        return;
      }
    } catch (e) {
      console.log("Whale fetch error:", e);
    }
    
    // Fallback: generate simulated data
    const simulated = Array.from({ length: 15 }, () => generateWhaleTrade(filter));
    simulated.forEach(t => t.isNew = false);
    setTrades(simulated);
    setTotalVolume(simulated.reduce((s, t) => s + t.usd, 0));
    setTradeCount(simulated.length);
    setDataSource("simulated");
    setLastRefresh(new Date());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchWhaleData();
    // Refresh real data every 60s
    const iv = setInterval(fetchWhaleData, 60000);
    return () => clearInterval(iv);
  }, []);

  // For simulated mode, add new trades periodically
  useEffect(() => {
    if (paused || dataSource === "allium") return;
    const iv = setInterval(() => {
      const newTrade = generateWhaleTrade(filter);
      setTrades(prev => [newTrade, ...prev].slice(0, 50));
      setTotalVolume(prev => prev + newTrade.usd);
      setTradeCount(prev => prev + 1);
      setTimeout(() => {
        setTrades(prev => prev.map(t => t.id === newTrade.id ? { ...t, isNew: false } : t));
      }, 1500);
    }, 3000 + Math.random() * 3000);
    return () => clearInterval(iv);
  }, [filter, paused, dataSource]);

  const filteredTrades = filter === "all" ? trades : trades.filter(t => t.chain === filter);
  const getUsd = (t) => t.usd_amount || t.usd || 0;

  return (
    <div>
      <style>{`
        @keyframes whale-slide-in {
          from { transform: translateX(-20px); opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; margin-bottom: 0; }
          to { transform: translateX(0); opacity: 1; max-height: 120px; padding-top: 14px; padding-bottom: 14px; margin-bottom: 8px; }
        }
        @keyframes whale-flash {
          0% { background: rgba(0,227,158,0.15); }
          100% { background: rgba(255,255,255,0.02); }
        }
        @keyframes amount-glow {
          0% { text-shadow: 0 0 12px currentColor; }
          100% { text-shadow: none; }
        }
      `}</style>

      {/* Header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Whale Trades</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{tradeCount}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Total Volume</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#00E39E", fontFamily: "'JetBrains Mono', monospace" }}>
            ${totalVolume >= 1e9 ? (totalVolume / 1e9).toFixed(2) + "B" : (totalVolume / 1e6).toFixed(1) + "M"}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Avg Trade Size</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#627EEA", fontFamily: "'JetBrains Mono', monospace" }}>
            ${tradeCount > 0 ? ((totalVolume / tradeCount) / 1e6).toFixed(1) + "M" : "0"}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {WHALE_CHAINS.map((c) => (
            <button key={c.id} onClick={() => setFilter(c.id)} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", transition: "all 0.15s ease",
              background: filter === c.id ? `${c.color}20` : "rgba(255,255,255,0.04)",
              border: filter === c.id ? `1px solid ${c.color}40` : "1px solid rgba(255,255,255,0.06)",
              color: filter === c.id ? c.color : "rgba(255,255,255,0.4)",
              fontWeight: filter === c.id ? 600 : 400,
            }}>
              {c.icon ? `${c.icon} ` : ""}{c.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dataSource === "allium" && (
            <button onClick={fetchWhaleData} style={{
              padding: "6px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer",
              background: "rgba(0,227,158,0.1)", border: "1px solid rgba(0,227,158,0.2)", color: "#00E39E",
            }}>
              {loading ? "\u23F3" : "\uD83D\uDD04"} Refresh
            </button>
          )}
          {dataSource !== "allium" && (
            <button onClick={() => setPaused(!paused)} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer",
              background: paused ? "rgba(255,77,106,0.15)" : "rgba(0,227,158,0.15)",
              border: paused ? "1px solid rgba(255,77,106,0.3)" : "1px solid rgba(0,227,158,0.3)",
              color: paused ? "#FF4D6A" : "#00E39E", fontWeight: 600,
            }}>
              {paused ? "\u23F8 Paused" : "\u25CF Live"}
            </button>
          )}
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1 }}>
            $1M+ only
          </span>
        </div>
      </div>

      {loading && trades.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spinner />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 12 }}>Querying Allium for whale transfers...</div>
        </div>
      ) : (
        /* Trade feed */
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "70px 1fr 140px 120px 90px",
            gap: 8, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            {["Chain", "Details", "Amount", "USD Value", "Time"].map(h => (
              <span key={h} style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>{h}</span>
            ))}
          </div>

          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {filteredTrades.map((trade) => {
              const usdVal = getUsd(trade);
              const sizeClass = usdVal >= 100000000 ? "mega" : usdVal >= 10000000 ? "large" : "normal";
              const sym = trade.token_symbol || trade.symbol || "?";
              const chainColor = trade.chainColor || CHAIN_COLORS[trade.chain] || "#888";
              const fromLabel = trade.from_name || trade.label || null;
              const toLabel = trade.to_name || null;
              
              return (
                <div key={trade.id || trade.transaction_hash} style={{
                  display: "grid", gridTemplateColumns: "70px 1fr 140px 120px 90px",
                  gap: 8, padding: "14px 16px", alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  animation: trade.isNew ? "whale-slide-in 0.4s ease-out, whale-flash 1.5s ease-out" : "none",
                  background: sizeClass === "mega" ? "rgba(255,77,106,0.04)" : "transparent",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.background = sizeClass === "mega" ? "rgba(255,77,106,0.04)" : "transparent"}
                >
                  {/* Chain */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: `${chainColor}20`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: chainColor,
                    }}>
                      {sym.slice(0, 2)}
                    </div>
                    <span style={{ fontSize: 10, color: chainColor, fontWeight: 600 }}>{sym}</span>
                  </div>

                  {/* Details */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                      {fromLabel && (
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 600,
                          background: "rgba(98,126,234,0.15)", color: "#627EEA",
                        }}>{fromLabel}</span>
                      )}
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{"\u2192"}</span>
                      {toLabel && (
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 600,
                          background: "rgba(0,227,158,0.15)", color: "#00E39E",
                        }}>{toLabel}</span>
                      )}
                      {sizeClass === "mega" && (
                        <span style={{ fontSize: 9, color: "#FF4D6A", fontWeight: 700 }}>{"\uD83D\uDCA5"} MEGA</span>
                      )}
                      {sizeClass === "large" && (
                        <span style={{ fontSize: 9, color: "#FFA726", fontWeight: 700 }}>{"\uD83D\uDD25"} BIG</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {shortenAddr(trade.from_address || trade.from)} {"\u2192"} {shortenAddr(trade.to_address || trade.to)}
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{
                    fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: chainColor,
                    animation: trade.isNew ? "amount-glow 1s ease-out" : "none",
                  }}>
                    {parseFloat(trade.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {sym}
                  </div>

                  {/* USD Value */}
                  <div style={{
                    fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: sizeClass === "mega" ? "#FF4D6A" : sizeClass === "large" ? "#FFA726" : "#fff",
                  }}>
                    ${usdVal >= 1e9 ? (usdVal / 1e9).toFixed(2) + "B" : (usdVal / 1e6).toFixed(1) + "M"}
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {timeAgo(trade.timestamp || trade.block_timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data source note */}
      <div style={{
        marginTop: 16, padding: 14, background: "rgba(255,255,255,0.02)",
        borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
          {"\uD83D\uDC33"} Showing transfers {"\u2265"} $1M USD · crosschain.assets.transfers + common.identity.address_names
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastRefresh && (
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace" }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <span style={{ fontSize: 10, color: dataSource === "allium" ? "#00E39E" : "rgba(255,255,255,0.2)" }}>
            {dataSource === "allium" ? "\u2705 Real Allium Data" : dataSource === "loading" ? "\u23F3 Loading..." : "\u26A1 Simulated"}
          </span>
        </div>
      </div>
    </div>
  );
}

// === ASK ALLIUM - AI Chat Box ===
function AskAllium() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const EXAMPLE_QUESTIONS = [
    "What are the top 5 DEXes by volume today?",
    "Show me the biggest ETH transfer in the last hour",
    "Which chain has the most active users right now?",
    "What's the total stablecoin volume across all chains today?",
    "How much TVL does Ethereum have?",
  ];

  const askQuestion = useCallback(async (q) => {
    if (!q.trim() || loading) return;
    const userMsg = { role: "user", text: q, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setLoading(true);
    
    try {
      const data = await callClaude({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: `You are an AI assistant connected to Allium's blockchain data platform via MCP. You have access to 130+ blockchains of data. When answering questions, query the Allium database using the MCP tools available to you. Key tables include:
- crosschain.metrics.overview (chain activity, TVL, DEX volume, addresses, fees)
- crosschain.metrics.dex_overview (DEX-specific metrics by project)
- crosschain.assets.transfers (token transfers with USD values)
- common.identity.address_names (entity labels for addresses)
- crosschain.metrics.stablecoin_volume (stablecoin transfer volumes)

Always provide specific numbers and data. Format large numbers readably (e.g. $1.2B, 394M txns). Be concise but data-rich. If you run a query, summarize the key findings clearly.`,
          messages: [{ role: "user", content: q }],
          mcp_servers: [{ type: "url", url: "https://mcp-oauth.allium.so", name: "allium" }]
      });
      
      // Collect all text responses
      const textParts = data.content?.filter(c => c.type === "text").map(c => c.text) || [];
      const toolResults = data.content?.filter(c => c.type === "mcp_tool_result").map(c => {
        try { return c.content?.[0]?.text || ""; } catch { return ""; }
      }).filter(Boolean) || [];
      
      const fullResponse = textParts.join("\n") || "No response received.";
      const hasData = toolResults.length > 0;
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        text: fullResponse, 
        time: new Date(),
        hasData,
        toolCount: (data.content?.filter(c => c.type === "mcp_tool_use") || []).length,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", text: "Error connecting to Allium. Please try again.", time: new Date() }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #00E39E, #627EEA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>AI</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Ask Allium</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Query 130+ blockchains in plain English · Powered by Claude + Allium MCP</div>
          </div>
        </div>
        
        {/* Messages */}
        <div style={{ padding: "12px 20px", minHeight: 80, maxHeight: 400, overflowY: "auto" }}>
          {messages.length === 0 && !loading && (
            <div style={{ padding: "20px 0" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Try asking:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => askQuestion(q)} style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)", transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,227,158,0.1)"; e.currentTarget.style.color = "#00E39E"; e.currentTarget.style.borderColor = "rgba(0,227,158,0.3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >{q}</button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "85%", padding: "10px 14px", borderRadius: 10,
                background: msg.role === "user" ? "rgba(0,227,158,0.12)" : "rgba(255,255,255,0.04)",
                border: msg.role === "user" ? "1px solid rgba(0,227,158,0.2)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                {msg.role === "assistant" && msg.hasData && (
                  <div style={{ fontSize: 9, color: "#00E39E", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00E39E", display: "inline-block" }} />
                    Queried Allium ({msg.toolCount} tool call{msg.toolCount !== 1 ? "s" : ""})
                  </div>
                )}
                <div style={{
                  fontSize: 12, color: msg.role === "user" ? "#00E39E" : "rgba(255,255,255,0.8)",
                  lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.text}
                </div>
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", marginTop: 3, padding: "0 4px" }}>
                {msg.time.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <Spinner />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Querying Allium...</span>
            </div>
          )}
        </div>
        
        {/* Input */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askQuestion(query)}
            placeholder="Ask anything about on-chain data..."
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 12,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", outline: "none", fontFamily: "inherit",
            }}
          />
          <button onClick={() => askQuestion(query)} disabled={loading || !query.trim()} style={{
            padding: "10px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: query.trim() ? "rgba(0,227,158,0.2)" : "rgba(255,255,255,0.04)",
            border: query.trim() ? "1px solid rgba(0,227,158,0.3)" : "1px solid rgba(255,255,255,0.06)",
            color: query.trim() ? "#00E39E" : "rgba(255,255,255,0.2)",
            transition: "all 0.2s ease",
          }}>
            Ask {"\u2192"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === CHAIN COVERAGE EXPLORER - Sales Tool ===
const CHAIN_DATA = [
  { name: "Ethereum", id: "ethereum", tables: 101, ecosystem: "EVM", tier: "L1", schemas: ["raw", "assets", "dex", "lending", "nfts", "ens", "yields", "decoded", "liquid_staking", "metrics", "bridges", "prices"], color: "#627EEA" },
  { name: "Polygon", id: "polygon", tables: 92, ecosystem: "EVM", tier: "L2", schemas: ["raw", "assets", "dex", "lending", "nfts", "decoded", "metrics", "bridges"], color: "#8247E5" },
  { name: "Solana", id: "solana", tables: 82, ecosystem: "SVM", tier: "L1", schemas: ["raw", "assets", "dex", "lending", "nfts", "decoded", "defi", "staking", "predictions", "prices", "bridges", "metrics"], color: "#00FFA3" },
  { name: "Base", id: "base", tables: 79, ecosystem: "EVM", tier: "L2", schemas: ["raw", "assets", "dex", "lending", "nfts", "decoded", "metrics", "bridges"], color: "#0052FF" },
  { name: "Arbitrum", id: "arbitrum", tables: 73, ecosystem: "EVM", tier: "L2", schemas: ["raw", "assets", "dex", "lending", "nfts", "decoded", "metrics", "bridges"], color: "#28A0F0" },
  { name: "Avalanche", id: "avalanche", tables: 68, ecosystem: "EVM", tier: "L1", schemas: ["raw", "assets", "dex", "lending", "nfts", "decoded", "metrics"], color: "#E84142" },
  { name: "BSC", id: "bsc", tables: 61, ecosystem: "EVM", tier: "L1", schemas: ["raw", "assets", "dex", "lending", "nfts", "decoded", "metrics"], color: "#F0B90B" },
  { name: "Monad", id: "monad", tables: 59, ecosystem: "EVM", tier: "L1", schemas: ["raw", "assets", "dex", "decoded", "metrics"], color: "#836EF9" },
  { name: "Optimism", id: "optimism", tables: 55, ecosystem: "EVM", tier: "L2", schemas: ["raw", "assets", "dex", "lending", "nfts", "decoded", "metrics"], color: "#FF0420" },
  { name: "Linea", id: "linea", tables: 49, ecosystem: "EVM", tier: "L2", schemas: ["raw", "assets", "dex", "decoded", "metrics"], color: "#61DFFF" },
  { name: "Scroll", id: "scroll", tables: 47, ecosystem: "EVM", tier: "L2", schemas: ["raw", "assets", "dex", "decoded", "metrics"], color: "#FFEEDA" },
  { name: "zkSync", id: "zksync", tables: 35, ecosystem: "EVM", tier: "L2", schemas: ["raw", "assets", "dex", "decoded"], color: "#8B8DFC" },
  { name: "Berachain", id: "berachain", tables: 36, ecosystem: "EVM", tier: "L1", schemas: ["raw", "assets", "dex", "decoded"], color: "#784421" },
  { name: "Tron", id: "tron", tables: 29, ecosystem: "TVM", tier: "L1", schemas: ["raw", "assets", "dex", "decoded"], color: "#FF0013" },
  { name: "Sui", id: "sui", tables: 27, ecosystem: "Move", tier: "L1", schemas: ["raw", "assets", "dex", "decoded"], color: "#6FBCF0" },
  { name: "Near", id: "near", tables: 26, ecosystem: "NEAR", tier: "L1", schemas: ["raw", "assets", "dex"], color: "#00C08B" },
  { name: "Hyperliquid", id: "hyperliquid", tables: 23, ecosystem: "Custom", tier: "L1", schemas: ["raw", "dex", "metrics"], color: "#00FF88" },
  { name: "Sei", id: "sei", tables: 20, ecosystem: "Cosmos", tier: "L1", schemas: ["raw", "assets", "dex"], color: "#9E1F63" },
  { name: "Bitcoin", id: "bitcoin", tables: 19, ecosystem: "UTXO", tier: "L1", schemas: ["raw", "assets", "nfts", "metrics"], color: "#F7931A" },
  { name: "Aptos", id: "aptos", tables: 15, ecosystem: "Move", tier: "L1", schemas: ["raw", "assets", "dex"], color: "#2DD8A3" },
  { name: "Stellar", id: "stellar", tables: 17, ecosystem: "Stellar", tier: "L1", schemas: ["raw", "assets"], color: "#7C66DC" },
  { name: "TON", id: "ton", tables: 11, ecosystem: "TON", tier: "L1", schemas: ["raw", "assets"], color: "#0098EA" },
  { name: "Cosmos", id: "cosmos", tables: 10, ecosystem: "Cosmos", tier: "L1", schemas: ["raw", "assets"], color: "#2E3148" },
  { name: "Hedera", id: "hedera", tables: 10, ecosystem: "Hashgraph", tier: "L1", schemas: ["raw", "assets"], color: "#222222" },
  { name: "Cardano", id: "cardano", tables: 5, ecosystem: "UTXO", tier: "L1", schemas: ["raw", "assets"], color: "#0033AD" },
  { name: "Dogecoin", id: "dogecoin", tables: 5, ecosystem: "UTXO", tier: "L1", schemas: ["raw", "assets"], color: "#C2A633" },
  { name: "Starknet", id: "starknet", tables: 5, ecosystem: "Cairo", tier: "L2", schemas: ["raw", "assets"], color: "#EC796B" },
  { name: "XRP Ledger", id: "xrp_ledger", tables: 4, ecosystem: "XRP", tier: "L1", schemas: ["raw", "assets"], color: "#23292F" },
];

const SCHEMA_INFO = {
  raw: { label: "Raw Data", icon: "📦", desc: "Blocks, transactions, logs, traces", color: "#627EEA" },
  assets: { label: "Token Transfers", icon: "💸", desc: "ERC20, native, fungible transfers with USD values", color: "#00E39E" },
  dex: { label: "DEX Trades", icon: "🔄", desc: "Swaps, pools, liquidity across all DEXes", color: "#00FFA3" },
  lending: { label: "Lending", icon: "🏦", desc: "Borrows, repays, liquidations (Aave, Compound, etc.)", color: "#B6509E" },
  nfts: { label: "NFTs", icon: "🖼️", desc: "Trades, mints, transfers, collections", color: "#FF6B6B" },
  decoded: { label: "Decoded Logs", icon: "🔓", desc: "ABI-decoded event logs and function calls", color: "#FFA726" },
  metrics: { label: "Metrics", icon: "📊", desc: "Pre-computed daily chain & project stats", color: "#2196F3" },
  bridges: { label: "Bridges", icon: "🌉", desc: "Cross-chain bridge transactions", color: "#9C27B0" },
  prices: { label: "Prices", icon: "💰", desc: "DEX-derived token prices, OHLCV", color: "#FFD700" },
  yields: { label: "Yields", icon: "🌾", desc: "Yield farming, staking returns", color: "#4CAF50" },
  staking: { label: "Staking", icon: "🥩", desc: "Validator staking, delegations, rewards", color: "#FF5722" },
  ens: { label: "ENS", icon: "🏷️", desc: "Name registrations, resolutions", color: "#5284FF" },
  liquid_staking: { label: "Liquid Staking", icon: "💧", desc: "stETH, rETH derivatives and flows", color: "#00BCD4" },
  defi: { label: "DeFi", icon: "🏗️", desc: "Protocol-specific DeFi data", color: "#E91E63" },
  predictions: { label: "Predictions", icon: "🔮", desc: "Prediction markets data", color: "#673AB7" },
};

const ALL_ECOSYSTEMS = [...new Set(CHAIN_DATA.map(c => c.ecosystem))];
const ALL_SCHEMAS = [...new Set(CHAIN_DATA.flatMap(c => c.schemas))];

function ChainCoverageExplorer() {
  const [selectedChains, setSelectedChains] = useState([]);
  const [filterEcosystem, setFilterEcosystem] = useState("all");
  const [filterTier, setFilterTier] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredSchema, setHoveredSchema] = useState(null);
  
  const filteredChains = CHAIN_DATA.filter(c => {
    if (filterEcosystem !== "all" && c.ecosystem !== filterEcosystem) return false;
    if (filterTier !== "all" && c.tier !== filterTier) return false;
    if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  
  const toggleChain = (id) => {
    setSelectedChains(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const selectedData = CHAIN_DATA.filter(c => selectedChains.includes(c.id));
  const allSelectedSchemas = [...new Set(selectedData.flatMap(c => c.schemas))];
  const totalTables = selectedData.reduce((s, c) => s + c.tables, 0);
  
  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Chains", value: "115+", sub: "Most in industry" },
          { label: "Total Tables", value: "3,000+", sub: "Raw + enriched" },
          { label: "Ecosystems", value: ALL_ECOSYSTEMS.length, sub: "EVM, SVM, Move, UTXO..." },
          { label: "Data Categories", value: ALL_SCHEMAS.length, sub: "From raw to decoded" },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text" placeholder="Search chains..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none", width: 160 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "EVM", "SVM", "Move", "UTXO", "Cosmos"].map(e => (
            <button key={e} onClick={() => setFilterEcosystem(e)} style={{
              padding: "5px 10px", borderRadius: 5, fontSize: 10, cursor: "pointer",
              background: filterEcosystem === e ? "rgba(0,227,158,0.15)" : "rgba(255,255,255,0.03)",
              border: filterEcosystem === e ? "1px solid rgba(0,227,158,0.3)" : "1px solid rgba(255,255,255,0.06)",
              color: filterEcosystem === e ? "#00E39E" : "rgba(255,255,255,0.4)",
            }}>{e === "all" ? "All" : e}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "L1", "L2"].map(t => (
            <button key={t} onClick={() => setFilterTier(t)} style={{
              padding: "5px 10px", borderRadius: 5, fontSize: 10, cursor: "pointer",
              background: filterTier === t ? "rgba(98,126,234,0.15)" : "rgba(255,255,255,0.03)",
              border: filterTier === t ? "1px solid rgba(98,126,234,0.3)" : "1px solid rgba(255,255,255,0.06)",
              color: filterTier === t ? "#627EEA" : "rgba(255,255,255,0.4)",
            }}>{t === "all" ? "All Tiers" : t}</button>
          ))}
        </div>
        {selectedChains.length > 0 && (
          <button onClick={() => setSelectedChains([])} style={{
            padding: "5px 10px", borderRadius: 5, fontSize: 10, cursor: "pointer",
            background: "rgba(255,77,106,0.1)", border: "1px solid rgba(255,77,106,0.2)", color: "#FF4D6A",
          }}>Clear ({selectedChains.length})</button>
        )}
      </div>

      {/* Chain grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 20 }}>
        {filteredChains.map(chain => {
          const selected = selectedChains.includes(chain.id);
          return (
            <div key={chain.id} onClick={() => toggleChain(chain.id)} style={{
              padding: "12px 14px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s ease",
              background: selected ? `${chain.color}15` : "rgba(255,255,255,0.02)",
              border: selected ? `1px solid ${chain.color}50` : "1px solid rgba(255,255,255,0.06)",
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: chain.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: selected ? chain.color : "rgba(255,255,255,0.7)" }}>{chain.name}</span>
                </div>
                {selected && <span style={{ fontSize: 10, color: chain.color }}>✓</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{chain.ecosystem} · {chain.tier}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>{chain.tables}</span>
              </div>
              <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                {chain.schemas.slice(0, 5).map(s => (
                  <span key={s} style={{
                    fontSize: 7, padding: "1px 4px", borderRadius: 2,
                    background: `${SCHEMA_INFO[s]?.color || "#888"}15`,
                    color: `${SCHEMA_INFO[s]?.color || "#888"}90`,
                  }}>{SCHEMA_INFO[s]?.icon}</span>
                ))}
                {chain.schemas.length > 5 && (
                  <span style={{ fontSize: 7, color: "rgba(255,255,255,0.2)" }}>+{chain.schemas.length - 5}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected chains comparison matrix */}
      {selectedChains.length > 0 ? (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>Coverage Matrix — {selectedChains.length} Chain{selectedChains.length > 1 ? "s" : ""} Selected</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{totalTables} tables · {allSelectedSchemas.length} data categories available</div>
            </div>
          </div>
          
          {/* Matrix header */}
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${ALL_SCHEMAS.length}, 1fr)`, gap: 2, minWidth: 600 }}>
              <div style={{ padding: 6 }} />
              {ALL_SCHEMAS.map(s => (
                <div key={s} style={{
                  padding: "6px 4px", textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.4)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                  background: hoveredSchema === s ? "rgba(255,255,255,0.04)" : "transparent",
                }}
                onMouseEnter={() => setHoveredSchema(s)}
                onMouseLeave={() => setHoveredSchema(null)}
                >
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{SCHEMA_INFO[s]?.icon || "📄"}</div>
                  <div style={{ lineHeight: 1.1 }}>{SCHEMA_INFO[s]?.label || s}</div>
                </div>
              ))}
            </div>
            
            {/* Matrix rows */}
            {selectedData.map(chain => (
              <div key={chain.id} style={{
                display: "grid", gridTemplateColumns: `100px repeat(${ALL_SCHEMAS.length}, 1fr)`, gap: 2,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}>
                <div style={{ padding: "8px 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 2, background: chain.color }} />
                  <span style={{ fontSize: 11, color: chain.color, fontWeight: 600 }}>{chain.name}</span>
                </div>
                {ALL_SCHEMAS.map(s => {
                  const has = chain.schemas.includes(s);
                  return (
                    <div key={s} style={{
                      padding: 8, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center",
                      background: hoveredSchema === s ? "rgba(255,255,255,0.02)" : "transparent",
                    }}>
                      {has ? (
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          background: `${SCHEMA_INFO[s]?.color || "#00E39E"}25`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: SCHEMA_INFO[s]?.color || "#00E39E",
                        }}>✓</div>
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.1)" }}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          
          {/* Schema tooltip */}
          {hoveredSchema && SCHEMA_INFO[hoveredSchema] && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 8,
              background: `${SCHEMA_INFO[hoveredSchema].color}10`,
              border: `1px solid ${SCHEMA_INFO[hoveredSchema].color}30`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: SCHEMA_INFO[hoveredSchema].color }}>
                {SCHEMA_INFO[hoveredSchema].icon} {SCHEMA_INFO[hoveredSchema].label}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: 8 }}>{SCHEMA_INFO[hoveredSchema].desc}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
          borderRadius: 12, padding: 40, textAlign: "center", marginBottom: 20,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Click chains above to compare data coverage</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>Select your prospect's chains to see exactly what Allium provides</div>
        </div>
      )}

      {/* Data freshness selling points */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { icon: "⚡", title: "3-5s Freshness", desc: "p50 data latency across all chains", color: "#00E39E" },
          { icon: "🔄", title: "Re-org Handling", desc: "Automatic detection & correction", color: "#627EEA" },
          { icon: "🛡️", title: "99.9% Uptime", desc: "Enterprise SLA available", color: "#FFA726" },
        ].map(p => (
          <div key={p.title} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.color, marginBottom: 4 }}>{p.title}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{p.desc}</div>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: 16, fontSize: 9, color: "rgba(255,255,255,0.15)", textAlign: "center" }}>
        Data sourced from Allium Explorer · {CHAIN_DATA.length} chains shown · 115+ total supported
      </div>
    </div>
  );
}

// === THEME DEFINITIONS ===
const THEMES = {
  dark: {
    name: "Dark",
    bg: "#0A0B0E",
    bgGradient: "radial-gradient(circle at 15% 25%, rgba(0,227,158,0.04) 0%, transparent 50%), radial-gradient(circle at 85% 75%, rgba(98,126,234,0.04) 0%, transparent 50%)",
    cardBg: "rgba(255,255,255,0.03)",
    cardBorder: "rgba(255,255,255,0.06)",
    cardHover: "rgba(255,255,255,0.05)",
    text: "#fff",
    textDim: "rgba(255,255,255,0.4)",
    textMuted: "rgba(255,255,255,0.25)",
    textFaint: "rgba(255,255,255,0.15)",
    accent: "#00E39E",
    accentBg: "rgba(0,227,158,0.08)",
    accentBorder: "rgba(0,227,158,0.15)",
    inputBg: "rgba(255,255,255,0.04)",
    inputBorder: "rgba(255,255,255,0.1)",
    selection: "#00E39E40",
    scrollThumb: "rgba(255,255,255,0.1)",
    candleGlow: "rgba(0,227,158,0.3)",
    flameColors: ["#00E39E", "#00c589", "#00a873"],
  },
  ambient: {
    name: "Ambient",
    bg: "#1a1410",
    bgGradient: "radial-gradient(circle at 20% 20%, rgba(255,167,38,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,111,97,0.06) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(255,200,120,0.03) 0%, transparent 70%)",
    cardBg: "rgba(255,200,150,0.04)",
    cardBorder: "rgba(255,180,120,0.1)",
    cardHover: "rgba(255,200,150,0.08)",
    text: "#FFE8D0",
    textDim: "rgba(255,220,180,0.5)",
    textMuted: "rgba(255,200,150,0.35)",
    textFaint: "rgba(255,180,120,0.2)",
    accent: "#FFA726",
    accentBg: "rgba(255,167,38,0.12)",
    accentBorder: "rgba(255,167,38,0.25)",
    inputBg: "rgba(255,200,150,0.06)",
    inputBorder: "rgba(255,180,120,0.15)",
    selection: "#FFA72640",
    scrollThumb: "rgba(255,180,120,0.15)",
    candleGlow: "rgba(255,167,38,0.5)",
    flameColors: ["#FFD54F", "#FFA726", "#FF8F00"],
  },
  demon: {
    name: "Demon",
    bg: "#0D0507",
    bgGradient: "radial-gradient(circle at 30% 30%, rgba(255,0,0,0.08) 0%, transparent 40%), radial-gradient(circle at 70% 70%, rgba(180,0,0,0.06) 0%, transparent 50%), radial-gradient(circle at 50% 0%, rgba(255,50,0,0.04) 0%, transparent 60%)",
    cardBg: "rgba(255,30,30,0.04)",
    cardBorder: "rgba(255,50,50,0.12)",
    cardHover: "rgba(255,30,30,0.08)",
    text: "#FFD0D0",
    textDim: "rgba(255,180,180,0.5)",
    textMuted: "rgba(255,120,120,0.35)",
    textFaint: "rgba(255,80,80,0.2)",
    accent: "#FF2222",
    accentBg: "rgba(255,30,30,0.12)",
    accentBorder: "rgba(255,50,50,0.25)",
    inputBg: "rgba(255,30,30,0.06)",
    inputBorder: "rgba(255,50,50,0.15)",
    selection: "#FF222240",
    scrollThumb: "rgba(255,50,50,0.15)",
    candleGlow: "rgba(255,0,0,0.6)",
    flameColors: ["#FF1744", "#D50000", "#B71C1C"],
  },
};

const MODE_ORDER = ["dark", "ambient", "demon"];

// === ANIMATED CANDLE ===
function AnimatedCandle({ mode, onClick }) {
  const t = THEMES[mode];
  const nextMode = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
  const nextName = THEMES[nextMode].name;
  
  return (
    <div
      onClick={onClick}
      title={`Switch to ${nextName} mode`}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px 4px 6px",
        borderRadius: 20,
        background: mode === "demon" ? "rgba(255,30,30,0.1)" : mode === "ambient" ? "rgba(255,167,38,0.1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${mode === "demon" ? "rgba(255,50,50,0.2)" : mode === "ambient" ? "rgba(255,167,38,0.2)" : "rgba(255,255,255,0.08)"}`,
        transition: "all 0.4s ease",
        position: "relative",
        overflow: "visible",
      }}
    >
      <style>{`
        @keyframes flicker {
          0%, 100% { transform: scaleY(1) scaleX(1) translateY(0); opacity: 1; }
          25% { transform: scaleY(1.1) scaleX(0.9) translateY(-1px); opacity: 0.9; }
          50% { transform: scaleY(0.9) scaleX(1.1) translateY(1px); opacity: 1; }
          75% { transform: scaleY(1.05) scaleX(0.95) translateY(-0.5px); opacity: 0.95; }
        }
        @keyframes flame-dance {
          0%, 100% { transform: rotate(-2deg) translateX(0); }
          33% { transform: rotate(2deg) translateX(0.5px); }
          66% { transform: rotate(-1deg) translateX(-0.5px); }
        }
        @keyframes glow-pulse {
          0%, 100% { filter: blur(3px) brightness(1); }
          50% { filter: blur(5px) brightness(1.3); }
        }
        @keyframes demon-shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-1deg); }
          75% { transform: rotate(1deg); }
        }
      `}</style>
      <svg width="20" height="36" viewBox="0 0 20 36" style={{ 
        overflow: "visible",
        animation: mode === "demon" ? "demon-shake 0.3s ease-in-out infinite" : "none",
      }}>
        {/* Glow behind flame */}
        <ellipse cx="10" cy="10" rx="8" ry="10" fill={t.candleGlow} style={{ animation: "glow-pulse 2s ease-in-out infinite" }} />
        
        {/* Outer flame */}
        <path
          d="M10 2 Q14 8 13 14 Q12 17 10 18 Q8 17 7 14 Q6 8 10 2Z"
          fill={t.flameColors[2]}
          style={{ animation: "flame-dance 1.5s ease-in-out infinite", transformOrigin: "10px 18px" }}
        />
        {/* Middle flame */}
        <path
          d="M10 5 Q12.5 9 12 14 Q11 16 10 16.5 Q9 16 8 14 Q7.5 9 10 5Z"
          fill={t.flameColors[1]}
          style={{ animation: "flicker 1.2s ease-in-out infinite", transformOrigin: "10px 16px" }}
        />
        {/* Inner flame */}
        <path
          d="M10 8 Q11.5 11 11 14 Q10.5 15.5 10 15.5 Q9.5 15.5 9 14 Q8.5 11 10 8Z"
          fill={t.flameColors[0]}
          opacity="0.9"
          style={{ animation: "flicker 0.8s ease-in-out infinite", transformOrigin: "10px 15px" }}
        />
        {/* Bright core */}
        <ellipse cx="10" cy="13" rx="1.5" ry="2.5" fill={mode === "demon" ? "#FF8A80" : mode === "ambient" ? "#FFF8E1" : "#B9F6CA"} opacity="0.7" style={{ animation: "flicker 0.6s ease-in-out infinite" }} />
        
        {/* Wick */}
        <line x1="10" y1="18" x2="10" y2="20" stroke={t.textMuted} strokeWidth="1" strokeLinecap="round" />
        
        {/* Candle body */}
        <rect x="6" y="20" width="8" height="14" rx="1.5" fill={mode === "demon" ? "#2a0a0a" : mode === "ambient" ? "#3d2b1a" : "#1a1d24"} stroke={t.cardBorder} strokeWidth="0.5" />
        {/* Wax drip */}
        <path d="M6 22 Q5 24 6 25" fill="none" stroke={t.cardBorder} strokeWidth="0.8" />
        <path d="M14 21 Q15 23.5 14 25.5" fill="none" stroke={t.cardBorder} strokeWidth="0.8" />
      </svg>
      <span style={{ fontSize: 9, color: t.textDim, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
        {t.name}
      </span>
    </div>
  );
}

// ============ MAIN APP ============
export default function AlliumIntelApp() {
  const [tab, setTab] = useState("wallet");
  const [mode, setMode] = useState("dark");
  const [livePrices, setLivePrices] = useState(PRICE_DATA);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [priceSource, setPriceSource] = useState("fallback");
  
  // Fetch live prices - direct Allium REST API, polling every 1 second
  const fetchLivePrices = useCallback(async () => {
    try {
      // POST /api/v1/developer/prices — returns latest price + OHLC
      const res = await fetch(`${ALLIUM_BASE}/api/v1/developer/prices`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-KEY": ALLIUM_API_KEY,
        },
        body: JSON.stringify([
          { token_address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", chain: "ethereum" },
          { token_address: "So11111111111111111111111111111111111111112", chain: "solana" },
          { token_address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", chain: "ethereum" },
        ]),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = json?.items || json || [];
      
      if (items.length > 0) {
        // Map response addresses to PRICE_DATA keys (bitcoin, ethereum, solana)
        const addrMap = {
          "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "ethereum",
          "so11111111111111111111111111111111111111112": "solana",
          "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "bitcoin",
        };
        
        setLivePrices(prev => {
          const updated = { ...prev };
          for (const item of items) {
            const addr = (item.address || item.mint || item.token_address || "").toLowerCase();
            const key = addrMap[addr];
            if (key && item.price && updated[key]) {
              updated[key] = {
                ...updated[key],
                price: parseFloat(item.price),
                ...(item.volume_24h != null ? { vol24h: parseFloat(item.volume_24h) / 1e9 } : {}),
              };
            }
          }
          PRICE_DATA = updated;
          return updated;
        });
        setLastPriceUpdate(new Date());
        setPriceSource("allium");
      }
    } catch (e) {
      // Silently fail — prices will use fallback static data
    }
  }, []);
  
  // Fetch on mount + poll every 1 second
  useEffect(() => {
    fetchLivePrices();
    const iv = setInterval(fetchLivePrices, 1000);
    return () => clearInterval(iv);
  }, [fetchLivePrices]);
  
  const cycleMode = () => {
    setMode(prev => MODE_ORDER[(MODE_ORDER.indexOf(prev) + 1) % MODE_ORDER.length]);
  };
  
  const theme = THEMES[mode];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter','Helvetica Neue',sans-serif", transition: "background 0.6s ease, color 0.4s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}::selection{background:${theme.selection};color:${theme.text}}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${theme.scrollThumb};border-radius:3px}
      `}</style>

      <div style={{ position: "fixed", inset: 0, backgroundImage: theme.bgGradient, pointerEvents: "none", transition: "all 0.6s ease" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "36px 24px" }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: mode === "demon" ? "linear-gradient(135deg, #FF1744, #D50000)" : mode === "ambient" ? "linear-gradient(135deg, #FFA726, #FF7043)" : "linear-gradient(135deg, #00E39E, #627EEA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, transition: "background 0.4s ease" }}>A</div>
              <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: theme.text }}>Allium Intelligence</h1>
              <span style={{ fontSize: 9, color: theme.textMuted, padding: "2px 8px", background: theme.cardBg, borderRadius: 4, textTransform: "uppercase", letterSpacing: 1.5 }}>Aaron Hackathon</span>
            </div>
            <p style={{ fontSize: 12, color: theme.textDim }}>
              Real-time wallet intelligence & market data · Powered by Allium MCP
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: theme.accentBg, border: `1px solid ${theme.accentBorder}`, borderRadius: 20, transition: "all 0.4s ease" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: theme.accent, transition: "background 0.4s ease" }} />
              <span style={{ fontSize: 9, color: theme.accent, fontWeight: 600, letterSpacing: 1, transition: "color 0.4s ease" }}>REAL DATA</span>
            </div>
            <AnimatedCandle mode={mode} onClick={cycleMode} />
            <LiveDot />
          </div>
        </div>

        {/* TAB NAV */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          <TabButton label="🔍 Wallet Lookup" active={tab === "wallet"} onClick={() => setTab("wallet")} color="#00E39E" />
          <TabButton label="🐋 Whale Feed" active={tab === "whales"} onClick={() => setTab("whales")} color="#00E39E" />
          <TabButton label="📊 Market Overview" active={tab === "market"} onClick={() => setTab("market")} color="#627EEA" />
          <TabButton label="🔥 Market Freakout" active={tab === "freakout"} onClick={() => setTab("freakout")} color="#FF4D6A" />
          <TabButton label="🔮 What If" active={tab === "whatif"} onClick={() => setTab("whatif")} color="#00E39E" />
          <TabButton label="🗺️ Chain Coverage" active={tab === "coverage"} onClick={() => setTab("coverage")} color="#FFA726" />
        </div>

        {/* CONTENT */}
        {tab === "wallet" && <WalletLookup />}

        {tab === "whales" && <WhaleFeed />}

        {tab === "market" && (
          <div>
            {/* Live price status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 2 }}>
                Live Prices
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {lastPriceUpdate && (
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
                    Updated {lastPriceUpdate.toLocaleTimeString()}
                  </span>
                )}
                <span style={{
                  fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                  background: priceSource === "allium" ? "rgba(0,227,158,0.15)" : priceSource === "mcp" ? "rgba(98,126,234,0.15)" : "rgba(255,255,255,0.04)",
                  color: priceSource === "allium" ? "#00E39E" : priceSource === "mcp" ? "#627EEA" : "rgba(255,255,255,0.3)",
                }}>
                  {priceSource === "allium" ? "\u2705 Allium API" : priceSource === "mcp" ? "\u26A1 MCP" : "\u23F3 Fallback"}
                </span>
                <button onClick={fetchLivePrices} style={{
                  fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer",
                }}>
                  {"\uD83D\uDD04"} Refresh
                </button>
              </div>
            </div>
            <MarketMini livePrices={livePrices} />
            <MarketDashboard />
          </div>
        )}

        {tab === "freakout" && <MarketFreakout />}

        {tab === "whatif" && <WhatIfCalculator />}

        {tab === "coverage" && <ChainCoverageExplorer />}

        {/* FOOTER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>Allium Intelligence · Built with Allium × Claude · Feb 2026</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>130+ chains · 1,000+ schemas · Real-time + historical</div>
        </div>
      </div>
    </div>
  );
}
