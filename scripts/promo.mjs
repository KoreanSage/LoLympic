#!/usr/bin/env node
/**
 * mimzy Promo Video Generator
 *
 * Usage:
 *   npm run promo                  → 새로운 밈만 생성
 *   npm run promo -- --all         → 전체 다시 생성
 *   npm run promo -- --post=ID     → 특정 밈 하나
 *   npm run promo -- --last=N      → 최근 N개
 */
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const prisma = new PrismaClient();
const DESKTOP = path.join(os.homedir(), 'Desktop');
const MUSIC_PATH = path.join(os.homedir(), 'Downloads', 'the_mountain-tiktok-453510.mp3');
const FFMPEG = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FFPROBE = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';

const W = 1080;
const H = 1920;

const FLAGS = { en: '🇺🇸', ko: '🇰🇷', ja: '🇯🇵', zh: '🇨🇳', es: '🇪🇸', hi: '🇮🇳', ar: '🇸🇦' };
const LANG_NAMES = { en: 'English', ko: '한국어', ja: '日本語', zh: '中文', es: 'Español', hi: 'हिन्दी', ar: 'العربية' };
const CTA_TEXTS = {
  ko: '밈 번역 보러가기', ja: 'ミーム翻訳を見る', es: 'Ver traducciones',
  zh: '查看翻译', hi: 'अनुवाद देखें', ar: 'شاهد الترجمة', en: 'See translations',
};

