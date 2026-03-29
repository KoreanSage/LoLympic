# mimzy Admin Operations Guide

## Daily Tasks

### 1. Check Site Health (1 min)
- Visit https://lolympic.app — feed loads, images display
- Check Vercel dashboard for deployment errors
- Check Neon DB dashboard for connection issues

### 2. Review Uploaded Content (5 min)
- Visit Admin panel: https://lolympic.app/admin
- Check for reported posts (Reports tab)
- Remove inappropriate content (sets status to REMOVED, not hard delete)
- Check for spam accounts

---

## Weekly Tasks

### 1. Check Translation Quality
- Browse feed in different languages (Settings > Language)
- Look for bad translations or broken overlays
- Re-trigger translation for problematic posts via Admin panel

### 2. Monitor Engagement
- Check Leaderboard for activity levels
- Check if new countries are joining
- Look at comment/reaction counts to spot trends

### 3. Social Media
- Share top memes of the week on social channels
- Engage with community feedback

---

## Monthly Tasks

### 1. Monthly Winner Selection (Auto on 1st of month)
The cron job at `/api/cron/monthly-winner` runs automatically on the 1st at 00:05 UTC.

**If cron doesn't fire** (Vercel Hobby plan limitation), trigger manually:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://lolympic.app/api/cron/monthly-winner
```

**Verify winner was selected:**
- Visit /seasons page — check if new month has a winner frame
- Check notifications — all users should see "Monthly Winner" notification

### 2. Season Health Check
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://lolympic.app/api/cron/season-check
```
This ensures season status transitions happen correctly.

---

## Seasonal Tasks

### End of Year (December)

#### Tournament Setup (Dec 25-26)
1. Fill wildcard slots if needed:
```bash
curl -X POST https://lolympic.app/api/tournament \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_ADMIN_SESSION" \
  -d '{"action": "fill-wildcards", "seasonId": "SEASON_ID"}'
```

2. Verify bracket at /tournament page

#### Tournament Voting (Dec 27-31)
- Dec 27-28: Round of 16 voting
- Dec 29: Quarterfinals
- Dec 30: Semifinals
- Dec 31: Final

Advance rounds manually if cron doesn't fire:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://lolympic.app/api/cron/tournament-advance
```

#### Season Finalization (Jan 1)
Finalize the season (awards medals, marks champion):
```bash
curl -X POST https://lolympic.app/api/seasons/finalize \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_ADMIN_SESSION" \
  -d '{"seasonId": "SEASON_ID"}'
```

#### New Season Setup (Jan 1)
The cron job auto-creates a new season. If not:
```bash
curl -X POST https://lolympic.app/api/seasons \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_ADMIN_SESSION" \
  -d '{"name": "Season 2", "year": 2027}'
```

---

## Environment Variables (Vercel)

| Variable | Where to Get | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon dashboard | Yes |
| `NEXTAUTH_SECRET` | Generate random string | Yes |
| `NEXTAUTH_URL` | `https://lolympic.app` | Yes |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | Yes (for OAuth) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Yes (for OAuth) |
| `GEMINI_API_KEY` | Google AI Studio | Yes (for translation) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Storage > Blob | Yes (for image upload) |
| `CRON_SECRET` | Generate random string | Yes (for cron jobs) |

---

## Admin API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/admin/reports` | GET | Admin | List reported content |
| `/api/admin/reports` | PATCH | Admin | Resolve reports |
| `/api/admin/users` | GET | Admin | List/search users |
| `/api/admin/users` | PATCH | Admin | Update user roles |
| `/api/seasons` | POST | Admin | Create new season |
| `/api/seasons/monthly-winner` | POST | Admin | Manual winner selection |
| `/api/seasons/finalize` | POST | Admin | Finalize season |
| `/api/tournament` | POST | Admin | Manage tournament bracket |
| `/api/cron/monthly-winner` | GET | CRON_SECRET | Trigger monthly winner |
| `/api/cron/season-check` | GET | CRON_SECRET | Trigger season check |
| `/api/cron/tournament-advance` | GET | CRON_SECRET | Advance tournament |

---

## Troubleshooting

### "Translation not showing"
1. Check if post has `translationPayloads` in DB
2. Check user's `preferredLanguage` in settings
3. Try switching Original/Translated toggle
4. Re-trigger translation from Admin panel

### "Images not loading"
1. Check Vercel Blob storage dashboard
2. Verify `BLOB_READ_WRITE_TOKEN` is set
3. Check if image URL returns 200

### "Login not working"
1. Check Google OAuth credentials in Vercel env vars
2. Verify `NEXTAUTH_URL` matches the domain
3. Check Neon DB connection (user table exists)

### "Cron jobs not running"
1. Vercel Hobby: only 1 cron per day. Upgrade to Pro for all 3.
2. Manual trigger with curl commands above
3. Check `CRON_SECRET` is set in Vercel env vars

### "Site is slow"
1. Check Neon DB dashboard for connection pool exhaustion
2. Check Vercel function logs for timeouts
3. Consider upgrading to Vercel Pro (60s → 300s function timeout)

---

## First Week Checklist
- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Upload 20+ seed memes from different countries
- [ ] Trigger translation for all posts
- [ ] Share on social media (Reddit, Twitter, Discord)
- [ ] Invite friends from 5+ countries
- [ ] Monitor error logs in Vercel dashboard
- [ ] Check translation quality in 3+ languages
- [ ] Make yourself SUPER_ADMIN in DB
