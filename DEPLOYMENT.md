# Production: acpro.kz on Hoster.kz / Plesk

The production document root is `httpdocs`. GitHub is the source repository; a GitHub commit alone does **not** deploy to Hoster.kz.

## Build and verify

Use Node 22+ and `npm ci`, `npm run build`, `npm test`. The builder emits 15 pages in each of Russian (root), Kazakh (`/kk/`) and English (`/en/`). Existing calculators and enquiry contacts remain in `site.js` and `script.js`. `service-content.json` contains edited service copy. All content, metadata, canonical and reciprocal language links are present in HTML without JavaScript.

## Upload

Create a timestamped Plesk archive of the existing **entire** `httpdocs` in the subscription home directory, outside the public root. Preserve it until the release has been checked. Package only runtime files: generated HTML and locale directories, `assets`, CSS, JavaScript, `.htaccess`, `robots.txt`, `sitemap.xml`, `privacy.html` and `metrics.php`. Do not upload `.git`, `node_modules`, build tools, package files, source backups or credentials.

Upload the ZIP to the subscription home directory, then extract its contents into `/httpdocs` with overwrite enabled. Keep the release ZIP outside `httpdocs`. Check HTTPS, non-www preferred domain, redirects, random 404, all sitemap URLs and hashes against the release. If nginx serves static files directly, confirm that the Plesk hosting setting also redirects `www` to the preferred non-www domain. Confirm real PHP execution before enabling optional analytics; the metrics test event is isolated from production event totals.

## Rollback

Use the timestamped archive in the subscription home directory. Restore its `httpdocs` contents, preserving original paths and permissions. Files added in the SEO release must be moved to a nonpublic quarantine directory before restoration if reverting the entire release; do not recursively delete a computed path. Disable or quarantine only the known new locale/service/runtime files listed in the release manifest. Validate the original pages and both phone routes after restoration. Optional aggregate metrics live outside `httpdocs` in `private-acpro-metrics`, so restoring site files does not overwrite measurements.

## Search and measurement

Submit `https://acpro.kz/sitemap.xml` after owner verification in Google Search Console and Yandex Webmaster. Do not invent verification tokens, business addresses, hours, reviews or analytics IDs. The main domain stays on Hoster.kz; do not move its DNS to GitHub Pages. Any shutdown of the old Pages copy must be recorded separately from deployment; it removes the duplicate but is not a 301 migration.

Statistics require opt-in; no third-party analytics service is configured. Counters represent interactions, **not confirmed bookings**. Link actual WhatsApp conversations and bookings manually to the operating sales process until a separately authorized CRM integration is configured. Do not change the two existing enquiry routes.