function escapeXml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ═══ FRAME BUILDER ═══
async function buildFrame({ memeBuffer, flag, title, subtitle, blur, showLogo, showCTA, ctaLang, hookBanner }) {
  const MEME_TOP = 380, MEME_BOT = H - 480;
  const MEME_H = MEME_BOT - MEME_TOP, MEME_W = W - 80;

  let memeResized = await sharp(memeBuffer)
    .resize(MEME_W, MEME_H, { fit: 'contain', background: { r: 12, g: 12, b: 12, alpha: 1 } })
    .png().toBuffer();
  const meta = await sharp(memeResized).metadata();
  const memeX = Math.round((W - meta.width) / 2);
  const memeY = MEME_TOP + Math.round((MEME_H - meta.height) / 2);

  if (blur) memeResized = await sharp(memeResized).blur(35).modulate({ brightness: 0.6 }).png().toBuffer();

  const borderSvg = `<svg width="${meta.width+6}" height="${meta.height+6}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${meta.width+6}" height="${meta.height+6}" rx="20" fill="none" stroke="#c9a84c" stroke-width="2" stroke-opacity="0.3"/></svg>`;

  const titleLen = (title||'').length;
  const titleFontSize = hookBanner ? 32 : (titleLen > 20 ? 28 : titleLen > 12 ? 32 : 36);
  const titleBgW = Math.min(W - 40, titleLen * titleFontSize * 0.55 + 80);

  let topSvg;
  if (hookBanner) {
    // Hook banner style — 밈 위에 바로 훅 텍스트, 첫 프레임부터 눈길
    topSvg = `<svg width="${W}" height="380" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0c0c0c;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#0c0c0c;stop-opacity:0"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="200" fill="url(#tg)"/>
      <text x="${W/2}" y="42" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-weight="bold" fill="#c9a84c" letter-spacing="5" fill-opacity="0.6">mimzy</text>

      <!-- Hook banner (large) -->
      <rect x="24" y="70" width="${W-48}" height="160" rx="18" fill="#c9a84c"/>
      <text x="${W/2}" y="135" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="900" fill="black" letter-spacing="0.5">${escapeXml(title||'')}</text>
      <text x="${W/2}" y="200" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="600" fill="black" fill-opacity="0.55">${escapeXml(subtitle||'')}</text>

      <!-- Flag pill -->
      <rect x="${W/2-65}" y="260" width="130" height="52" rx="26" fill="black" fill-opacity="0.7" stroke="#c9a84c" stroke-opacity="0.4" stroke-width="1.5"/>
      <text x="${W/2}" y="295" text-anchor="middle" font-size="34">${flag||''}</text>

      <line x1="80" y1="379" x2="${W-80}" y2="379" stroke="#333" stroke-opacity="0.3"/>
    </svg>`;
  } else {
    // Normal style
    topSvg = `<svg width="${W}" height="380" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="tg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#c9a84c;stop-opacity:0.08"/><stop offset="100%" style="stop-color:#0c0c0c;stop-opacity:0"/></linearGradient></defs>
      <rect width="${W}" height="80" fill="url(#tg)"/>
      <text x="${W/2}" y="52" text-anchor="middle" font-family="Georgia,serif" font-size="26" font-weight="bold" fill="#c9a84c" letter-spacing="6">mimzy</text>
      <line x1="${W/2-60}" y1="65" x2="${W/2+60}" y2="65" stroke="#c9a84c" stroke-opacity="0.3"/>
      <text x="${W/2}" y="170" text-anchor="middle" font-size="90">${flag||''}</text>
      ${title?`<rect x="${(W-titleBgW)/2}" y="${240-titleFontSize+2}" width="${titleBgW}" height="${titleFontSize+16}" rx="8" fill="black" fill-opacity="0.75"/>
      <text x="${W/2}" y="260" text-anchor="middle" font-family="Arial,sans-serif" font-size="${titleFontSize}" font-weight="700" fill="white" stroke="black" stroke-width="1" letter-spacing="1">${escapeXml(title)}</text>`:''}
      ${subtitle?`<rect x="${(W-titleBgW)/2}" y="290" width="${titleBgW}" height="30" rx="6" fill="black" fill-opacity="0.6"/>
      <text x="${W/2}" y="310" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#ccc">${escapeXml(subtitle)}</text>`:''}
      <line x1="80" y1="379" x2="${W-80}" y2="379" stroke="#333"/>
    </svg>`;
  }

  const botSvg = `<svg width="${W}" height="480" xmlns="http://www.w3.org/2000/svg">
    <line x1="80" y1="0" x2="${W-80}" y2="0" stroke="#333"/>
    ${blur?`<text x="${W/2}" y="200" text-anchor="middle" font-family="Georgia,serif" font-size="180" fill="#c9a84c" fill-opacity="0.15">?</text>
    <text x="${W/2}" y="200" text-anchor="middle" font-family="Georgia,serif" font-size="160" fill="#c9a84c" fill-opacity="0.8">?</text>`:''}
    ${showLogo?`<text x="${W/2}" y="120" text-anchor="middle" font-family="Georgia,serif" font-size="72" font-weight="bold" fill="#c9a84c" letter-spacing="10">mimzy</text>
    <line x1="${W/2-120}" y1="150" x2="${W/2+120}" y2="150" stroke="#c9a84c" stroke-opacity="0.5" stroke-width="2"/>
    <text x="${W/2}" y="195" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#888" letter-spacing="4">GLOBAL MEME PLATFORM</text>`:''}
    ${showCTA?`<rect x="${W/2-220}" y="${showLogo?240:80}" width="440" height="64" rx="32" fill="#c9a84c"/>
    <text x="${W/2}" y="${showLogo?280:120}" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="black">${CTA_TEXTS[ctaLang]||'mimzy.gg'} → mimzy.gg</text>
    <text x="${W/2}" y="${showLogo?355:195}" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#555">Different words. Same laugh.</text>`:''}</svg>`;

  const topBuf = await sharp(Buffer.from(topSvg)).resize(W, 380).png().toBuffer();
  const botBuf = await sharp(Buffer.from(botSvg)).resize(W, 480).png().toBuffer();
  const borderBuf = await sharp(Buffer.from(borderSvg)).png().toBuffer();

  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 12, g: 12, b: 12, alpha: 1 } } })
    .composite([
      { input: topBuf, top: 0, left: 0 },
      { input: memeResized, top: memeY, left: memeX },
      { input: borderBuf, top: memeY - 3, left: memeX - 3 },
      { input: botBuf, top: H - 480, left: 0 },
    ]).png().toBuffer();
}

// ═══ DOWNLOAD IMAGE ═══
async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ═══ INTRO FRAME BUILDER ═══
async function buildIntroFrame({ sourceLang, targetLang, sourceTitle }) {
  const sf = FLAGS[sourceLang] || '🌍';
  const tf = FLAGS[targetLang] || '🌍';
  const sn = LANG_NAMES[sourceLang] || sourceLang;
  const tn = LANG_NAMES[targetLang] || targetLang;

  // Thumb-stop hook texts — 궁금증 유발 "...ㅋㅋㅋ" 스타일
  const HOOK_TEXTS = {
    ko: `${sn} 밈을\n한국어로 바꿨더니...ㅋㅋㅋ`,
    ja: `${sn}のミームを\n日本語にしたら...www`,
    es: `Este meme en ${sn}\nal español...jajaja`,
    zh: `${sn}的梗\n翻译成中文之后...哈哈哈`,
    hi: `${sn} का मीम\nहिंदी में बदला तो...🤣`,
    ar: `ميم ${sn}\nبالعربي طلع...🤣`,
    en: `This ${sn} meme\nin English tho...😂`,
  };

  const hookText = HOOK_TEXTS[targetLang] || `${sn} → ${tn} 😂`;
  const hookLines = hookText.split('\n');

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#0c0c0c"/>

    <!-- mimzy logo small -->
    <text x="${W/2}" y="580" text-anchor="middle" font-family="Georgia,serif" font-size="40" font-weight="bold" fill="#c9a84c" letter-spacing="8">mimzy</text>

    <!-- Flags big -->
    <text x="${W/2}" y="730" text-anchor="middle" font-size="90">${sf} → ${tf}</text>

    <!-- HOOK TEXT — big, bold, with black bg box -->
    <rect x="60" y="820" width="${W-120}" height="${hookLines.length * 65 + 40}" rx="16" fill="black" fill-opacity="0.8" stroke="#c9a84c" stroke-opacity="0.3" stroke-width="1"/>
    ${hookLines.map((line, i) =>
      `<text x="${W/2}" y="${870 + i * 65}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="900" fill="white" stroke="black" stroke-width="2">${escapeXml(line)}</text>`
    ).join('\n    ')}

    <!-- Subtle tagline -->
    <text x="${W/2}" y="${900 + hookLines.length * 65 + 40}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="#555">mimzy.gg</text>
  </svg>`;

  return sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
}

// ═══ GENERATE VIDEO FOR ONE LANGUAGE ═══
async function generateLangVideo({ originalBuf, translatedBuf, sourceLang, targetLang, sourceTitle, translatedTitle, outputDir }) {
  const tmpDir = path.join(outputDir, '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const sf = FLAGS[sourceLang] || '🌍';
  const tf = FLAGS[targetLang] || '🌍';
  const tn = LANG_NAMES[targetLang] || targetLang;

  // Hook text — source language name localized per target audience
  const LANG_LOCAL = {
    ko: { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어', es: '스페인어', hi: '힌디어', ar: '아랍어' },
    en: { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese', es: 'Spanish', hi: 'Hindi', ar: 'Arabic' },
    ja: { ko: '韓国語', en: '英語', ja: '日本語', zh: '中国語', es: 'スペイン語', hi: 'ヒンディー語', ar: 'アラビア語' },
    zh: { ko: '韩语', en: '英语', ja: '日语', zh: '中文', es: '西班牙语', hi: '印地语', ar: '阿拉伯语' },
    es: { ko: 'coreano', en: 'inglés', ja: 'japonés', zh: 'chino', es: 'español', hi: 'hindi', ar: 'árabe' },
    hi: { ko: 'कोरियाई', en: 'अंग्रेज़ी', ja: 'जापानी', zh: 'चीनी', es: 'स्पेनिश', hi: 'हिंदी', ar: 'अरबी' },
    ar: { ko: 'كوري', en: 'إنجليزي', ja: 'ياباني', zh: 'صيني', es: 'إسباني', hi: 'هندي', ar: 'عربي' },
  };
  const srcName = LANG_LOCAL[targetLang]?.[sourceLang] || sourceLang;
  const HOOK_TEXTS = {
    ko: `${srcName} 밈을 한국어로 바꿨더니...ㅋㅋㅋ`,
    ja: `${srcName}のミームを日本語にしたら...www`,
    es: `Meme ${srcName} en español...jajaja`,
    zh: `${srcName}的梗翻译成中文...哈哈哈`,
    hi: `${srcName} मीम हिंदी में...`,
    ar: `ميم ${srcName} بالعربي...`,
    en: `This ${srcName} meme in English tho...`,
  };
  const hookText = HOOK_TEXTS[targetLang] || `${srcName} → ${tn}`;

  // Frame 1: Original with hook banner overlay (4s)
  const f1 = await buildFrame({ memeBuffer: originalBuf, flag: sf, title: hookText, subtitle: `${sf} Original  ·  mimzy.gg`, hookBanner: true });
  await sharp(f1).toFile(`${tmpDir}/01.png`);

  // Frame 2: Translated (5s — 충분히 읽을 시간)
  const f2 = await buildFrame({ memeBuffer: translatedBuf, flag: tf, title: translatedTitle || tn, subtitle: `${sf} → ${tf} ${tn}` });
  await sharp(f2).toFile(`${tmpDir}/02.png`);

  // Frame 3: Logo + CTA (3s)
  const f3 = await buildFrame({ memeBuffer: translatedBuf, flag: '', title: '', showLogo: true, showCTA: true, ctaLang: targetLang });
  await sharp(f3).toFile(`${tmpDir}/03.png`);

  // Compose video: original+hook(4s) → translated(5s) → CTA(3s)
  const videoTmp = `${tmpDir}/video.mp4`;
  const finalPath = path.join(outputDir, `${targetLang}_${tn}.mp4`);

  const vidCmd = `${FFMPEG} -y \
    -loop 1 -t 4.0 -framerate 30 -i "${tmpDir}/01.png" \
    -loop 1 -t 5.0 -framerate 30 -i "${tmpDir}/02.png" \
    -loop 1 -t 3.0 -framerate 30 -i "${tmpDir}/03.png" \
    -filter_complex "\
      [0][1]xfade=transition=slideleft:duration=0.5:offset=3.5[v1];\
      [v1][2]xfade=transition=fade:duration=0.4:offset=8.1[vout]" \
    -map "[vout]" -c:v libx264 -pix_fmt yuv420p -r 30 -preset fast -crf 18 "${videoTmp}" 2>&1`;
  execSync(vidCmd, { maxBuffer: 50 * 1024 * 1024, timeout: 30000 });

  // Add music
  const vidDur = execSync(`${FFPROBE} -v quiet -show_entries format=duration -of csv=p=0 "${videoTmp}"`).toString().trim();
  const fadeStart = (parseFloat(vidDur) - 1.5).toFixed(2);

  if (fs.existsSync(MUSIC_PATH)) {
    const mergeCmd = `${FFMPEG} -y -i "${videoTmp}" -i "${MUSIC_PATH}" -filter_complex "[1:a]atrim=0:${vidDur},afade=t=out:st=${fadeStart}:d=1.5,volume=0.8[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "${finalPath}" 2>&1`;
    execSync(mergeCmd, { maxBuffer: 50 * 1024 * 1024, timeout: 30000 });
  } else {
    fs.copyFileSync(videoTmp, finalPath);
  }

  // Cleanup tmp
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return finalPath;
}

// ═══ GENERATE CAPTIONS + TITLE ═══
function generateCaption({ sourceLang, targetLang, sourceTitle, translatedTitle }) {
  const sf = FLAGS[sourceLang] || '🌍';
  const tf = FLAGS[targetLang] || '🌍';
  const sn = LANG_NAMES[sourceLang] || sourceLang;

  const captions = {
    ko: `😂 ${sn} 밈을 한국어로 바꿨더니...ㅋㅋㅋ\n\n${sf} → ${tf}\n\n어떤 버전이 더 웃겨? 댓글로 알려줘 👇\n\n#mimzy #밈 #번역밈 #웃긴밈 #ㅋㅋㅋ #유머 #공감 #해외밈 #밈번역 #글로벌밈\n#meme #memes #translated #koreancontent #koreanmeme\n#한국 #대한민국 #일상 #웃긴영상 #추천\n\n🌍 전세계 밈을 한국어로 번역해주는 플랫폼\n👉 mimzy.gg`,
    ja: `😂 ${sn}のミームを日本語にしたら...www\n\n${sf} → ${tf}\n\nどっちが面白い？コメントで教えて 👇\n\n#mimzy #ミーム #面白い #笑える #翻訳ミーム #海外ミーム #翻訳 #爆笑\n#meme #memes #translated #japanesememe #日本語\n#おもしろ #ネタ #草 #www #バズり\n\n🌍 世界中のミームを日本語で\n👉 mimzy.gg`,
    es: `😂 Este meme en ${sn} al español...jajaja\n\n${sf} → ${tf}\n\n¿Cuál es más gracioso? Dime en los comentarios 👇\n\n#mimzy #memes #humor #momazos #gracioso #traduccion #memesespañol #viral\n#meme #translated #spanishmemes #comedia #risa\n#jajaja #memeslatinos #memesgraciosos #tendencia #parati\n\n🌍 Todos los memes del mundo en tu idioma\n👉 mimzy.gg`,
    zh: `😂 ${sn}的梗翻译成中文之后...哈哈哈\n\n${sf} → ${tf}\n\n哪个版本更搞笑？评论告诉我 👇\n\n#mimzy #梗 #翻译梗 #搞笑 #有趣 #段子 #表情包 #海外梗\n#meme #memes #translated #chinesememe #中文\n#哈哈哈 #笑死 #热门 #推荐 #好笑\n\n🌍 全世界的梗图翻译成中文\n👉 mimzy.gg`,
    hi: `😂 ${sn} का मीम हिंदी में बदला तो...🤣\n\n${sf} → ${tf}\n\nकौन सा वर्जन ज्यादा फनी? कमेंट करो 👇\n\n#mimzy #meme #hindi #funny #comedy #hindimemes #viral #trending\n#memes #translated #indianmemes #hindicontent\n#हिंदी #मीम #फनी #कॉमेडी #ट्रेंडिंग #वायरल\n\n🌍 दुनिया भर के मीम्स हिंदी में\n👉 mimzy.gg`,
    ar: `😂 ميم ${sn} بالعربي طلع...🤣\n\n${sf} → ${tf}\n\nأي نسخة أضحك؟ قولي بالكومنت 👇\n\n#mimzy #ميمز #مضحك #ترجمة #ميم #عربي #كوميديا #ضحك\n#meme #memes #translated #arabicmemes #viral\n#ميمز_عربي #اكسبلور #ترند #فيرال #مقاطع_مضحكة\n\n🌍 كل ميمات العالم بالعربي\n👉 mimzy.gg`,
    en: `😂 This ${sn} meme in English tho...😂\n\n${sf} → ${tf}\n\nWhich version is funnier? Tell me in the comments 👇\n\n#mimzy #memes #funny #translated #memetranslation #viral #comedy #globalmemes\n#meme #translatedmemes #internationalmemes #humor #lol #lmao\n#fyp #trending #explore #reels #memesdaily\n\n🌍 Every meme in every language\n👉 mimzy.gg`,
  };

  return captions[targetLang] || captions.en;
}

