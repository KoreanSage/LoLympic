# mimzy - Technical Documentation

## 1. Project Overview

**mimzy**은 AI 기반 글로벌 밈 번역 및 경쟁 플랫폼입니다.
각 나라의 밈을 7개 언어로 AI 번역하고, 국가별 리더보드에서 경쟁합니다.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Auth | NextAuth.js (Google OAuth + Credentials) |
| AI Translation | Google Gemini API (gemini-2.5-flash) |
| Storage | Cloudflare R2 (prod) / Local filesystem (dev) |
| Image Processing | Sharp |
| Styling | Tailwind CSS |
| Deployment | Vercel |

### Supported Languages
| Code | Language | Script Direction |
|------|----------|-----------------|
| ko | Korean | LTR |
| en | English | LTR |
| ja | Japanese | LTR |
| zh | Chinese | LTR |
| es | Spanish | LTR |
| hi | Hindi | LTR |
| ar | Arabic | RTL |

---

## 2. Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # 50+ API Routes
│   │   ├── translate/     # AI Translation (Gemini)
│   │   ├── posts/         # CRUD + engagement
│   │   ├── cron/          # Scheduled jobs
│   │   ├── admin/         # Admin endpoints
│   │   └── ...
│   ├── (main)/page.tsx    # Home/Feed
│   ├── post/[id]/         # Post detail
│   ├── leaderboard/       # Rankings
│   ├── tournament/        # Year-end bracket
│   └── ...
├── components/
│   ├── layout/            # TopNav, Sidebar, Footer
│   ├── post/              # PostDetail, Comments
│   ├── feed/              # FeedCard
│   ├── translation/       # MemeRenderer, SegmentEditor
│   ├── competition/       # LeaderboardTable, SeasonBar
│   ├── battle/            # BattleCard
│   └── ui/                # Reusable primitives
├── lib/
│   ├── auth-options.ts    # NextAuth config
│   ├── prisma.ts          # DB client
│   ├── ranking.ts         # HN-style scoring
│   ├── rate-limit.ts      # API rate limiting
│   ├── image-composer.ts  # SVG text overlay
│   └── notifications.ts   # Push notifications
└── i18n/
    └── locales/           # 7 language JSON files
```

### Data Flow
```
User uploads meme
  → POST /api/posts (image + title + sourceLanguage)
  → POST /api/upload (image → Cloudflare R2 / local)
  → POST /api/translate (Gemini API → segments + cultureNote)
  → TranslationPayload + TranslationSegment + CultureNote saved to DB
  → Feed shows translated title based on user's preferred language
