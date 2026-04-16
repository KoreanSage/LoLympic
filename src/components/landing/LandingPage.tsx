"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Translation demo data (reused from HeroBanner)
// ---------------------------------------------------------------------------
const TRANSLATIONS = [
  { flag: "\uD83C\uDDFA\uD83C\uDDF8", lang: "EN", text: "When the code works on first try" },
  { flag: "\uD83C\uDDF0\uD83C\uDDF7", lang: "KO", text: "\uCF54\uB4DC\uAC00 \uD55C \uBC88\uC5D0 \uB420 \uB54C" },
  { flag: "\uD83C\uDDEF\uD83C\uDDF5", lang: "JA", text: "\u30B3\u30FC\u30C9\u304C\u4E00\u767A\u3067\u52D5\u3044\u305F\u6642" },
  { flag: "\uD83C\uDDE8\uD83C\uDDF3", lang: "ZH", text: "\u4EE3\u7801\u4E00\u6B21\u5C31\u8DD1\u901A\u7684\u65F6\u5019" },
  { flag: "\uD83C\uDDEA\uD83C\uDDF8", lang: "ES", text: "Cuando el c\u00F3digo funciona a la primera" },
  { flag: "\uD83C\uDDEE\uD83C\uDDF3", lang: "HI", text: "Jab code pehli baar mein chal jaye" },
  { flag: "\uD83C\uDDF8\uD83C\uDDE6", lang: "AR", text: "\u0644\u0645\u0627 \u0627\u0644\u0643\u0648\u062F \u064A\u0634\u062A\u063A\u0644 \u0645\u0646 \u0623\u0648\u0644 \u0645\u0631\u0629" },
];