// ═══ GENERATE INSTA TITLE (릴스 제목) ═══
function generateTitle({ sourceLang, targetLang }) {
  const sn = LANG_NAMES[sourceLang] || sourceLang;
  const titles = {
    ko: `${sn} 밈을 한국어로 바꿨더니...ㅋㅋㅋ`,
    ja: `${sn}のミームを日本語にしたら...www`,
    es: `Este meme en ${sn} al español...jajaja`,
    zh: `${sn}的梗翻译成中文之后...哈哈哈`,
    hi: `${sn} का मीम हिंदी में...🤣`,
    ar: `ميم ${sn} بالعربي...🤣`,
    en: `This ${sn} meme in English tho...😂`,
  };
  return titles[targetLang] || `${sn} → ${LANG_NAMES[targetLang]} 😂`;
}

// ═══ MAIN ═══
async function main() {
  const args = process.argv.slice(2);
  let postId = null;
  let lastN = null;
  let all = false;

  for (const arg of args) {
    if (arg.startsWith('--post=')) postId = arg.split('=')[1];
    if (arg.startsWith('--last=')) lastN = parseInt(arg.split('=')[1]);
    if (arg === '--all') all = true;
  }

  // Find posts with translations
  const where = {
    status: 'PUBLISHED',
    translationPayloads: {
      some: { status: { in: ['COMPLETED', 'APPROVED'] }, translatedImageUrl: { not: null } },
    },
  };

  if (postId) where.id = postId;

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: lastN || (all ? 100 : 5),
    select: {
      id: true,
      title: true,
      sourceLanguage: true,
      reactionCount: true,
      images: { take: 1, select: { originalUrl: true } },
      author: { select: { username: true } },
      translationPayloads: {
        where: { status: { in: ['COMPLETED', 'APPROVED'] }, translatedImageUrl: { not: null } },
        select: { targetLanguage: true, translatedTitle: true, translatedImageUrl: true },
      },
    },
  });

  if (posts.length === 0) {
    console.log('❌ 프로모 생성할 밈이 없습니다.');
    return;
  }

  console.log(`\n🎬 mimzy promo generator`);
  console.log(`   ${posts.length}개 밈 × 각 언어별 영상 생성\n`);

  if (!fs.existsSync(MUSIC_PATH)) {
    console.log(`⚠️  음악 파일 없음 (${MUSIC_PATH})`);
    console.log(`   음악 없이 생성합니다.\n`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outRoot = path.join(DESKTOP, `mimzy-promo-${today}`);
  fs.mkdirSync(outRoot, { recursive: true });

  let totalVideos = 0;

  for (const post of posts) {
    const originalUrl = post.images[0]?.originalUrl;
    if (!originalUrl || post.translationPayloads.length === 0) continue;

    const postDir = path.join(outRoot, `${post.id.slice(-8)}_${post.title.slice(0, 20).replace(/[^a-zA-Z0-9가-힣]/g, '_')}`);
    fs.mkdirSync(postDir, { recursive: true });

    console.log(`📝 "${post.title}" (${post.sourceLanguage}, 🔥${post.reactionCount})`);
    console.log(`   번역: ${post.translationPayloads.map(t => FLAGS[t.targetLanguage] || t.targetLanguage).join(' ')}`);

    // Download original
    let originalBuf;
    try {
      originalBuf = await downloadImage(originalUrl);
    } catch (e) {
      console.log(`   ❌ 원본 이미지 다운로드 실패, 스킵`);
      continue;
    }

    for (const tp of post.translationPayloads) {
      process.stdout.write(`   ${FLAGS[tp.targetLanguage]} ${LANG_NAMES[tp.targetLanguage]}...`);

      try {
        // Download translated image
        const translatedBuf = await downloadImage(tp.translatedImageUrl);

        // Generate video
        const langDir = path.join(postDir, tp.targetLanguage);
        fs.mkdirSync(langDir, { recursive: true });

        await generateLangVideo({
          originalBuf,
          translatedBuf,
          sourceLang: post.sourceLanguage,
          targetLang: tp.targetLanguage,
          sourceTitle: post.title,
          translatedTitle: tp.translatedTitle,
          outputDir: langDir,
        });

        // Generate caption
        const caption = generateCaption({
          sourceLang: post.sourceLanguage,
          targetLang: tp.targetLanguage,
          sourceTitle: post.title,
          translatedTitle: tp.translatedTitle,
        });
        fs.writeFileSync(path.join(langDir, 'caption.txt'), caption);

        // Insta reel title
        const title = generateTitle({ sourceLang: post.sourceLanguage, targetLang: tp.targetLanguage });
        fs.writeFileSync(path.join(langDir, 'title.txt'), title);

        totalVideos++;
        console.log(' ✅');
      } catch (e) {
        console.log(` ❌ ${e.message?.slice(0, 50)}`);
      }
    }
    console.log('');
  }

  console.log(`\n✅ 완료! ${totalVideos}개 영상 생성`);
  console.log(`📁 ${outRoot}`);
  console.log(`\n💡 사용법:`);
  console.log(`   1. 폴더 열어서 영상 확인`);
  console.log(`   2. caption.txt 열어서 텍스트 복사`);
  console.log(`   3. 인스타/틱톡에 영상 업로드 + 캡션 붙여넣기`);
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
