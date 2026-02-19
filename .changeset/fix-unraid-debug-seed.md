---
'mirage': patch
---

Fix Unraid template variables not persisting, add DEBUG env var for production logging, and improve admin seed reliability.

- **Unraid template**: Move to `unraid/mirage.xml`, fix XML structure (full open/close tags instead of self-closing), add missing `<Shell>` and `<TemplateURL/>` fields
- **DEBUG env var**: Set `DEBUG=true` to enable verbose logging in production/Docker (previously all non-error logs were silenced)
- **Admin seed**: Fix `seeded` flag to only set after success (allows retry on error), add detailed logging for all seed outcomes
- **Docker entrypoint**: Print environment diagnostics at startup with masked secrets
- **Env var sync**: `DEBUG` now consistent across `.env.example`, `docker-compose.yml`, `Dockerfile`, and Unraid template

**Note for HTTPS users:** The Unraid template now explicitly defaults `SECURE_COOKIES=false` for HTTP self-hosting. The `docker-compose.yml` preserves the previous auto-detect behavior (empty = `true` in production). If you access Mirage over HTTPS via a reverse proxy and use the Unraid template, set `SECURE_COOKIES=true` in your container config.
