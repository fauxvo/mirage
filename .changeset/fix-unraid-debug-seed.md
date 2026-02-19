---
'mirage': patch
---

Fix Unraid template variables not persisting, add DEBUG env var for production logging, and improve admin seed reliability.

- **Unraid template**: Move to `unraid/mirage.xml`, fix XML structure (full open/close tags instead of self-closing), add missing `<Shell>` and `<TemplateURL/>` fields
- **DEBUG env var**: Set `DEBUG=true` to enable verbose logging in production/Docker (previously all non-error logs were silenced)
- **Admin seed**: Fix `seeded` flag to only set after success (allows retry on error), add detailed logging for all seed outcomes
- **Docker entrypoint**: Print environment diagnostics at startup with masked secrets
- **Env var sync**: `DEBUG` and `SECURE_COOKIES` now consistent across `.env.example`, `docker-compose.yml`, `Dockerfile`, and Unraid template