```

---

## 3. Database Schema

### Core Models

**User**
- Profile (username, displayName, avatarUrl, bio)
- Settings (preferredLanguage, countryId, role)
- Roles: USER, MODERATOR, ADMIN, SUPER_ADMIN

**Post**
- title, body, sourceLanguage, category (meme/community)
- Cached counts: reactionCount, commentCount, translationCount, viewCount
- rankingScore (HN-style decay formula)
- Status: DRAFT → PROCESSING → PUBLISHED → HIDDEN → REMOVED

**PostImage**
- originalUrl: uploaded image
- cleanUrl: text-removed version (Gemini inpainting)
- width, height, mimeType

### Translation Models

**TranslationPayload** (1 per post per target language per version)
- sourceLanguage, targetLanguage, version
- translatedTitle, translatedBody
- translatedImageUrl (pre-rendered meme with translated text)
- memeType: A (overlay) / B (screenshot) / C (multi-panel) / TEXT
- confidence: 0.0-1.0
- creatorType: AI / COMMUNITY / ADMIN
- Status: PENDING → PROCESSING → COMPLETED → APPROVED → REJECTED → SUPERSEDED

**TranslationSegment** (1 per text region in meme)
- sourceText, translatedText
- semanticRole: HEADLINE, CAPTION, DIALOGUE, LABEL, WATERMARK, SUBTITLE, OVERLAY, OTHER
- Bounding box: boxX, boxY, boxWidth, boxHeight (normalized 0.0-1.0)
- Style: fontFamily, fontWeight, fontSizePixels, color, textAlign, strokeColor, strokeWidth, shadowColor

**CultureNote** (cultural context per language)
- summary: one-line context (in target language)
- explanation: detailed humor explanation (in target language)
- translationNote: translation decisions (in target language)

### Competition Models

**Season** - Annual competition (Jan 1 - Dec 31)
- Status: UPCOMING → ACTIVE → JUDGING → COMPLETED → ARCHIVED
- votingStartAt, votingEndAt (14-day judging period)
- championPostId (year-end winner)

**MonthlyWinner** - Top liked post each month
- Automatically selected by cron job on 1st of each month
- Feeds into year-end tournament bracket

**TournamentMatch** - Year-end bracket (Dec 27-31)
- 16 slots: 12 monthly winners + 4 wildcards
- Rounds: R16, QUARTERFINAL, SEMIFINAL, FINAL
- Community voting determines advancement

**Medal** - GOLD, SILVER, BRONZE
- Scopes: COUNTRY, CREATOR, MEME, TRANSLATOR, CULTURE_CONTRIBUTOR, EDITOR

**Battle** - 1v1 meme battles for engagement

### Engagement Models
- **PostReaction**: FIRE, LAUGH, SKULL, HEART, CRY
- **PostVote**: Upvote/downvote
- **Comment**: 2-depth threading with @mentions
- **Follow**: User follow relationships
- **PostSave**: Bookmarks

---

## 4. Translation System (Gemini AI)

### Translation Prompt Architecture

번역 시 Gemini에게 전달되는 시스템 프롬프트:

#### Language-Specific Instructions
| Language | Style Guide |
|----------|------------|
| Korean | 급식체, 신조어, rhythmic wordplay, compact sentences |
| Japanese | Subtle humor, ツッコミ/ボケ dynamics, visual puns, understatement |
| Chinese | 网络用语, four-character idioms, phonetic puns, minimal characters |
| English | Sarcasm, self-deprecation, absurdist escalation, internet-native |
| Spanish | Regional slang, diminutives, dramatic emotion, Latin Am vs Iberian |
| Hindi | Bollywood-influenced, Hinglish mix, filmi dialogues, street Hindi |
| Arabic | MSA + dialect (Egyptian/Gulf), internet expressions, casual |

#### Meme Type Detection
- **Type A (Overlay)**: Impact font captions → translate ONLY overlay text
- **Type B (Screenshot)**: Chat/post screenshots → translate ALL readable text
- **Type C (Multi-panel)**: Comics → translate all speech bubbles

#### Response Format
```json
{
  "memeType": "A|B|C",
  "segments": [{
    "sourceText": "original text",
    "translatedText": "transcendent translation",
    "semanticRole": "HEADLINE|CAPTION|...",
    "box": { "x": 0.0, "y": 0.0, "width": 0.5, "height": 0.1 },
    "style": { "fontFamily": "...", "fontSize": 24, "color": "#FFF", ... }
  }],
  "cultureNote": {
    "summary": "Cultural context (in target language)",
    "explanation": "Detailed explanation (in target language)",
    "translationNote": "Translation decisions (in target language)"
  },
  "confidence": 0.85
}
```

### Image Composition Pipeline
1. Original image → Gemini inpainting → **Clean image** (text removed)
2. Clean image + TranslationSegments → Sharp SVG overlay → **Translated image**
3. Font size auto-calculated based on CJK vs Latin character widths
4. Word wrapping, stroke, shadow effects for readability

---

## 5. Competition & Event System

### Season Lifecycle (연간)
```
Jan 1: Season opens (ACTIVE)
  ├── Monthly: Cron selects top-liked post as monthly winner
  ├── Users upload memes, earn reactions, compete on leaderboard
  └── Real-time country rankings update
Dec 31: Season closes → JUDGING (14-day voting)
  ├── Community votes on monthly winners
  └── Tournament bracket generated
Jan 14: COMPLETED
  └── Champion crowned, medals distributed
