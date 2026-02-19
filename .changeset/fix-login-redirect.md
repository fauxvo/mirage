---
'mirage': patch
---

Fix post-login redirect to go to /dashboard instead of landing page

- Change default redirect after successful login from `/` to `/dashboard`
- Add debug logging to login API route for visibility with `DEBUG=true`
