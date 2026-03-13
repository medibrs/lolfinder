const express = require("express");
const cors = require("cors");
const https = require("https");

const LIVECLIENT_URL = "https://127.0.0.1:2999/liveclientdata/allgamedata";

const app = express();
const PORT = 4000;

app.use(cors());

// ---------------- Data Dragon items (for item gold) ----------------

const DDRAGON_VERSION = "16.5.1";
const ITEM_DATA_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/item.json`;

let ITEM_COST = {};

async function loadItemData() {
  try {
    console.log("Loading item prices from Data Dragon...");
    const res = await fetch(ITEM_DATA_URL);
    const json = await res.json();

    const data = json.data || {};
    for (const id in data) {
      const info = data[id];
      const total = info?.gold?.total ?? 0;
      ITEM_COST[id] = total;
    }

    console.log("Loaded item costs for", Object.keys(ITEM_COST).length, "items.");
  } catch (err) {
    console.error("Failed to load item data:", err.message);
  }
}

// ---------------- Start server ----------------

async function start() {
  await loadItemData();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LoL Live Proxy running at http://0.0.0.0:${PORT}`);
    console.log(`Other devices can connect using your local IP on port ${PORT}`);
  });
}

start();

// ---------------- LiveClient fetch ----------------

function fetchLiveData() {
  return new Promise((resolve, reject) => {
    const req = https.request(
      LIVECLIENT_URL,
      {
        method: "GET",
        rejectUnauthorized: false,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.end();
  });
}

// ---------------- Summoner spell key mapping ----------------

function extractSpellKey(spellObj) {
  if (!spellObj) return null;

  const desc = spellObj.rawDescription || "";
  const display = (spellObj.displayName || "").toLowerCase();
  const rawName = (spellObj.rawDisplayName || "").toLowerCase();

  const candidates = [
    "SummonerFlash",
    "SummonerHeal",
    "SummonerBarrier",
    "SummonerDot",       // Ignite
    "SummonerSmite",
    "SummonerTeleport",
    "SummonerExhaust",
    "SummonerHaste",     // Ghost
    "SummonerMana",
    "SummonerBoost",     // Cleanse
  ];

  for (const key of candidates) {
    if (desc.includes(key)) return key;
  }

  if (
    display.includes("teleport") ||
    rawName.includes("teleportunique") ||
    rawName.includes("teleportupgrade")
  ) {
    return "SummonerTeleport";
  }

  if (
    display.includes("smite") ||
    rawName.includes("smiteavatar") ||
    rawName.includes("primalsmite")
  ) {
    return "SummonerSmite";
  }

  if (display.includes("hexflash") || rawName.includes("hexflash")) {
    return "SummonerFlash";
  }

  return null;
}

// ---------------- GOLD HELPERS ----------------

function computeItemGold(player) {
  let total = 0;
  for (const it of player.items || []) {
    const id = String(it.itemID);
    const cost = ITEM_COST[id] ?? 0;
    total += cost;
  }
  return total;
}

function computeCsGold(cs) {
  return cs * 21.5;
}

function computeKillAssistGold(kills, assists) {
  const killGold = kills * 300;
  const assistGold = assists * 150;
  return killGold + assistGold;
}

function computeAmbientGold(gameTimeSeconds) {
  return gameTimeSeconds * 1.2;
}

function estimatePlayerGold(player, gameTimeSeconds, itemGold) {
  const scores = player.scores || {};
  const kills = scores.kills || 0;
  const assists = scores.assists || 0;
  const cs = scores.creepScore || 0;

  const csGold = computeCsGold(cs);
  const kaGold = computeKillAssistGold(kills, assists);
  const ambientGold = computeAmbientGold(gameTimeSeconds);

  const estimated = itemGold + csGold + kaGold + ambientGold;
  return Math.round(estimated);
}

// ---------------- Payload builder ----------------

function buildPayload(raw) {
  const players = raw.allPlayers || [];
  const gameData = raw.gameData || {};
  const gameTime = gameData.gameTime || 0;

  const teams = {
    ORDER: { name: "BLUE", kills: 0, deaths: 0, assists: 0, kdaRatio: 0, gold: 0 },
    CHAOS: { name: "RED",  kills: 0, deaths: 0, assists: 0, kdaRatio: 0, gold: 0 },
  };

  const playerList = [];

  for (const p of players) {
    const team = p.team || "UNKNOWN";
    const scores = p.scores || {};

    const kills = scores.kills || 0;
    const deaths = scores.deaths || 0;
    const assists = scores.assists || 0;
    const cs = scores.creepScore || 0;

    const itemGold = computeItemGold(p);
    const estGold = estimatePlayerGold(p, gameTime, itemGold);

    if (teams[team]) {
      teams[team].kills += kills;
      teams[team].deaths += deaths;
      teams[team].assists += assists;
      teams[team].gold += estGold;
    }

    const items = (p.items || []).map((it) => ({
      id: it.itemID,
      name: it.displayName || "",
    }));

    const spells = p.summonerSpells || {};
    const s1 = spells.summonerSpellOne || {};
    const s2 = spells.summonerSpellTwo || {};

    const spell1Key = extractSpellKey(s1);
    const spell2Key = extractSpellKey(s2);

    const kdaRatio = (kills + assists) / Math.max(1, deaths);

    playerList.push({
      summonerName: p.summonerName || "",
      riotId: p.riotId || "",
      champion: p.championName || "",
      team,
      position: p.position || "",
      level: p.level || 0,
      kills,
      deaths,
      assists,
      kdaRatio: Number(kdaRatio.toFixed(2)),
      cs,
      gold: estGold,
      itemGold,
      items,
      spell1: s1.displayName || "",
      spell2: s2.displayName || "",
      spell1Key,
      spell2Key,
    });
  }

  for (const key of Object.keys(teams)) {
    const t = teams[key];
    t.kdaRatio = (t.kills + t.assists) / Math.max(1, t.deaths);
    t.kdaRatio = Number(t.kdaRatio.toFixed(2));
  }

  return {
    gameTimeSeconds: gameTime,
    gameTimeMinutes: Number((gameTime / 60).toFixed(1)),
    teams,
    players: playerList,
  };
}

// ---------------- endpoint ----------------

app.get("/live", async (req, res) => {
  try {
    const raw = await fetchLiveData();
    const payload = buildPayload(raw);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "LoL Live Proxy is running" });
});