const FLAGS = ["\uD83C\uDDF0\uD83C\uDDF7", "\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDEF\uD83C\uDDF5", "\uD83C\uDDE8\uD83C\uDDF3", "\uD83C\uDDEA\uD83C\uDDF8", "\uD83C\uDDEE\uD83C\uDDF3", "\uD83C\uDDF8\uD83C\uDDE6", "\uD83C\uDDF2\uD83C\uDDFD", "\uD83C\uDDEC\uD83C\uDDE7", "\uD83C\uDDE6\uD83C\uDDFA", "\uD83C\uDDE8\uD83C\uDDE6", "\uD83C\uDDEA\uD83C\uDDEC"];

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------
function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setCount(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FeaturedPost {
  id: string;
  title: string;
  imageUrl: string | null;
  translatedImageUrl: string | null;
  reactionCount: number;
  commentCount: number;
  author: string;
  country: { name: string; flag: string } | null;
}

interface PlatformStats {
  posts: number;
  translations: number;
  users: number;
  countries: number;
  languages: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LandingPage() {
  const { t } = useTranslation();
  const [activeIdx, setActiveIdx] = useState(0);
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([]);
  const [stats, setStats] = useState<PlatformStats>({ posts: 0, translations: 0, users: 0, countries: 0, languages: 7 });

  // Cycle translation demo
  useEffect(() => {
    const timer = setInterval(() => setActiveIdx((p) => (p + 1) % TRANSLATIONS.length), 2000);
    return () => clearInterval(timer);
  }, []);

  // Fetch public data
  useEffect(() => {
    fetch("/api/public/stats").then(r => r.json()).then(setStats).catch(() => {});
    fetch("/api/public/featured-posts").then(r => r.json()).then(d => setFeaturedPosts(d.posts || [])).catch(() => {});
  }, []);

  const statCounters = [
    useCountUp(stats.posts),
    useCountUp(stats.translations),
    useCountUp(stats.countries),
    useCountUp(stats.users),
  ];
  const statLabels = [
    t("landing.stats.posts"),
    t("landing.stats.translations"),
    t("landing.stats.countries"),
    t("landing.stats.users"),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight">
            <span className="text-foreground">mi</span>
            <span className="text-[#c9a84c]">mzy</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors px-3 py-1.5">
              {t("landing.login")}
            </Link>
            <Link href="/signup" className="text-sm font-bold px-4 py-1.5 rounded-lg bg-[#c9a84c] text-black hover:bg-[#d4b85e] transition-colors">
              {t("landing.signup")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Section 1: Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#c9a84c]/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#c9a84c]/8 rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 leading-tight">
            <span className="bg-gradient-to-r from-[#c9a84c] via-[#e8d5a0] to-[#c9a84c] bg-clip-text text-transparent">
              Your Memes. 7 Languages.
            </span>
            <br />
            <span className="text-foreground">One Global Stage.</span>
          </h1>
          <p className="text-lg md:text-xl text-foreground-muted mb-10 max-w-2xl mx-auto">
            {t("hero.subtitle")}
          </p>

          {/* Translation Demo Card */}
          <div className="max-w-md mx-auto mb-10">
            <div className="bg-background-surface/80 backdrop-blur border border-border rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{TRANSLATIONS[0].flag}</span>
                <span className="text-xs font-medium text-foreground-subtle uppercase tracking-wider">Original</span>
              </div>
              <p className="text-sm md:text-base text-foreground font-medium mb-3 pb-3 border-b border-border">
                {TRANSLATIONS[0].text}
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-[#c9a84c]">AI translating...</span>
              </div>
              <div className="relative h-[52px] overflow-hidden">
                {TRANSLATIONS.slice(1).map((tr, i) => (
                  <div
                    key={tr.lang}
                    className={`absolute inset-0 flex items-start gap-2 transition-all duration-500 ${
                      i === activeIdx - 1 || (activeIdx === 0 && i === TRANSLATIONS.length - 2)
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-3"
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">{tr.flag}</span>
                    <div>
                      <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-wider">{tr.lang}</span>
                      <p className="text-sm md:text-base text-foreground font-medium">{tr.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-[#c9a84c] text-black text-base md:text-lg font-bold hover:bg-[#d4b85c] active:bg-[#b8973f] transition-all shadow-[0_0_30px_rgba(201,168,76,0.3)] hover:shadow-[0_0_40px_rgba(201,168,76,0.5)] hover:scale-[1.02]"
          >
            {t("hero.cta")}
          </Link>
        </div>
      </section>

      {/* ── Section 2: How It Works ─────────────────────────────────────── */}
      <section className="py-20 md:py-28 border-t border-border/50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-16">
            {t("landing.howItWorks")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              { step: "01", icon: "\uD83D\uDCF7", titleKey: "landing.step1.title" as const, descKey: "landing.step1.desc" as const },
              { step: "02", icon: "\uD83C\uDF10", titleKey: "landing.step2.title" as const, descKey: "landing.step2.desc" as const },
              { step: "03", icon: "\uD83C\uDFC6", titleKey: "landing.step3.title" as const, descKey: "landing.step3.desc" as const },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-background-surface border border-border flex items-center justify-center text-3xl group-hover:border-[#c9a84c]/40 group-hover:shadow-[0_0_20px_rgba(201,168,76,0.1)] transition-all">
                  {item.icon}
                </div>
                <div className="text-xs font-bold text-[#c9a84c] mb-2">{item.step}</div>
                <h3 className="text-lg font-bold mb-2">{t(item.titleKey)}</h3>
                <p className="text-sm text-foreground-muted">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Trending Memes ───────────────────────────────────── */}
      {featuredPosts.length > 0 && (
        <section className="py-20 md:py-28 border-t border-border/50 bg-background-surface/30">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
              {t("landing.showcase.title")}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featuredPosts.slice(0, 4).map((post) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="group rounded-xl overflow-hidden border border-border bg-background-surface hover:border-[#c9a84c]/40 transition-all hover:shadow-lg"
                >
                  {post.imageUrl && (
                    <div className="aspect-square overflow-hidden bg-background-elevated">
                      <img
                        src={post.translatedImageUrl || post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium truncate mb-1">{post.title}</p>
                    <div className="flex items-center gap-3 text-xs text-foreground-subtle">
                      <span>\uD83D\uDD25 {post.reactionCount}</span>
                      <span>\uD83D\uDCAC {post.commentCount}</span>
                    </div>
                    {post.country && (
                      <div className="text-xs text-foreground-subtle mt-1">
                        {post.country.flag} {post.author}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Section 4: Country Leaderboard ──────────────────────────────── */}
      <section className="py-20 md:py-28 border-t border-border/50">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            {t("landing.leaderboard.title")}
          </h2>
          <LeaderboardPreview />
        </div>
      </section>

      {/* ── Section 5: Stats ────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 border-t border-border/50 bg-background-surface/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {statCounters.map((counter, i) => (
              <div key={i} ref={counter.ref} className="text-center">
                <div className="text-4xl md:text-5xl font-black text-[#c9a84c] mb-1">
                  {counter.count > 0 ? `${counter.count.toLocaleString()}+` : "..."}
                </div>
                <div className="text-sm text-foreground-muted font-medium">{statLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: Final CTA ────────────────────────────────────────── */}
      <section className="py-24 md:py-32 border-t border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#c9a84c]/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#c9a84c]/8 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black mb-4">
            {t("landing.cta.title")}
          </h2>
          <p className="text-lg text-foreground-muted mb-10">
            {t("landing.cta.subtitle")}
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-[#c9a84c] text-black text-base md:text-lg font-bold hover:bg-[#d4b85c] active:bg-[#b8973f] transition-all shadow-[0_0_30px_rgba(201,168,76,0.3)] hover:shadow-[0_0_40px_rgba(201,168,76,0.5)] hover:scale-[1.02]"
          >
            {t("landing.cta.button")}
          </Link>

          {/* Flag marquee */}
          <div className="overflow-hidden h-8 mt-12">
            <div className="flex gap-4 animate-[marquee_25s_linear_infinite] whitespace-nowrap">
              {[...FLAGS, ...FLAGS].map((flag, i) => (
                <span key={i} className="text-xl opacity-30">{flag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="py-8 border-t border-border text-center text-xs text-foreground-subtle">
        <p>mimzy &mdash; Your Memes. 7 Languages. One Global Stage.</p>
      </footer>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard Preview (fetches from existing public leaderboard API)
// ---------------------------------------------------------------------------
function LeaderboardPreview() {
  const [leaders, setLeaders] = useState<Array<{ name: string; flag: string; score: number }>>([]);

  useEffect(() => {
    fetch("/api/leaderboard?limit=5")
      .then(r => r.json())
      .then(data => {
        const countries = (data.countries || data || []).slice(0, 5);
        setLeaders(countries.map((c: any) => ({
          name: c.name || c.countryName || "",
          flag: c.flagEmoji || c.flag || "",
          score: c.totalScore || c.score || 0,
        })));
      })
      .catch(() => {});
  }, []);

  if (leaders.length === 0) return null;
  const maxScore = Math.max(...leaders.map(l => l.score), 1);

  return (
    <div className="space-y-3">
      {leaders.map((leader, i) => (
        <div key={leader.name} className="flex items-center gap-4">
          <span className={`text-lg font-black w-8 text-center ${i === 0 ? "text-[#ffd700]" : i === 1 ? "text-[#c0c0c0]" : i === 2 ? "text-[#cd7f32]" : "text-foreground-subtle"}`}>
            {i + 1}
          </span>
          <span className="text-xl">{leader.flag}</span>
          <span className="text-sm font-medium flex-shrink-0 w-28">{leader.name}</span>
          <div className="flex-1 h-3 bg-background-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#c9a84c] to-[#e8d5a0] rounded-full transition-all duration-1000"
              style={{ width: `${(leader.score / maxScore) * 100}%` }}
            />
          </div>
          <span className="text-sm font-bold text-[#c9a84c] w-16 text-right">{leader.score.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}
