// MMX tracker — shared config.
// Set this ONCE after deploying the Cloudflare Worker (see README-deploy.txt).
// Both the tracker page (app.js) and the LinkedIn post generator (telemetry.js)
// read the worker URL from here.
const MMX_WORKER_URL = "https://mmx-tracker.mikegyver.workers.dev/api/latest"; // deployed 2026-10-20