```

### Monthly Winner Selection (Cron: 1st of month, 00:05 UTC)
1. Query posts from previous month, sort by reactionCount
2. Select top post as MonthlyWinner
3. Assign to tournament bracket slot
4. Broadcast notification to all users

### Year-End Tournament (Dec 27-31)
| Date | Round | Matches |
|------|-------|---------|
| Dec 27-28 | R16 | 8 matches |
| Dec 29 | Quarterfinal | 4 matches |
| Dec 30 | Semifinal | 2 matches |
| Dec 31 | Final | 1 match |

### Ranking Formula (HN-style)
```
score = (reactions*2 + comments*3 + translations*5 + views*0.01) / (dayAge^1.2)
```

---

## 6. API Routes Reference

### Posts
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/posts | List with filters, pagination |
| POST | /api/posts | Create new post |
| GET | /api/posts/[id] | Post detail with translations |
| DELETE | /api/posts/[id] | Delete post |
| POST | /api/posts/[id]/reactions | Add reaction |
| POST | /api/posts/[id]/comments | Add comment |
| POST | /api/posts/[id]/vote | Upvote/downvote |

### Translation
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/translate | Full image translation (Gemini) |
| POST | /api/translate/text | Text-only translation |
| POST | /api/translate/title | On-demand title translation |
| POST | /api/translate/generate-image | Render translated meme image |

### Competition
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/leaderboard | Rankings (country/creator/meme/battle) |
| GET/POST | /api/seasons | Season management |
| POST | /api/seasons/vote | Final voting |
| POST | /api/tournament | Tournament voting |

### Cron Jobs (Bearer token auth)
| Method | Path | Schedule | Description |
|--------|------|----------|-------------|
| POST | /api/cron/season-check | Daily 00:10 UTC | Season transitions |
| POST | /api/cron/monthly-winner | 1st of month 00:05 UTC | Monthly winner selection |
| POST | /api/cron/tournament-advance | Manual/scheduled | Tournament round advancement |

---

## 7. Admin Guide

### Admin Dashboard (`/admin`)
- **Stats**: Users, posts, translations, monthly winners
- **Season Management**: Create/manage seasons, select monthly winners
- **User Management**: List users, change roles, view activity

### Admin's Ongoing Responsibilities

#### Daily
- [ ] Monitor reported content (comments, posts)
- [ ] Check translation quality for flagged posts
- [ ] Review new user signups for spam

#### Monthly
- [ ] Verify monthly winner selection (auto-selected by cron, can override)
- [ ] Review and approve community translation suggestions
- [ ] Check rate limit logs for abuse

#### Seasonally
- [ ] Create new season before January 1st (or let cron auto-create)
- [ ] Configure tournament wildcard slots (4 slots for non-monthly winners)
- [ ] Award medals and rewards after season completion
- [ ] Archive completed seasons

#### As Needed
- [ ] Manage user roles (promote moderators)
- [ ] Handle DMCA/copyright takedown requests
- [ ] Update seed data (new countries, language support)
- [ ] Monitor Gemini API usage and costs
- [ ] Review and update translation prompts for quality
- [ ] Configure Vercel cron schedules (vercel.json)

### Role Hierarchy
```
SUPER_ADMIN → Full access, can manage other admins
ADMIN       → Dashboard, user management, season control
MODERATOR   → Content moderation (hide/remove posts, comments)
USER        → Standard user features
```

---

## 8. Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=<32-byte-base64>
NEXTAUTH_URL=https://lolympic.app
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-secret>

# AI Translation
GEMINI_API_KEY=<google-generative-ai-key>

# Storage — Cloudflare R2 (falls back to local disk in dev)
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_ENDPOINT=<r2-endpoint>
R2_BUCKET_NAME=<r2-bucket>
R2_PUBLIC_URL=<r2-public-url>

# Cron Security
CRON_SECRET=<bearer-token-for-cron>

# App
NEXT_PUBLIC_APP_NAME=mimzy
NEXT_PUBLIC_APP_URL=https://lolympic.app
UPLOAD_DIR=./uploads  # dev only
```

---

## 9. Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| translate | 5 req | 1 min |
| upload | 20 req | 1 min |
| auth | 10 req | 1 min |
| write (posts, comments) | 30 req | 1 min |
| read (data fetches) | 120 req | 1 min |

---

## 10. Security

- **Headers**: X-Frame-Options DENY, HSTS 2yr, nosniff, strict referrer
- **Auth**: JWT sessions (30-day), bcrypt passwords
- **Validation**: Zod schemas on all API inputs
- **File Upload**: 10MB limit, JPEG/PNG/WebP/GIF only
- **Rate Limiting**: In-memory per-IP tracking
- **Protected Routes**: Middleware guards on /upload, /settings, /admin, etc.

---

## 11. Scripts

| Script | Usage | Description |
|--------|-------|-------------|
| `prisma/seed.ts` | `npx tsx prisma/seed.ts` | Seed 18 countries |
| `scripts/seed-memes.ts` | `npx tsx scripts/seed-memes.ts <folder>` | Create ~200 users, upload memes, generate engagement |
| `scripts/seed-translations.ts` | `npx tsx scripts/seed-translations.ts` | Translate all posts via Gemini (title + image) |
| `scripts/seed-culture-notes.ts` | `npx tsx scripts/seed-culture-notes.ts` | Generate culture notes for all posts |

### Script Options
```bash
# Translate with limits
npx tsx scripts/seed-translations.ts --limit 10 --title-only --concurrency 3

# Culture notes with limits
npx tsx scripts/seed-culture-notes.ts --limit 5
```

---

## 12. Deployment (Vercel)

### Auto-Deploy Flow
```
git push origin main → GitHub → Vercel detects → Build → Deploy → lolympic.app
```

### Cron Configuration (vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/season-check", "schedule": "10 0 * * *" },
    { "path": "/api/cron/monthly-winner", "schedule": "5 0 1 * *" }
  ]
}
```

### Domain Setup
| Type | Host | Value |
|------|------|-------|
| A Record | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |
