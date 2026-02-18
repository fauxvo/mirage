---
'mirage': minor
---

Add per-user API key management with usage tracking and rate limiting

- Replace legacy MIRAGE_API_KEY env var with DB-managed API keys
- Per-user key CRUD: users manage their own keys, admins see all
- Usage tracking: log requests to api_usage table with response times
- In-memory sliding window rate limiting (100 req/min per key)
- Admin usage dashboard with period selector and per-key stats
- New routes: /api/keys (user), /api/admin/usage (admin)
- API key IDs changed from integer auto-increment to text (nanoid)
