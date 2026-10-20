#!/usr/bin/env node
/* MMX tracker — PUBLIC GitHub edition: Horizons fetch script.
 *
 * Runs inside GitHub Actions (see .github/workflows/update-telemetry.yml).
 * Polls JPL Horizons for MMX (spacecraft -239) exactly the way the private
 * Cloudflare Worker does — same query, same parsing, same derived fields —
 * and writes the reading to data/latest.json, which the static Pages site
 * reads same-origin. No server, no CORS problem, no Cloudflare.
 *
 * Run locally:  node scripts/fetch-telemetry.mjs
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HORIZONS_ID = "-239"; // MMX (spacecraft), confirmed in Horizons 2026-10-19
const AU_KM = 149597870.7;
const C_KMS = 299792.458;
const MI_PER_KM = 0.621371;
const MPH_PER_KMS = 2236.94;

const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "latest.json"
);

function round(n, digits = 0) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

async function fetchHorizons() {
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const stop = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

  const q = new URLSearchParams({
    format: "json",
    COMMAND: "'" + HORIZONS_ID + "'",
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "'500@399'", // geocentric
    START_TIME: "'" + start + "'",
    STOP_TIME: "'" + stop + "'",
    STEP_SIZE: "'1d'",
    QUANTITIES: "'20'", // observer range (AU) & range-rate (km/s)
  });

  const resp = await fetch(
    "https://ssd.jpl.nasa.gov/api/horizons.api?" + q.toString()
  );
  if (!resp.ok) throw new Error("Horizons HTTP " + resp.status);

  const data = await resp.json();
  const text = typeof data.result === "string" ? data.result : "";
  const m = text.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error("No ephemeris rows in Horizons response");

  const line = m[1]
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s && !s.startsWith("$$"));
  if (!line) throw new Error("Empty ephemeris table");

  const parts = line.split(/\s+/);
  // Row: "2026-Oct-20 00:00   <delta AU>   <deldot km/s>"
  const deltaAu = parseFloat(parts[2]);
  const deldot = parseFloat(parts[3]);
  if (!isFinite(deltaAu) || !isFinite(deldot))
    throw new Error("Could not parse range from: " + line);

  const rangeKm = deltaAu * AU_KM;
  return {
    target: "MMX (-239)",
    epoch_utc: parts[0] + " " + parts[1],
    range_au: deltaAu,
    range_km: round(rangeKm),
    range_mi: round(rangeKm * MI_PER_KM),
    range_rate_kms: round(deldot, 4),
    range_rate_mph: round(deldot * MPH_PER_KMS),
    light_delay_s: round(rangeKm / C_KMS, 1),
  };
}

async function main() {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const reading = await fetchHorizons();
      reading.polled_at = new Date().toISOString();
      reading.source = "NASA/JPL Horizons via GitHub Actions";
      await writeFile(OUT_PATH, JSON.stringify(reading, null, 2) + "\n");
      console.log(
        "MMX reading written: " +
          reading.range_mi.toLocaleString("en-US") +
          " mi · " +
          reading.range_rate_kms.toFixed(2) +
          " km/s · epoch " +
          reading.epoch_utc +
          " UTC"
      );
      return;
    } catch (e) {
      lastErr = e;
      console.error("Attempt " + attempt + " failed: " + e.message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 15000));
    }
  }
  throw lastErr;
}

main().catch((e) => {
  console.error("fetch-telemetry failed: " + e.message);
  process.exit(1);
});
