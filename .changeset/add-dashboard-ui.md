---
'mirage': minor
---

Add dashboard UI with sidebar navigation, account settings, and password change

- New `/dashboard` route with auth-protected layout and sidebar navigation
- Sections: My Sets (placeholder), API Keys (admin), Account, Users (admin), Usage (admin)
- Password change endpoint at `PUT /api/auth/password`
- Mobile-responsive hamburger menu
- Reuses existing admin components (ApiKeyList, AdminUserList)
