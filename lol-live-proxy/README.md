# LoL Live Proxy

Local proxy server that reads League of Legends Live Client Data API and exposes it over HTTP so the lolfinder website can display a live game overlay.

## How it works

1. Run this on the PC where League of Legends is running (or being spectated)
2. It connects to the League client's local API (`https://127.0.0.1:2999`)
3. Exposes the processed game data at `http://<your-ip>:4000/live`
4. The lolfinder website fetches from this endpoint to display the live overlay

## Quick Start

### Option A: Run with Node.js

```bash
npm install
npm start
```

### Option B: Build as standalone .exe (no Node.js needed)

```bash
npm install
npm run build:exe
```

This creates `lol-live-proxy.exe` — just double-click it on any Windows PC.

## Network Setup

For the website to reach this proxy, the PC running it needs:

1. **Port 4000 open** in Windows Firewall (inbound TCP)
2. **Public IP or port forwarding** if accessing from outside the local network

### Opening port 4000 in Windows Firewall

Run in PowerShell (as Administrator):
```powershell
New-NetFirewallRule -DisplayName "LoL Live Proxy" -Direction Inbound -Port 4000 -Protocol TCP -Action Allow
```

### Finding your IP

- **Local network**: Run `ipconfig` and use your IPv4 address
- **Public access**: Use a service like ngrok, or set up port forwarding on your router
