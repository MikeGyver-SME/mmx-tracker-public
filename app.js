"use strict";

/* MMX live tracker frontend — PUBLIC GitHub edition.
 * Reads data/latest.json (same-origin static file, refreshed by a GitHub
 * Actions workflow every ~30 minutes). The T+ clock runs locally every
 * second; the data file is re-read every 5 minutes.
 */

const DATA_URL = "data/latest.json";

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
  try {
    const res = await fetch(DATA_URL + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("data HTTP " + res.status);
    const data = await res.json();
    if (!data.range_km) {
      document.getElementById("stat-dist-sub").textContent =
        "first Horizons update lands within ~30 minutes of deploy";
      return;
    }

    distEl.textContent = fmtInt(data.range_mi) + " mi";
    document.getElementById("stat-dist-sub").textContent =
      fmtInt(data.range_km) + " km · " + data.range_au.toFixed(6) + " AU";

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
setInterval(refresh, 300000);
