"use strict";

/* MMX live tracker frontend.
 * Reads the latest Horizons poll from the Cloudflare Worker and renders it.
 * The T+ clock runs locally every second; worker data refreshes every 60 s.
 */

// Worker URL comes from config.js (set it once there after deploying).
// >>> If the stats below say "set the worker URL", edit web/config.js <<<

const LAUNCH_UTC = Date.UTC(2026, 9, 19, 19, 41, 3); // 2:41 PM CDT Oct 19 2026
const NEXT_MILESTONE = {
  name: "Mars orbit insertion",
  date: Date.UTC(2027, 7, 1), // ~August 2027 (month-level JAXA estimate)
};

const FEED_KEY = "mmx-feed-log";
const FEED_MAX = 60;

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtInt(n) {
  return Math.round(n).toLocaleString("en-US");
}

function tickClock() {
  const diff = Date.now() - LAUNCH_UTC;
  const s = Math.max(0, Math.floor(diff / 1000));
  const d = Math.floor(s / 86400);
  document.getElementById("tplus-time").textContent =
    "T+ " + d + "d " + pad(Math.floor((s % 86400) / 3600)) + ":" +
    pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);

  const ms = NEXT_MILESTONE.date - Date.now();
  const ds = Math.max(0, Math.floor(ms / 1000));
  const dd = Math.floor(ds / 86400);
  document.getElementById("stat-next-count").textContent =
    "T−" + dd + "d " + pad(Math.floor((ds % 86400) / 3600)) + "h " +
    pad(Math.floor((ds % 3600) / 60)) + "m · ~Aug 2027";
}

function loadFeed() {
  try {
    return JSON.parse(localStorage.getItem(FEED_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function saveFeed(feed) {
  try {
    localStorage.setItem(FEED_KEY, JSON.stringify(feed.slice(0, FEED_MAX)));
  } catch (e) { /* storage full / private mode — skip */ }
}

function renderFeed(feed) {
  const list = document.getElementById("feed-list");
  list.innerHTML = "";
  feed.forEach(function (entry) {
    const li = document.createElement("li");
    li.innerHTML =
      '<span class="feed-time">' + entry.t + "</span>" +
      '<span class="feed-dist">' + entry.dist + "</span>";
    list.appendChild(li);
  });
  const status = document.getElementById("feed-status");
  status.textContent = feed.length ? "· " + feed.length + " entries" : "";
}

async function refresh() {
  const distEl = document.getElementById("stat-dist");
  if (
    typeof MMX_WORKER_URL === "undefined" ||
    MMX_WORKER_URL.indexOf("YOUR_SUBDOMAIN") !== -1
  ) {
    document.getElementById("stat-dist-sub").textContent =
      "set the worker URL in web/config.js, then reload";
    return;
  }
  try {
    const res = await fetch(MMX_WORKER_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("worker HTTP " + res.status);
    const data = await res.json();
    if (data.status === "warming_up" || !data.range_km) {
      document.getElementById("stat-dist-sub").textContent =
        "worker warming up — first Horizons poll lands within ~15 min of deploy";
      return;
    }

    distEl.textContent = fmtInt(data.range_mi) + " mi";
    document.getElementById("stat-dist-sub").textContent =
      fmtInt(data.range_km) + " km · " + data.range_au.toFixed(6) + " AU";

    // Stale-data badge: driven by the worker's epoch drift guard (v1.3.1+).
    // Readings from older workers have no epoch_ok field — treat as OK.
    const staleEl = document.getElementById("stale-badge");
    if (data.epoch_ok === false) {
      staleEl.textContent =
        "⚠ Stale data — " + (data.warning || "the Horizons epoch is behind real time");
      staleEl.hidden = false;
    } else {
      staleEl.hidden = true;
    }

    const rateEl = document.getElementById("stat-rate");
    rateEl.textContent = data.range_rate_kms.toFixed(2) + " km/s";
    document.getElementById("stat-rate-sub").textContent =
      (data.range_rate_kms >= 0 ? "receding · " : "approaching · ") +
      fmtInt(data.range_rate_mph) + " mph";

    const lt = data.light_delay_s;
    document.getElementById("stat-light").textContent =
      lt < 90 ? lt.toFixed(1) + " s" : (lt / 60).toFixed(1) + " min";

    // Feed log: add an entry when the reading is new
    const feed = loadFeed();
    const stamp = data.polled_at || data.epoch_utc || new Date().toISOString();
    if (!feed.length || feed[0].stamp !== stamp) {
      const d = new Date(stamp);
      feed.unshift({
        stamp: stamp,
        t: d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        dist: fmtInt(data.range_mi) + " mi · " + data.range_rate_kms.toFixed(2) + " km/s",
        // Numeric fields (for console.table analysis, Roman-feed style):
        epoch_utc: data.epoch_utc,
        range_km: data.range_km,
        range_mi: data.range_mi,
        range_au: data.range_au,
        range_rate_kms: data.range_rate_kms,
        range_rate_mph: data.range_rate_mph,
        light_delay_s: data.light_delay_s,
      });
      saveFeed(feed);
      renderFeed(feed);
    }
  } catch (e) {
    document.getElementById("stat-dist-sub").textContent =
      "update delayed — will retry";
  }
}

renderFeed(loadFeed());
tickClock();
setInterval(tickClock, 1000);
refresh();
setInterval(refresh, 60000);
