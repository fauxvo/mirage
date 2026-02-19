---
'mirage': patch
---

Fix SQLITE_READONLY errors and seed race condition in Docker/Unraid deployments

- Run database migrations as `nextjs` user via `su-exec` so the SQLite file is created with correct ownership (was running as root, causing SQLITE_READONLY for the server process)
- Replace boolean seed guard with promise singleton pattern to prevent concurrent `ensureAdminSeeded()` calls from racing through the async gap and seeding twice
- Simplify `chown` in entrypoint (directory only, no `-R` or error suppression)
