# mimzy 🏆

AI-powered global meme translation platform where countries compete through humor.

## What is mimzy?

Upload memes in your language, and AI automatically translates them into 7 languages — preserving cultural context and humor. Countries compete on leaderboards to crown the funniest nation.

## Supported Languages

| Icon | Language | Countries |
|------|----------|-----------|
| 한 | 한국어 | South Korea |
| A | English | USA, UK, Australia, Canada |
| あ | 日本語 | Japan |
| 字 | 中文 | China, Taiwan, Hong Kong |
| Ñ | Español | Mexico, Spain, Argentina, Colombia, Chile |
| अ | हिन्दी | India |
| ع | العربية | Saudi Arabia, Egypt, UAE |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Neon) + Prisma ORM
- **Auth**: NextAuth.js (Google OAuth + Credentials)
- **AI Translation**: Google Gemini API
- **Storage**: Cloudflare R2
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your .env values

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed countries
npx tsx prisma/seed.ts

# Run development server
npm run dev
```

## Features

- Multi-image meme upload (up to 10 images)
- AI-powered translation with cultural context preservation
- Culture notes explaining humor across languages
- Country leaderboards and seasonal competitions
- RTL support (Arabic)
- Full i18n UI (7 languages)
