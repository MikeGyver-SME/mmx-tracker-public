"use strict";

/* MMX LinkedIn telemetry post generator — PUBLIC GitHub edition.
 * Reads data/latest.json (same-origin, refreshed by GitHub Actions) and
 * formats a LinkedIn-ready post. Plain text, no Markdown, bare URLs on
 * own lines.
 */

const DATA_URL = "data/latest.json";

const LAUNCH_UTC = Date.UTC(2026, 9, 19, 19, 41, 3); // 2:41 PM CDT Oct 19 2026

/* The "Tracked live:" link is this site's own address, derived from where
 * the page is hosted — on GitHub Pages it automatically becomes your
 * public tracker URL. To hard-code a different link instead, replace the
 * line below with:  const TRACKER_URL = "https://your-link/";            */
const TRACKER_URL =
  location.origin +
  location.pathname.replace(/telemetry\.html$/, "").replace(/\/$/, "") +
  "/";

const NEXT_MILESTONE = {
  name: "Mars orbit insertion",
  date: Date.UTC(2027, 7, 1), // ~August 2027 (month-level JAXA estimate)
  label: "~August 2027",
};

function fmtInt(n) {
  return Math.round(n).toLocaleString("en-US");
}

function buildPost(d) {
  const missionDay = Math.floor((Date.now() - LAUNCH_UTC) / 86400000);
  const distMi = fmtInt(d.range_mi);
  const distKm = fmtInt(d.range_km);
  const rate = d.range_rate_kms.toFixed(2);
  const light =
    d.light_delay_s < 90
      ? d.light_delay_s.toFixed(1) + " seconds"
      : (d.light_delay_s / 60).toFixed(1) + " minutes";
  const daysOut = Math.max(
    0,
    Math.floor((NEXT_MILESTONE.date - Date.now()) / 86400000)
  );

  return (
    "MMX · Mission Day " +
    missionDay +
    " — on the road to Mars\n" +
    "\n" +
    "JAXA's Martian Moons eXploration spacecraft is now " +
    distMi +
    " miles (" +
    distKm +
    " km) from Earth, receding at " +
    rate +
    " km/s. A radio signal from MMX takes " +
    light +
    " to reach us.\n" +
    "\n" +
    "Next stop: " +
    NEXT_MILESTONE.name +
    " (" +
    NEXT_MILESTONE.label +
    "), " +
    daysOut +
    " days out — then quasi-satellite orbits of Phobos, the IDEFIX rover, sample collection, and in 2031 the first Phobos samples ever brought home.\n" +
    "\n" +
    "Tracked live:\n" +
    TRACKER_URL +
    "\n" +
    "Trajectory: NASA/JPL Horizons (spacecraft -239)\n" +
    "\n" +
    "#MMX #JAXA #Phobos #SpaceExploration"
  );
}

async function generate() {
  const postEl = document.getElementById("post");
  const ageEl = document.getElementById("dataAge");
  document.getElementById("copiedMsg").classList.remove("show");

  try {
    const res = await fetch(DATA_URL + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("data HTTP " + res.status);
    const data = await res.json();
    if (!data.range_km) {
      postEl.textContent =
        "No Horizons reading yet — the first update lands within ~30 minutes of deploy. Regenerate then.";
      ageEl.textContent = "";
      return;
    }
    postEl.textContent = buildPost(data);
    const when = data.polled_at ? new Date(data.polled_at) : new Date();
    ageEl.textContent =
      "Data from Horizons poll at " +
      when.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  } catch (e) {
    postEl.textContent =
      "Couldn't load data/latest.json (" + e.message + "). If you just deployed, give the first Actions run a few minutes and regenerate.";
    ageEl.textContent = "";
  }
}

function copyPost() {
  const text = document.getElementById("post").textContent;
  const done = function () {
    document.getElementById("copiedMsg").classList.add("show");
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () {
      fallbackCopy(text);
      done();
    });
  } else {
    fallbackCopy(text);
    done();
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch (e) { /* clipboard unavailable */ }
  document.body.removeChild(ta);
}

document.getElementById("copyBtn").addEventListener("click", copyPost);
document.getElementById("regenBtn").addEventListener("click", generate);
generate();
