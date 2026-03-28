// ── Legal & Rules content for all supported languages ────────────────────────
// This is a standalone content file — NOT part of the i18n key system.
// Each language has full professional translations of all legal text.

export type LegalLang = "ko" | "en" | "ja" | "zh" | "es" | "hi" | "ar";

interface LegalBlock {
  title: string;
  content: string;
  list?: string[];
}

interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

interface LegalContent {
  pageTitle: string;
  lastUpdated: string;
  sections: {
    terms: LegalSection;
    privacy: LegalSection;
    copyright: LegalSection;
    cookies: LegalSection;
  };
  contact: {
    title: string;
    legalInquiries: string;
    dmcaNotices: string;
    generalSupport: string;
  };
  nav: {
    terms: string;
    privacy: string;
    copyright: string;
    cookies: string;
  };
  footer: {
    communityRules: string;
    settings: string;
  };
}

interface RuleItem {
  title: string;
  description: string;
}

interface EnforcementLevel {
  level: string;
  action: string;
}

interface RulesContent {
  pageTitle: string;
  subtitle: string;
  rules: RuleItem[];
  enforcement: {
    title: string;
    levels: EnforcementLevel[];
  };
  footer: {
    questionsText: string;
    termsLink: string;
    privacyLink: string;
    settingsLink: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENGLISH
// ═══════════════════════════════════════════════════════════════════════════════

const legalEN: LegalContent = {
  pageTitle: "Legal",
  lastUpdated: "Last updated: March 2026",
  nav: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    copyright: "Copyright & DMCA",
    cookies: "Cookies",
  },
  sections: {
    terms: {
      title: "Terms of Service",
      blocks: [
        {
          title: "1. Acceptance of Terms",
          content:
            'By accessing or using mimzy ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
        },
        {
          title: "2. Eligibility",
          content:
            "You must be at least 13 years old to use mimzy. If you are under 18, you must have parental or guardian consent. By using the Service, you represent that you meet these requirements.",
        },
        {
          title: "3. User Accounts",
          content:
            "You are responsible for maintaining the security of your account credentials. You must not share your account with others. You are responsible for all activity under your account. Notify us immediately of any unauthorized access.",
        },
        {
          title: "4. User Content",
          content:
            "You retain ownership of content you upload. By posting content, you grant mimzy a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content on the platform. You represent that you have the right to share any content you upload.",
        },
        {
          title: "5. AI Translation",
          content:
            "mimzy uses AI to automatically translate meme content across languages. Translations are provided as-is and may not perfectly capture cultural nuances. Community members may suggest improved translations. mimzy is not responsible for inaccuracies in AI-generated translations.",
        },
        {
          title: "6. Prohibited Conduct",
          content:
            "You may not: upload illegal content; harass other users; spam or flood the platform; attempt to manipulate votes or leaderboards; circumvent bans or restrictions; use automated tools to scrape or bulk-upload content; impersonate other users or entities.",
        },
        {
          title: "7. Termination",
          content:
            "We may suspend or terminate your account at our discretion for violations of these terms or community rules. You may delete your account at any time through Settings.",
        },
        {
          title: "8. Disclaimer",
          content:
            'The Service is provided "as is" without warranties of any kind. We do not guarantee uptime, accuracy of translations, or preservation of content. Use the Service at your own risk.',
        },
        {
          title: "9. Changes to Terms",
          content:
            "We may update these terms at any time. Continued use of the Service after changes constitutes acceptance. We will notify users of material changes via the platform.",
        },
        {
          title: "10. Age Restriction",
          content:
            "You must be at least 13 years old to use mimzy. By using our platform, you confirm that you meet this age requirement.",
        },
        {
          title: "11. Governing Law",
          content:
            "These terms are governed by the laws of Republic of Korea. Any disputes will be resolved in the courts of Seoul, Republic of Korea.",
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      blocks: [
        {
          title: "1. Information We Collect",
          content:
            "Account Data: email address, username, display name, and profile information you provide.\n\nContent Data: memes you upload, translations, comments, votes, and other interactions.\n\nUsage Data: IP address, browser type, device information, pages visited, and actions taken on the platform.",
        },
        {
          title: "2. How We Use Your Information",
          content:
            "We use your information to: provide and improve the Service; process AI translations; personalize your experience; send notifications you've opted into; enforce our rules and terms; analyze usage patterns to improve the platform.",
        },
        {
          title: "3. Data Sharing",
          content:
            "We do not sell your personal information. We may share data with: AI service providers (for translation processing); hosting and infrastructure providers; law enforcement when required by law. Your public profile and posted content are visible to all users.",
        },
        {
          title: "4. Data Retention",
          content:
            "Account data is retained while your account is active. You may request deletion of your account and associated data through Settings. Some data may be retained for legal compliance purposes.",
        },
        {
          title: "5. Cookies",
          content:
            "We use essential cookies for authentication and session management. We use analytics cookies to understand platform usage. You can manage cookie preferences in your browser settings.",
        },
        {
          title: "6. Your Rights",
          content:
            "You have the right to: access your personal data; correct inaccurate data; delete your account and data; export your data; opt out of non-essential communications.",
        },
        {
          title: "7. Security",
          content:
            "We implement industry-standard security measures to protect your data. However, no system is 100% secure. Report security vulnerabilities to support@mimzy.app.",
        },
      ],
    },
    copyright: {
      title: "Copyright & DMCA Policy",
      blocks: [
        {
          title: "1. Intellectual Property",
          content:
            "mimzy respects intellectual property rights. Users retain copyright over their original content. AI-generated translations are provided as a service and do not transfer copyright.",
        },
        {
          title: "2. Meme Fair Use",
          content:
            "Many memes incorporate copyrighted images used transformatively for commentary, parody, or criticism. mimzy supports the fair use doctrine but cannot provide legal advice on individual cases. Users are responsible for ensuring their uploads comply with applicable copyright law.",
        },
        {
          title: "3. DMCA Takedown Process",
          content:
            "If you believe content on mimzy infringes your copyright, submit a DMCA takedown notice to support@mimzy.app including:",
          list: [
            "Identification of the copyrighted work",
            "URL of the infringing content on mimzy",
            "Your contact information",
            "A statement of good faith belief that the use is not authorized",
            "A statement under penalty of perjury that the information is accurate",
            "Your physical or electronic signature",
          ],
        },
        {
          title: "4. Counter-Notification",
          content:
            "If your content was removed and you believe it was a mistake, you may submit a counter-notification. We will restore the content within 10-14 business days unless the copyright holder files a court action.",
        },
        {
          title: "5. Repeat Infringers",
          content:
            "Accounts with repeated copyright violations will be terminated. Three valid DMCA strikes result in permanent account removal.",
        },
        {
          title: "6. Translation Copyright",
          content:
            "AI-generated translations are a derivative service. Original meme creators retain rights over their source content. Community-contributed translation improvements are licensed under the same terms as other user content (see Terms of Service, Section 4).",
        },
      ],
    },
    cookies: {
      title: "Cookie Policy",
      blocks: [
        {
          title: "1. What Are Cookies",
          content:
            "Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and improve your experience. Some cookies are essential for the site to function, while others help us understand how you use the platform.",
        },
        {
          title: "2. Cookies We Use",
          content:
            "We use the following cookies and local storage items:\n\nAuthentication: NextAuth session cookie — essential for login. This cookie is required for the Service to function and cannot be disabled.\n\nTheme Preference: localStorage — remembers your dark/light mode selection so the interface matches your preference on return visits.\n\nCookie Consent: localStorage — remembers your cookie choice so you are not asked again on every visit.",
        },
        {
          title: "3. Third-Party Cookies",
          content: "We do not use any third-party tracking cookies or analytics.",
        },
        {
          title: "4. Managing Cookies",
          content:
            "You can manage or delete cookies through your browser settings. Note that disabling essential cookies may affect your ability to use our services.",
        },
      ],
    },
  },
  contact: {
    title: "Contact Information",
    legalInquiries: "Legal inquiries:",
    dmcaNotices: "DMCA notices:",
    generalSupport: "General support:",
  },
  footer: {
    communityRules: "Community Rules",
    settings: "Settings",
  },
};

const rulesEN: RulesContent = {
  pageTitle: "Community Rules",
  subtitle:
    "mimzy is a global platform for sharing and translating memes across languages and cultures. These rules help keep our community fun, safe, and welcoming for everyone.",
  rules: [
    {
      title: "Be Respectful",
      description:
        "Treat all community members with respect. No personal attacks, harassment, bullying, or hate speech of any kind. We celebrate humor from every culture.",
    },
    {
      title: "Original Content Only",
      description:
        "Upload memes you created or have rights to share. Do not claim someone else's work as your own. If you're sharing an existing meme, credit the original creator.",
    },
    {
      title: "No Harmful Content",
      description:
        "Do not post content that promotes violence, illegal activities, self-harm, or exploitation. Memes should be fun, not harmful.",
    },
    {
      title: "No Spam or Self-Promotion",
      description:
        "Do not post repetitive content, advertisements, or use the platform solely for promoting external products or services.",
    },
    {
      title: "Translation Quality",
      description:
        "When suggesting translation edits, aim for cultural accuracy. Translations should capture the spirit and humor, not just literal meaning. Respect the nuances of each language.",
    },
    {
      title: "Appropriate Tagging",
      description:
        "Use accurate categories and tags for your memes. Misleading tags hurt discoverability and the community experience.",
    },
    {
      title: "Respect Cultural Differences",
      description:
        "Humor varies across cultures. What's funny in one culture may be offensive in another. Engage with curiosity and openness, not judgment.",
    },
    {
      title: "Report, Don't Retaliate",
      description:
        "If you see rule-breaking content, use the report button. Do not engage in arguments or retaliate. Let moderators handle it.",
    },
  ],
  enforcement: {
    title: "Enforcement",
    levels: [
      { level: "First Offense", action: "Warning via notification" },
      { level: "Second Offense", action: "Content removal + 24-hour posting restriction" },
      { level: "Third Offense", action: "7-day account suspension" },
      { level: "Severe Violation", action: "Permanent ban (no warnings for hate speech, illegal content, etc.)" },
    ],
  },
  footer: {
    questionsText: "Questions about these rules? Contact us at support@mimzy.app",
    termsLink: "Terms of Service",
    privacyLink: "Privacy Policy",
    settingsLink: "Settings",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// KOREAN
// ═══════════════════════════════════════════════════════════════════════════════

const legalKO: LegalContent = {
  pageTitle: "법적 고지",
  lastUpdated: "최종 업데이트: 2026년 3월",
  nav: {
    terms: "이용약관",
    privacy: "개인정보처리방침",
    copyright: "저작권 및 DMCA",
    cookies: "쿠키 정책",
  },
  sections: {
    terms: {
      title: "이용약관",
      blocks: [
        {
          title: "1. 약관 동의",
          content:
            'mimzy("서비스")에 접속하거나 이용함으로써 귀하는 본 이용약관에 동의하게 됩니다. 동의하지 않으시는 경우 서비스를 이용하지 마십시오.',
        },
        {
          title: "2. 이용 자격",
          content:
            "mimzy을 이용하려면 만 13세 이상이어야 합니다. 만 18세 미만인 경우 부모 또는 보호자의 동의가 필요합니다. 서비스를 이용함으로써 귀하는 이러한 요건을 충족함을 보증합니다.",
        },
        {
          title: "3. 사용자 계정",
          content:
            "귀하는 계정 인증 정보의 보안을 유지할 책임이 있습니다. 계정을 타인과 공유해서는 안 됩니다. 귀하의 계정에서 발생하는 모든 활동에 대해 귀하가 책임집니다. 무단 접근이 발생한 경우 즉시 알려주십시오.",
        },
        {
          title: "4. 사용자 콘텐츠",
          content:
            "귀하가 업로드한 콘텐츠의 소유권은 귀하에게 있습니다. 콘텐츠를 게시함으로써 귀하는 mimzy에 플랫폼에서 해당 콘텐츠를 사용, 표시, 복제 및 배포할 수 있는 전 세계적, 비독점적, 무상의 라이선스를 부여합니다. 귀하는 업로드하는 모든 콘텐츠를 공유할 권리가 있음을 보증합니다.",
        },
        {
          title: "5. AI 번역",
          content:
            "mimzy은 AI를 사용하여 밈 콘텐츠를 여러 언어로 자동 번역합니다. 번역은 있는 그대로 제공되며 문화적 뉘앙스를 완벽하게 포착하지 못할 수 있습니다. 커뮤니티 회원은 개선된 번역을 제안할 수 있습니다. mimzy은 AI 생성 번역의 부정확성에 대해 책임지지 않습니다.",
        },
        {
          title: "6. 금지 행위",
          content:
            "다음 행위는 금지됩니다: 불법 콘텐츠 업로드, 다른 사용자 괴롭힘, 플랫폼 스팸 또는 도배, 투표 또는 리더보드 조작 시도, 차단 또는 제한 우회, 자동화 도구를 사용한 스크래핑 또는 대량 업로드, 다른 사용자 또는 단체 사칭.",
        },
        {
          title: "7. 이용 해지",
          content:
            "당사는 본 약관 또는 커뮤니티 규칙 위반 시 재량에 따라 귀하의 계정을 정지하거나 해지할 수 있습니다. 귀하는 설정에서 언제든지 계정을 삭제할 수 있습니다.",
        },
        {
          title: "8. 면책 조항",
          content:
            '서비스는 어떠한 종류의 보증 없이 "있는 그대로" 제공됩니다. 가동 시간, 번역의 정확성 또는 콘텐츠 보존을 보장하지 않습니다. 서비스 이용에 따른 위험은 귀하가 부담합니다.',
        },
        {
          title: "9. 약관 변경",
          content:
            "당사는 언제든지 본 약관을 업데이트할 수 있습니다. 변경 후 서비스를 계속 이용하면 변경 사항에 동의한 것으로 간주됩니다. 중요한 변경 사항은 플랫폼을 통해 사용자에게 알려드립니다.",
        },
        {
          title: "10. 연령 제한",
          content:
            "mimzy을 이용하려면 만 13세 이상이어야 합니다. 플랫폼을 이용함으로써 귀하는 이 연령 요건을 충족함을 확인합니다.",
        },
        {
          title: "11. 준거법",
          content:
            "본 약관은 대한민국 법률에 의해 규율됩니다. 모든 분쟁은 대한민국 서울의 법원에서 해결됩니다.",
        },
      ],
    },
    privacy: {
      title: "개인정보처리방침",
      blocks: [
        {
          title: "1. 수집하는 정보",
          content:
            "계정 데이터: 귀하가 제공하는 이메일 주소, 사용자 이름, 표시 이름 및 프로필 정보.\n\n콘텐츠 데이터: 귀하가 업로드하는 밈, 번역, 댓글, 투표 및 기타 상호작용.\n\n이용 데이터: IP 주소, 브라우저 유형, 기기 정보, 방문한 페이지 및 플랫폼에서 수행한 활동.",
        },
        {
          title: "2. 정보 이용 방법",
          content:
            "당사는 귀하의 정보를 다음 목적으로 사용합니다: 서비스 제공 및 개선, AI 번역 처리, 사용자 경험 맞춤화, 옵트인한 알림 전송, 규칙 및 약관 시행, 플랫폼 개선을 위한 이용 패턴 분석.",
        },
        {
          title: "3. 데이터 공유",
          content:
            "당사는 귀하의 개인정보를 판매하지 않습니다. 다음과 데이터를 공유할 수 있습니다: AI 서비스 제공업체(번역 처리용), 호스팅 및 인프라 제공업체, 법적 요구 시 법 집행 기관. 귀하의 공개 프로필 및 게시된 콘텐츠는 모든 사용자에게 표시됩니다.",
        },
        {
          title: "4. 데이터 보관",
          content:
            "계정 데이터는 계정이 활성 상태인 동안 보관됩니다. 설정에서 계정 및 관련 데이터의 삭제를 요청할 수 있습니다. 일부 데이터는 법적 준수 목적으로 보관될 수 있습니다.",
        },
        {
          title: "5. 쿠키",
          content:
            "당사는 인증 및 세션 관리를 위해 필수 쿠키를 사용합니다. 플랫폼 이용 현황을 파악하기 위해 분석 쿠키를 사용합니다. 브라우저 설정에서 쿠키 환경설정을 관리할 수 있습니다.",
        },
        {
          title: "6. 귀하의 권리",
          content:
            "귀하는 다음 권리를 가집니다: 개인 데이터 열람, 부정확한 데이터 수정, 계정 및 데이터 삭제, 데이터 내보내기, 비필수 커뮤니케이션 수신 거부.",
        },
        {
          title: "7. 보안",
          content:
            "당사는 귀하의 데이터를 보호하기 위해 업계 표준 보안 조치를 시행합니다. 그러나 어떠한 시스템도 100% 안전하지는 않습니다. 보안 취약점은 support@mimzy.app으로 신고해 주십시오.",
        },
      ],
    },
    copyright: {
      title: "저작권 및 DMCA 정책",
      blocks: [
        {
          title: "1. 지적 재산권",
          content:
            "mimzy은 지적 재산권을 존중합니다. 사용자는 자신의 원본 콘텐츠에 대한 저작권을 보유합니다. AI 생성 번역은 서비스로 제공되며 저작권을 이전하지 않습니다.",
        },
        {
          title: "2. 밈의 공정 이용",
          content:
            "많은 밈은 논평, 패러디 또는 비평을 위해 변형적으로 사용된 저작권 이미지를 포함합니다. mimzy은 공정 이용 원칙을 지지하지만 개별 사례에 대한 법적 조언을 제공할 수 없습니다. 사용자는 업로드한 콘텐츠가 해당 저작권법을 준수하는지 확인할 책임이 있습니다.",
        },
        {
          title: "3. DMCA 삭제 절차",
          content:
            "mimzy의 콘텐츠가 귀하의 저작권을 침해한다고 판단되는 경우, 다음을 포함하여 support@mimzy.app으로 DMCA 삭제 통지를 제출해 주십시오:",
          list: [
            "저작권이 있는 저작물의 식별",
            "mimzy에서 침해 콘텐츠의 URL",
            "귀하의 연락처 정보",
            "해당 이용이 허가되지 않았다는 선의의 진술",
            "정보가 정확하다는 위증 처벌 하의 진술",
            "귀하의 실제 또는 전자 서명",
          ],
        },
        {
          title: "4. 이의 신청",
          content:
            "귀하의 콘텐츠가 삭제되었으나 실수라고 판단되는 경우, 이의 신청서를 제출할 수 있습니다. 저작권자가 법적 조치를 취하지 않는 한 10-14 영업일 이내에 콘텐츠를 복원합니다.",
        },
        {
          title: "5. 반복 침해자",
          content:
            "반복적으로 저작권을 침해하는 계정은 해지됩니다. 유효한 DMCA 신고 3회 시 영구적으로 계정이 삭제됩니다.",
        },
        {
          title: "6. 번역 저작권",
          content:
            "AI 생성 번역은 파생 서비스입니다. 원본 밈 창작자는 자신의 소스 콘텐츠에 대한 권리를 보유합니다. 커뮤니티가 기여한 번역 개선 사항은 다른 사용자 콘텐츠와 동일한 약관으로 라이선스됩니다(이용약관 제4조 참조).",
        },
      ],
    },
    cookies: {
      title: "쿠키 정책",
      blocks: [
        {
          title: "1. 쿠키란?",
          content:
            "쿠키는 웹사이트를 방문할 때 기기에 저장되는 작은 텍스트 파일입니다. 사이트가 귀하의 기본 설정을 기억하고 경험을 개선하는 데 도움이 됩니다. 일부 쿠키는 사이트 작동에 필수적이며, 다른 쿠키는 플랫폼 이용 방식을 이해하는 데 도움이 됩니다.",
        },
        {
          title: "2. 사용하는 쿠키",
          content:
            "당사는 다음 쿠키 및 로컬 스토리지 항목을 사용합니다:\n\n인증: NextAuth 세션 쿠키 — 로그인에 필수적입니다. 이 쿠키는 서비스 작동에 필요하며 비활성화할 수 없습니다.\n\n테마 기본 설정: localStorage — 다크/라이트 모드 선택을 기억하여 재방문 시 인터페이스가 귀하의 기본 설정과 일치하도록 합니다.\n\n쿠키 동의: localStorage — 쿠키 선택을 기억하여 매번 방문할 때마다 묻지 않도록 합니다.",
        },
        {
          title: "3. 서드파티 쿠키",
          content: "당사는 서드파티 추적 쿠키나 분석 도구를 사용하지 않습니다.",
        },
        {
          title: "4. 쿠키 관리",
          content:
            "브라우저 설정에서 쿠키를 관리하거나 삭제할 수 있습니다. 필수 쿠키를 비활성화하면 서비스 이용에 영향을 줄 수 있습니다.",
        },
      ],
    },
  },
  contact: {
    title: "연락처 정보",
    legalInquiries: "법적 문의:",
    dmcaNotices: "DMCA 통지:",
    generalSupport: "일반 지원:",
  },
  footer: {
    communityRules: "커뮤니티 규칙",
    settings: "설정",
  },
};

const rulesKO: RulesContent = {
  pageTitle: "커뮤니티 규칙",
  subtitle:
    "mimzy은 다양한 언어와 문화를 넘어 밈을 공유하고 번역하는 글로벌 플랫폼입니다. 이 규칙은 모든 사람에게 재미있고 안전하며 환영받는 커뮤니티를 유지하는 데 도움이 됩니다.",
  rules: [
    {
      title: "서로 존중하기",
      description:
        "모든 커뮤니티 회원을 존중하십시오. 어떠한 형태의 인신 공격, 괴롭힘, 따돌림, 혐오 발언도 허용되지 않습니다. 우리는 모든 문화의 유머를 소중히 여깁니다.",
    },
    {
      title: "원본 콘텐츠만 업로드",
      description:
        "직접 만들었거나 공유할 권리가 있는 밈만 업로드하십시오. 다른 사람의 작품을 자신의 것으로 주장하지 마십시오. 기존 밈을 공유하는 경우 원작자를 표시하십시오.",
    },
    {
      title: "유해 콘텐츠 금지",
      description:
        "폭력, 불법 활동, 자해 또는 착취를 조장하는 콘텐츠를 게시하지 마십시오. 밈은 재미있어야 하며 해롭지 않아야 합니다.",
    },
    {
      title: "스팸 및 자기 홍보 금지",
      description:
        "반복적인 콘텐츠, 광고를 게시하거나 외부 제품 또는 서비스를 홍보하는 목적으로만 플랫폼을 사용하지 마십시오.",
    },
    {
      title: "번역 품질",
      description:
        "번역 수정을 제안할 때 문화적 정확성을 추구하십시오. 번역은 단순한 직역이 아닌 정신과 유머를 담아야 합니다. 각 언어의 뉘앙스를 존중하십시오.",
    },
    {
      title: "적절한 태그 사용",
      description:
        "밈에 정확한 카테고리와 태그를 사용하십시오. 잘못된 태그는 검색 가능성과 커뮤니티 경험을 저해합니다.",
    },
    {
      title: "문화적 차이 존중",
      description:
        "유머는 문화마다 다릅니다. 한 문화에서 재미있는 것이 다른 문화에서는 불쾌할 수 있습니다. 판단이 아닌 호기심과 개방성으로 참여하십시오.",
    },
    {
      title: "신고하되 보복하지 않기",
      description:
        "규칙 위반 콘텐츠를 발견하면 신고 버튼을 사용하십시오. 논쟁에 참여하거나 보복하지 마십시오. 운영팀이 처리하도록 맡기십시오.",
    },
  ],
  enforcement: {
    title: "제재 조치",
    levels: [
      { level: "1차 위반", action: "알림을 통한 경고" },
      { level: "2차 위반", action: "콘텐츠 삭제 + 24시간 게시 제한" },
      { level: "3차 위반", action: "7일 계정 정지" },
      { level: "중대한 위반", action: "영구 차단 (혐오 발언, 불법 콘텐츠 등에 대한 경고 없음)" },
    ],
  },
  footer: {
    questionsText: "규칙에 대한 질문이 있으신가요? support@mimzy.app으로 문의하세요",
    termsLink: "이용약관",
    privacyLink: "개인정보처리방침",
    settingsLink: "설정",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// JAPANESE
// ═══════════════════════════════════════════════════════════════════════════════

const legalJA: LegalContent = {
  pageTitle: "法的事項",
  lastUpdated: "最終更新日：2026年3月",
  nav: {
    terms: "利用規約",
    privacy: "プライバシーポリシー",
    copyright: "著作権とDMCA",
    cookies: "クッキーポリシー",
  },
  sections: {
    terms: {
      title: "利用規約",
      blocks: [
        {
          title: "1. 規約への同意",
          content:
            'mimzy（「本サービス」）にアクセスまたは使用することにより、お客様はこの利用規約に拘束されることに同意するものとします。同意されない場合は、本サービスを使用しないでください。',
        },
        {
          title: "2. 利用資格",
          content:
            "mimzyを使用するには13歳以上である必要があります。18歳未満の場合は、保護者の同意が必要です。本サービスを使用することにより、お客様はこれらの要件を満たしていることを表明するものとします。",
        },
        {
          title: "3. ユーザーアカウント",
          content:
            "お客様はアカウント認証情報のセキュリティを維持する責任があります。アカウントを他者と共有してはなりません。お客様のアカウントで行われるすべての活動について責任を負います。不正アクセスが発生した場合は直ちにお知らせください。",
        },
        {
          title: "4. ユーザーコンテンツ",
          content:
            "お客様がアップロードしたコンテンツの所有権はお客様に帰属します。コンテンツを投稿することにより、お客様はmimzyに対し、プラットフォーム上でコンテンツを使用、表示、複製、配布するための全世界的、非独占的、無償のライセンスを付与するものとします。お客様はアップロードするすべてのコンテンツを共有する権利を有していることを表明するものとします。",
        },
        {
          title: "5. AI翻訳",
          content:
            "mimzyはAIを使用してミームコンテンツを複数の言語に自動翻訳します。翻訳は現状のまま提供され、文化的なニュアンスを完全に捉えられない場合があります。コミュニティメンバーは改善された翻訳を提案することができます。mimzyはAI生成翻訳の不正確さについて責任を負いません。",
        },
        {
          title: "6. 禁止行為",
          content:
            "以下の行為は禁止されています：違法コンテンツのアップロード、他のユーザーへの嫌がらせ、プラットフォームへのスパムまたはフラッド、投票やリーダーボードの操作の試み、禁止や制限の回避、自動化ツールによるスクレイピングや大量アップロード、他のユーザーや団体のなりすまし。",
        },
        {
          title: "7. 利用停止",
          content:
            "当社は、本規約またはコミュニティルールの違反に対し、当社の裁量でお客様のアカウントを停止または終了することができます。お客様は設定からいつでもアカウントを削除できます。",
        },
        {
          title: "8. 免責事項",
          content:
            '本サービスはいかなる種類の保証もなく「現状のまま」提供されます。稼働時間、翻訳の正確性、またはコンテンツの保存を保証するものではありません。本サービスの使用はお客様自身のリスクで行ってください。',
        },
        {
          title: "9. 規約の変更",
          content:
            "当社はいつでもこの規約を更新することができます。変更後の本サービスの継続使用は、変更への同意を構成するものとします。重要な変更についてはプラットフォームを通じてユーザーに通知します。",
        },
        {
          title: "10. 年齢制限",
          content:
            "mimzyを使用するには13歳以上である必要があります。当プラットフォームを使用することにより、お客様はこの年齢要件を満たしていることを確認するものとします。",
        },
        {
          title: "11. 準拠法",
          content:
            "本規約は大韓民国の法律に準拠します。すべての紛争は大韓民国ソウルの裁判所で解決されるものとします。",
        },
      ],
    },
    privacy: {
      title: "プライバシーポリシー",
      blocks: [
        {
          title: "1. 収集する情報",
          content:
            "アカウントデータ：お客様が提供するメールアドレス、ユーザー名、表示名、プロフィール情報。\n\nコンテンツデータ：アップロードするミーム、翻訳、コメント、投票、その他のインタラクション。\n\n利用データ：IPアドレス、ブラウザの種類、デバイス情報、訪問したページ、プラットフォームで行ったアクション。",
        },
        {
          title: "2. 情報の利用方法",
          content:
            "当社はお客様の情報を以下の目的で使用します：サービスの提供と改善、AI翻訳の処理、お客様の体験のパーソナライズ、オプトインした通知の送信、ルールと規約の施行、プラットフォーム改善のための利用パターンの分析。",
        },
        {
          title: "3. データの共有",
          content:
            "当社はお客様の個人情報を販売しません。以下とデータを共有する場合があります：AIサービスプロバイダー（翻訳処理用）、ホスティングおよびインフラストラクチャプロバイダー、法律で要求される場合の法執行機関。お客様の公開プロフィールと投稿コンテンツはすべてのユーザーに表示されます。",
        },
        {
          title: "4. データの保持",
          content:
            "アカウントデータはアカウントがアクティブな間保持されます。設定からアカウントおよび関連データの削除を要求できます。一部のデータは法的遵守の目的で保持される場合があります。",
        },
        {
          title: "5. クッキー",
          content:
            "当社は認証とセッション管理のために必須クッキーを使用します。プラットフォームの利用状況を把握するために分析クッキーを使用します。ブラウザの設定でクッキーの設定を管理できます。",
        },
        {
          title: "6. お客様の権利",
          content:
            "お客様は以下の権利を有します：個人データへのアクセス、不正確なデータの修正、アカウントとデータの削除、データのエクスポート、不要な通信のオプトアウト。",
        },
        {
          title: "7. セキュリティ",
          content:
            "当社はお客様のデータを保護するために業界標準のセキュリティ対策を実施しています。ただし、100%安全なシステムは存在しません。セキュリティの脆弱性はsupport@mimzy.appまでご報告ください。",
        },
      ],
    },
    copyright: {
      title: "著作権とDMCAポリシー",
      blocks: [
        {
          title: "1. 知的財産権",
          content:
            "mimzyは知的財産権を尊重します。ユーザーはオリジナルコンテンツの著作権を保持します。AI生成翻訳はサービスとして提供され、著作権は移転されません。",
        },
        {
          title: "2. ミームのフェアユース",
          content:
            "多くのミームは、論評、パロディ、または批評のために変形的に使用された著作権画像を含みます。mimzyはフェアユースの原則を支持しますが、個別のケースについて法的助言を提供することはできません。アップロードするコンテンツが該当する著作権法に準拠していることを確認する責任はユーザーにあります。",
        },
        {
          title: "3. DMCA削除手続き",
          content:
            "mimzy上のコンテンツがお客様の著作権を侵害していると思われる場合は、以下を含むDMCA削除通知をsupport@mimzy.appに提出してください：",
          list: [
            "著作権のある著作物の特定",
            "mimzy上の侵害コンテンツのURL",
            "お客様の連絡先情報",
            "使用が許可されていないという誠実な信念の声明",
            "情報が正確であるという偽証罪に基づく声明",
            "お客様の物理的または電子的な署名",
          ],
        },
        {
          title: "4. 異議申し立て",
          content:
            "コンテンツが削除され、それが間違いであると思われる場合は、異議申し立てを提出することができます。著作権者が法的措置を取らない限り、10〜14営業日以内にコンテンツを復元します。",
        },
        {
          title: "5. 反復侵害者",
          content:
            "繰り返し著作権を侵害するアカウントは終了されます。有効なDMCA申立て3回で永久的にアカウントが削除されます。",
        },
        {
          title: "6. 翻訳の著作権",
          content:
            "AI生成翻訳は派生サービスです。オリジナルのミーム作成者はソースコンテンツに対する権利を保持します。コミュニティが貢献した翻訳の改善は、他のユーザーコンテンツと同じ条件でライセンスされます（利用規約第4条参照）。",
        },
      ],
    },
    cookies: {
      title: "クッキーポリシー",
      blocks: [
        {
          title: "1. クッキーとは",
          content:
            "クッキーは、ウェブサイトを訪問した際にお客様のデバイスに保存される小さなテキストファイルです。サイトがお客様の設定を記憶し、体験を向上させるのに役立ちます。一部のクッキーはサイトの機能に不可欠であり、その他のクッキーはプラットフォームの利用方法を理解するのに役立ちます。",
        },
        {
          title: "2. 使用するクッキー",
          content:
            "当社は以下のクッキーおよびローカルストレージ項目を使用します：\n\n認証：NextAuthセッションクッキー — ログインに必須です。このクッキーはサービスの機能に必要であり、無効にすることはできません。\n\nテーマ設定：localStorage — ダーク/ライトモードの選択を記憶し、再訪問時にインターフェースがお客様の設定に合致するようにします。\n\nクッキー同意：localStorage — クッキーの選択を記憶し、訪問のたびに確認されないようにします。",
        },
        {
          title: "3. サードパーティクッキー",
          content: "当社はサードパーティのトラッキングクッキーやアナリティクスを使用していません。",
        },
        {
          title: "4. クッキーの管理",
          content:
            "ブラウザの設定からクッキーを管理または削除できます。必須クッキーを無効にすると、サービスの利用に影響を与える可能性があります。",
        },
      ],
    },
  },
  contact: {
    title: "お問い合わせ",
    legalInquiries: "法的お問い合わせ：",
    dmcaNotices: "DMCA通知：",
    generalSupport: "一般サポート：",
  },
  footer: {
    communityRules: "コミュニティルール",
    settings: "設定",
  },
};

const rulesJA: RulesContent = {
  pageTitle: "コミュニティルール",
  subtitle:
    "mimzyは、言語と文化を超えてミームを共有し翻訳するグローバルプラットフォームです。これらのルールは、すべての人にとって楽しく安全で歓迎されるコミュニティを維持するのに役立ちます。",
  rules: [
    {
      title: "敬意を持って接する",
      description:
        "すべてのコミュニティメンバーに敬意を持って接してください。いかなる形態の個人攻撃、嫌がらせ、いじめ、ヘイトスピーチも許容されません。私たちはすべての文化のユーモアを大切にします。",
    },
    {
      title: "オリジナルコンテンツのみ",
      description:
        "自分で作成したか、共有する権利を持つミームのみをアップロードしてください。他人の作品を自分のものとして主張しないでください。既存のミームを共有する場合は、オリジナルの作成者をクレジットしてください。",
    },
    {
      title: "有害コンテンツの禁止",
      description:
        "暴力、違法行為、自傷行為、搾取を助長するコンテンツを投稿しないでください。ミームは楽しいものであるべきで、有害であってはなりません。",
    },
    {
      title: "スパムや自己宣伝の禁止",
      description:
        "反復的なコンテンツや広告を投稿したり、外部の製品やサービスの宣伝のみを目的としてプラットフォームを使用したりしないでください。",
    },
    {
      title: "翻訳の品質",
      description:
        "翻訳の編集を提案する際は、文化的な正確さを目指してください。翻訳は単なる直訳ではなく、精神とユーモアを捉えるべきです。各言語のニュアンスを尊重してください。",
    },
    {
      title: "適切なタグ付け",
      description:
        "ミームに正確なカテゴリーとタグを使用してください。誤ったタグは、発見性とコミュニティ体験を損ないます。",
    },
    {
      title: "文化の違いを尊重する",
      description:
        "ユーモアは文化によって異なります。ある文化で面白いことが、別の文化では不快に感じることがあります。判断ではなく、好奇心と開放性を持って参加してください。",
    },
    {
      title: "報告し、報復しない",
      description:
        "ルール違反のコンテンツを見つけた場合は、報告ボタンを使用してください。論争に巻き込まれたり、報復したりしないでください。モデレーターに対処を任せてください。",
    },
  ],
  enforcement: {
    title: "措置",
    levels: [
      { level: "初回違反", action: "通知による警告" },
      { level: "2回目の違反", action: "コンテンツの削除 + 24時間の投稿制限" },
      { level: "3回目の違反", action: "7日間のアカウント停止" },
      { level: "重大な違反", action: "永久禁止（ヘイトスピーチ、違法コンテンツなどに対する警告なし）" },
    ],
  },
  footer: {
    questionsText: "ルールについてご質問がありますか？ support@mimzy.appまでお問い合わせください",
    termsLink: "利用規約",
    privacyLink: "プライバシーポリシー",
    settingsLink: "設定",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHINESE (Simplified)
// ═══════════════════════════════════════════════════════════════════════════════

const legalZH: LegalContent = {
  pageTitle: "法律条款",
  lastUpdated: "最后更新：2026年3月",
  nav: {
    terms: "服务条款",
    privacy: "隐私政策",
    copyright: "版权与DMCA",
    cookies: "Cookie政策",
  },
  sections: {
    terms: {
      title: "服务条款",
      blocks: [
        {
          title: "1. 条款接受",
          content:
            '访问或使用mimzy（"本服务"），即表示您同意受本服务条款的约束。如果您不同意，请勿使用本服务。',
        },
        {
          title: "2. 使用资格",
          content:
            "您必须年满13周岁才能使用mimzy。如果您未满18周岁，必须获得父母或监护人的同意。使用本服务即表示您声明满足这些要求。",
        },
        {
          title: "3. 用户账户",
          content:
            "您有责任维护账户凭证的安全。不得与他人共享您的账户。您对账户下的所有活动负责。如发现任何未经授权的访问，请立即通知我们。",
        },
        {
          title: "4. 用户内容",
          content:
            "您保留所上传内容的所有权。发布内容即表示您授予mimzy在平台上使用、展示、复制和分发您内容的全球性、非排他性、免版税的许可。您声明有权分享您上传的所有内容。",
        },
        {
          title: "5. AI翻译",
          content:
            "mimzy使用AI自动翻译表情包内容。翻译按原样提供，可能无法完全捕捉文化细微差别。社区成员可以建议改进翻译。mimzy对AI生成翻译的不准确性不承担责任。",
        },
        {
          title: "6. 禁止行为",
          content:
            "您不得：上传非法内容；骚扰其他用户；对平台发送垃圾信息或刷屏；试图操纵投票或排行榜；规避封禁或限制；使用自动化工具抓取或批量上传内容；冒充其他用户或实体。",
        },
        {
          title: "7. 终止",
          content:
            "我们可能会因违反本条款或社区规则而自行决定暂停或终止您的账户。您可以随时通过设置删除您的账户。",
        },
        {
          title: "8. 免责声明",
          content:
            '本服务按"原样"提供，不作任何形式的保证。我们不保证正常运行时间、翻译准确性或内容保存。使用本服务的风险由您自行承担。',
        },
        {
          title: "9. 条款变更",
          content:
            "我们可以随时更新这些条款。变更后继续使用本服务即构成接受。我们将通过平台通知用户重大变更。",
        },
        {
          title: "10. 年龄限制",
          content:
            "您必须年满13周岁才能使用mimzy。使用我们的平台即表示您确认满足此年龄要求。",
        },
        {
          title: "11. 适用法律",
          content:
            "本条款受大韩民国法律管辖。任何争议将在大韩民国首尔的法院解决。",
        },
      ],
    },
    privacy: {
      title: "隐私政策",
      blocks: [
        {
          title: "1. 我们收集的信息",
          content:
            "账户数据：您提供的电子邮件地址、用户名、显示名称和个人资料信息。\n\n内容数据：您上传的表情包、翻译、评论、投票和其他互动。\n\n使用数据：IP地址、浏览器类型、设备信息、访问的页面以及在平台上的操作。",
        },
        {
          title: "2. 信息使用方式",
          content:
            "我们使用您的信息来：提供和改进服务；处理AI翻译；个性化您的体验；发送您已选择接收的通知；执行我们的规则和条款；分析使用模式以改进平台。",
        },
        {
          title: "3. 数据共享",
          content:
            "我们不会出售您的个人信息。我们可能与以下各方共享数据：AI服务提供商（用于翻译处理）；托管和基础设施提供商；法律要求时的执法机构。您的公开个人资料和发布的内容对所有用户可见。",
        },
        {
          title: "4. 数据保留",
          content:
            "账户数据在您的账户处于活跃状态期间保留。您可以通过设置请求删除账户和相关数据。部分数据可能因法律合规目的而保留。",
        },
        {
          title: "5. Cookie",
          content:
            "我们使用必要的Cookie进行身份验证和会话管理。我们使用分析Cookie了解平台使用情况。您可以在浏览器设置中管理Cookie偏好。",
        },
        {
          title: "6. 您的权利",
          content:
            "您有权：访问您的个人数据；更正不准确的数据；删除您的账户和数据；导出您的数据；退出非必要通信。",
        },
        {
          title: "7. 安全",
          content:
            "我们实施行业标准的安全措施来保护您的数据。但没有任何系统是100%安全的。请将安全漏洞报告至support@mimzy.app。",
        },
      ],
    },
    copyright: {
      title: "版权与DMCA政策",
      blocks: [
        {
          title: "1. 知识产权",
          content:
            "mimzy尊重知识产权。用户保留其原创内容的版权。AI生成的翻译作为服务提供，不转让版权。",
        },
        {
          title: "2. 表情包合理使用",
          content:
            "许多表情包包含以评论、恶搞或批评为目的进行变形使用的受版权保护的图像。mimzy支持合理使用原则，但无法就个别案例提供法律建议。用户有责任确保其上传内容符合适用的版权法。",
        },
        {
          title: "3. DMCA删除流程",
          content:
            "如果您认为mimzy上的内容侵犯了您的版权，请向support@mimzy.app提交DMCA删除通知，包括：",
          list: [
            "受版权保护作品的标识",
            "mimzy上侵权内容的URL",
            "您的联系信息",
            "善意相信该使用未经授权的声明",
            "在伪证罪处罚下信息准确的声明",
            "您的物理或电子签名",
          ],
        },
        {
          title: "4. 反通知",
          content:
            "如果您的内容被删除且您认为这是一个错误，您可以提交反通知。除非版权持有人提起诉讼，否则我们将在10-14个工作日内恢复内容。",
        },
        {
          title: "5. 重复侵权者",
          content:
            "反复侵犯版权的账户将被终止。三次有效的DMCA投诉将导致永久删除账户。",
        },
        {
          title: "6. 翻译版权",
          content:
            "AI生成的翻译是衍生服务。原始表情包创作者保留对其源内容的权利。社区贡献的翻译改进按与其他用户内容相同的条款许可（见服务条款第4条）。",
        },
      ],
    },
    cookies: {
      title: "Cookie政策",
      blocks: [
        {
          title: "1. 什么是Cookie",
          content:
            "Cookie是您访问网站时存储在设备上的小型文本文件。它们帮助网站记住您的偏好并改善您的体验。某些Cookie对网站功能至关重要，而其他Cookie帮助我们了解您如何使用平台。",
        },
        {
          title: "2. 我们使用的Cookie",
          content:
            "我们使用以下Cookie和本地存储项：\n\n身份验证：NextAuth会话Cookie — 登录必需。此Cookie是服务运行所必需的，无法禁用。\n\n主题偏好：localStorage — 记住您的暗色/亮色模式选择，以便在再次访问时界面与您的偏好匹配。\n\nCookie同意：localStorage — 记住您的Cookie选择，以免每次访问都被询问。",
        },
        {
          title: "3. 第三方Cookie",
          content: "我们不使用任何第三方跟踪Cookie或分析工具。",
        },
        {
          title: "4. Cookie管理",
          content:
            "您可以通过浏览器设置管理或删除Cookie。请注意，禁用必要Cookie可能会影响您使用我们服务的能力。",
        },
      ],
    },
  },
  contact: {
    title: "联系信息",
    legalInquiries: "法律咨询：",
    dmcaNotices: "DMCA通知：",
    generalSupport: "一般支持：",
  },
  footer: {
    communityRules: "社区规则",
    settings: "设置",
  },
};

const rulesZH: RulesContent = {
  pageTitle: "社区规则",
  subtitle:
    "mimzy是一个跨语言和文化分享与翻译表情包的全球平台。这些规则有助于保持我们的社区有趣、安全、对所有人友好。",
  rules: [
    {
      title: "尊重他人",
      description:
        "尊重所有社区成员。不得有任何形式的人身攻击、骚扰、霸凌或仇恨言论。我们珍视每种文化的幽默。",
    },
    {
      title: "仅限原创内容",
      description:
        "仅上传您创建的或有权分享的表情包。不要将他人的作品据为己有。如果您分享现有的表情包，请注明原创作者。",
    },
    {
      title: "禁止有害内容",
      description:
        "不得发布宣扬暴力、非法活动、自残或剥削的内容。表情包应该是有趣的，而非有害的。",
    },
    {
      title: "禁止垃圾信息和自我推广",
      description:
        "不得发布重复内容、广告，或仅为推广外部产品或服务而使用平台。",
    },
    {
      title: "翻译质量",
      description:
        "建议翻译编辑时，追求文化准确性。翻译应捕捉精神和幽默，而非仅仅是字面意思。尊重每种语言的细微差别。",
    },
    {
      title: "恰当标记",
      description:
        "为您的表情包使用准确的分类和标签。误导性的标签会损害发现性和社区体验。",
    },
    {
      title: "尊重文化差异",
      description:
        "幽默因文化而异。在一种文化中有趣的东西，在另一种文化中可能令人反感。以好奇心和开放态度参与，而非评判。",
    },
    {
      title: "举报而非报复",
      description:
        "如果您看到违反规则的内容，请使用举报按钮。不要参与争论或报复。让管理员来处理。",
    },
  ],
  enforcement: {
    title: "执行措施",
    levels: [
      { level: "首次违规", action: "通知警告" },
      { level: "第二次违规", action: "删除内容 + 24小时发布限制" },
      { level: "第三次违规", action: "7天账户暂停" },
      { level: "严重违规", action: "永久封禁（对仇恨言论、非法内容等不予警告）" },
    ],
  },
  footer: {
    questionsText: "对这些规则有疑问？请通过support@mimzy.app联系我们",
    termsLink: "服务条款",
    privacyLink: "隐私政策",
    settingsLink: "设置",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPANISH
// ═══════════════════════════════════════════════════════════════════════════════

const legalES: LegalContent = {
  pageTitle: "Legal",
  lastUpdated: "Última actualización: marzo de 2026",
  nav: {
    terms: "Términos de Servicio",
    privacy: "Política de Privacidad",
    copyright: "Derechos de Autor y DMCA",
    cookies: "Política de Cookies",
  },
  sections: {
    terms: {
      title: "Términos de Servicio",
      blocks: [
        {
          title: "1. Aceptación de los Términos",
          content:
            'Al acceder o utilizar mimzy ("el Servicio"), usted acepta estar sujeto a estos Términos de Servicio. Si no está de acuerdo, no utilice el Servicio.',
        },
        {
          title: "2. Elegibilidad",
          content:
            "Debe tener al menos 13 años para usar mimzy. Si es menor de 18 años, debe contar con el consentimiento de un padre o tutor. Al utilizar el Servicio, usted declara que cumple con estos requisitos.",
        },
        {
          title: "3. Cuentas de Usuario",
          content:
            "Usted es responsable de mantener la seguridad de las credenciales de su cuenta. No debe compartir su cuenta con otros. Es responsable de toda la actividad realizada bajo su cuenta. Notifíquenos inmediatamente de cualquier acceso no autorizado.",
        },
        {
          title: "4. Contenido del Usuario",
          content:
            "Usted conserva la propiedad del contenido que sube. Al publicar contenido, otorga a mimzy una licencia mundial, no exclusiva y libre de regalías para usar, mostrar, reproducir y distribuir su contenido en la plataforma. Usted declara que tiene derecho a compartir cualquier contenido que suba.",
        },
        {
          title: "5. Traducción con IA",
          content:
            "mimzy utiliza IA para traducir automáticamente el contenido de los memes a diferentes idiomas. Las traducciones se proporcionan tal cual y pueden no captar perfectamente los matices culturales. Los miembros de la comunidad pueden sugerir traducciones mejoradas. mimzy no es responsable de las imprecisiones en las traducciones generadas por IA.",
        },
        {
          title: "6. Conducta Prohibida",
          content:
            "No puede: subir contenido ilegal; acosar a otros usuarios; enviar spam o inundar la plataforma; intentar manipular votos o tablas de clasificación; eludir prohibiciones o restricciones; usar herramientas automatizadas para extraer o subir contenido masivamente; hacerse pasar por otros usuarios o entidades.",
        },
        {
          title: "7. Terminación",
          content:
            "Podemos suspender o cancelar su cuenta a nuestra discreción por violaciones de estos términos o las reglas de la comunidad. Puede eliminar su cuenta en cualquier momento a través de Configuración.",
        },
        {
          title: "8. Descargo de Responsabilidad",
          content:
            'El Servicio se proporciona "tal cual" sin garantías de ningún tipo. No garantizamos el tiempo de actividad, la precisión de las traducciones ni la preservación del contenido. Utilice el Servicio bajo su propio riesgo.',
        },
        {
          title: "9. Cambios en los Términos",
          content:
            "Podemos actualizar estos términos en cualquier momento. El uso continuado del Servicio después de los cambios constituye aceptación. Notificaremos a los usuarios de cambios importantes a través de la plataforma.",
        },
        {
          title: "10. Restricción de Edad",
          content:
            "Debe tener al menos 13 años para usar mimzy. Al usar nuestra plataforma, confirma que cumple con este requisito de edad.",
        },
        {
          title: "11. Ley Aplicable",
          content:
            "Estos términos se rigen por las leyes de la República de Corea. Cualquier disputa se resolverá en los tribunales de Seúl, República de Corea.",
        },
      ],
    },
    privacy: {
      title: "Política de Privacidad",
      blocks: [
        {
          title: "1. Información que Recopilamos",
          content:
            "Datos de cuenta: dirección de correo electrónico, nombre de usuario, nombre para mostrar e información de perfil que usted proporciona.\n\nDatos de contenido: memes que sube, traducciones, comentarios, votos y otras interacciones.\n\nDatos de uso: dirección IP, tipo de navegador, información del dispositivo, páginas visitadas y acciones realizadas en la plataforma.",
        },
        {
          title: "2. Cómo Usamos su Información",
          content:
            "Utilizamos su información para: proporcionar y mejorar el Servicio; procesar traducciones con IA; personalizar su experiencia; enviar notificaciones a las que se haya suscrito; hacer cumplir nuestras reglas y términos; analizar patrones de uso para mejorar la plataforma.",
        },
        {
          title: "3. Compartir Datos",
          content:
            "No vendemos su información personal. Podemos compartir datos con: proveedores de servicios de IA (para procesamiento de traducciones); proveedores de alojamiento e infraestructura; autoridades legales cuando lo requiera la ley. Su perfil público y contenido publicado son visibles para todos los usuarios.",
        },
        {
          title: "4. Retención de Datos",
          content:
            "Los datos de la cuenta se conservan mientras su cuenta esté activa. Puede solicitar la eliminación de su cuenta y datos asociados a través de Configuración. Algunos datos pueden conservarse por motivos de cumplimiento legal.",
        },
        {
          title: "5. Cookies",
          content:
            "Utilizamos cookies esenciales para la autenticación y gestión de sesiones. Utilizamos cookies de análisis para comprender el uso de la plataforma. Puede gestionar las preferencias de cookies en la configuración de su navegador.",
        },
        {
          title: "6. Sus Derechos",
          content:
            "Usted tiene derecho a: acceder a sus datos personales; corregir datos inexactos; eliminar su cuenta y datos; exportar sus datos; optar por no recibir comunicaciones no esenciales.",
        },
        {
          title: "7. Seguridad",
          content:
            "Implementamos medidas de seguridad estándar de la industria para proteger sus datos. Sin embargo, ningún sistema es 100% seguro. Reporte vulnerabilidades de seguridad a support@mimzy.app.",
        },
      ],
    },
    copyright: {
      title: "Política de Derechos de Autor y DMCA",
      blocks: [
        {
          title: "1. Propiedad Intelectual",
          content:
            "mimzy respeta los derechos de propiedad intelectual. Los usuarios conservan los derechos de autor sobre su contenido original. Las traducciones generadas por IA se proporcionan como un servicio y no transfieren derechos de autor.",
        },
        {
          title: "2. Uso Legítimo de Memes",
          content:
            "Muchos memes incorporan imágenes con derechos de autor utilizadas de manera transformadora para comentarios, parodia o crítica. mimzy apoya la doctrina del uso legítimo pero no puede proporcionar asesoramiento legal sobre casos individuales. Los usuarios son responsables de garantizar que sus cargas cumplan con la ley de derechos de autor aplicable.",
        },
        {
          title: "3. Proceso de Eliminación DMCA",
          content:
            "Si cree que el contenido en mimzy infringe sus derechos de autor, envíe un aviso de eliminación DMCA a support@mimzy.app incluyendo:",
          list: [
            "Identificación de la obra protegida por derechos de autor",
            "URL del contenido infractor en mimzy",
            "Su información de contacto",
            "Una declaración de buena fe de que el uso no está autorizado",
            "Una declaración bajo pena de perjurio de que la información es precisa",
            "Su firma física o electrónica",
          ],
        },
        {
          title: "4. Contra-Notificación",
          content:
            "Si su contenido fue eliminado y cree que fue un error, puede enviar una contra-notificación. Restauraremos el contenido dentro de 10-14 días hábiles a menos que el titular de los derechos de autor presente una acción judicial.",
        },
        {
          title: "5. Infractores Reincidentes",
          content:
            "Las cuentas con violaciones repetidas de derechos de autor serán canceladas. Tres avisos DMCA válidos resultan en la eliminación permanente de la cuenta.",
        },
        {
          title: "6. Derechos de Autor de Traducciones",
          content:
            "Las traducciones generadas por IA son un servicio derivado. Los creadores originales de memes conservan los derechos sobre su contenido fuente. Las mejoras de traducción contribuidas por la comunidad se licencian bajo los mismos términos que otro contenido de usuario (ver Términos de Servicio, Sección 4).",
        },
      ],
    },
    cookies: {
      title: "Política de Cookies",
      blocks: [
        {
          title: "1. Qué Son las Cookies",
          content:
            "Las cookies son pequeños archivos de texto almacenados en su dispositivo cuando visita un sitio web. Ayudan al sitio a recordar sus preferencias y mejorar su experiencia. Algunas cookies son esenciales para el funcionamiento del sitio, mientras que otras nos ayudan a entender cómo usa la plataforma.",
        },
        {
          title: "2. Cookies que Utilizamos",
          content:
            "Utilizamos las siguientes cookies y elementos de almacenamiento local:\n\nAutenticación: cookie de sesión NextAuth — esencial para el inicio de sesión. Esta cookie es necesaria para el funcionamiento del Servicio y no puede desactivarse.\n\nPreferencia de tema: localStorage — recuerda su selección de modo oscuro/claro para que la interfaz coincida con su preferencia en visitas posteriores.\n\nConsentimiento de cookies: localStorage — recuerda su elección de cookies para que no se le pregunte en cada visita.",
        },
        {
          title: "3. Cookies de Terceros",
          content: "No utilizamos cookies de seguimiento de terceros ni análisis.",
        },
        {
          title: "4. Gestión de Cookies",
          content:
            "Puede gestionar o eliminar cookies a través de la configuración de su navegador. Tenga en cuenta que desactivar las cookies esenciales puede afectar su capacidad para usar nuestros servicios.",
        },
      ],
    },
  },
  contact: {
    title: "Información de Contacto",
    legalInquiries: "Consultas legales:",
    dmcaNotices: "Avisos DMCA:",
    generalSupport: "Soporte general:",
  },
  footer: {
    communityRules: "Reglas de la Comunidad",
    settings: "Configuración",
  },
};

const rulesES: RulesContent = {
  pageTitle: "Reglas de la Comunidad",
  subtitle:
    "mimzy es una plataforma global para compartir y traducir memes a través de idiomas y culturas. Estas reglas ayudan a mantener nuestra comunidad divertida, segura y acogedora para todos.",
  rules: [
    {
      title: "Sea Respetuoso",
      description:
        "Trate a todos los miembros de la comunidad con respeto. No se toleran ataques personales, acoso, intimidación ni discurso de odio de ningún tipo. Celebramos el humor de todas las culturas.",
    },
    {
      title: "Solo Contenido Original",
      description:
        "Suba memes que haya creado o tenga derecho a compartir. No reclame el trabajo de otra persona como propio. Si comparte un meme existente, acredite al creador original.",
    },
    {
      title: "Sin Contenido Dañino",
      description:
        "No publique contenido que promueva la violencia, actividades ilegales, autolesiones o explotación. Los memes deben ser divertidos, no dañinos.",
    },
    {
      title: "Sin Spam ni Autopromoción",
      description:
        "No publique contenido repetitivo, anuncios ni use la plataforma únicamente para promover productos o servicios externos.",
    },
    {
      title: "Calidad de Traducción",
      description:
        "Al sugerir ediciones de traducción, busque la precisión cultural. Las traducciones deben captar el espíritu y el humor, no solo el significado literal. Respete los matices de cada idioma.",
    },
    {
      title: "Etiquetado Apropiado",
      description:
        "Use categorías y etiquetas precisas para sus memes. Las etiquetas engañosas perjudican la visibilidad y la experiencia de la comunidad.",
    },
    {
      title: "Respete las Diferencias Culturales",
      description:
        "El humor varía entre culturas. Lo que es gracioso en una cultura puede ser ofensivo en otra. Participe con curiosidad y apertura, no con juicio.",
    },
    {
      title: "Reporte, No Retalie",
      description:
        "Si ve contenido que infringe las reglas, use el botón de reporte. No participe en discusiones ni tome represalias. Deje que los moderadores lo manejen.",
    },
  ],
  enforcement: {
    title: "Aplicación",
    levels: [
      { level: "Primera Infracción", action: "Advertencia por notificación" },
      { level: "Segunda Infracción", action: "Eliminación de contenido + restricción de publicación de 24 horas" },
      { level: "Tercera Infracción", action: "Suspensión de cuenta de 7 días" },
      { level: "Violación Grave", action: "Prohibición permanente (sin advertencias para discurso de odio, contenido ilegal, etc.)" },
    ],
  },
  footer: {
    questionsText: "¿Preguntas sobre estas reglas? Contáctenos en support@mimzy.app",
    termsLink: "Términos de Servicio",
    privacyLink: "Política de Privacidad",
    settingsLink: "Configuración",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HINDI
// ═══════════════════════════════════════════════════════════════════════════════

const legalHI: LegalContent = {
  pageTitle: "कानूनी",
  lastUpdated: "अंतिम अपडेट: मार्च 2026",
  nav: {
    terms: "सेवा की शर्तें",
    privacy: "गोपनीयता नीति",
    copyright: "कॉपीराइट और DMCA",
    cookies: "कुकी नीति",
  },
  sections: {
    terms: {
      title: "सेवा की शर्तें",
      blocks: [
        {
          title: "1. शर्तों की स्वीकृति",
          content:
            'mimzy ("सेवा") तक पहुँचने या उसका उपयोग करने से, आप इन सेवा शर्तों से बाध्य होने के लिए सहमत होते हैं। यदि आप सहमत नहीं हैं, तो सेवा का उपयोग न करें।',
        },
        {
          title: "2. पात्रता",
          content:
            "mimzy का उपयोग करने के लिए आपकी आयु कम से कम 13 वर्ष होनी चाहिए। यदि आपकी आयु 18 वर्ष से कम है, तो आपके पास माता-पिता या अभिभावक की सहमति होनी चाहिए। सेवा का उपयोग करके, आप प्रतिनिधित्व करते हैं कि आप इन आवश्यकताओं को पूरा करते हैं।",
        },
        {
          title: "3. उपयोगकर्ता खाते",
          content:
            "आप अपने खाता क्रेडेंशियल्स की सुरक्षा बनाए रखने के लिए जिम्मेदार हैं। आपको अपना खाता दूसरों के साथ साझा नहीं करना चाहिए। आपके खाते के अंतर्गत सभी गतिविधियों के लिए आप जिम्मेदार हैं। किसी भी अनधिकृत पहुँच की तुरंत सूचना दें।",
        },
        {
          title: "4. उपयोगकर्ता सामग्री",
          content:
            "आपके द्वारा अपलोड की गई सामग्री का स्वामित्व आपके पास रहता है। सामग्री पोस्ट करके, आप mimzy को प्लेटफ़ॉर्म पर आपकी सामग्री का उपयोग, प्रदर्शन, पुनरुत्पादन और वितरण करने के लिए विश्वव्यापी, गैर-विशिष्ट, रॉयल्टी-मुक्त लाइसेंस प्रदान करते हैं। आप प्रतिनिधित्व करते हैं कि आपके पास अपलोड की गई किसी भी सामग्री को साझा करने का अधिकार है।",
        },
        {
          title: "5. AI अनुवाद",
          content:
            "mimzy मीम सामग्री को विभिन्न भाषाओं में स्वचालित रूप से अनुवाद करने के लिए AI का उपयोग करता है। अनुवाद जैसा है वैसा प्रदान किया जाता है और सांस्कृतिक बारीकियों को पूरी तरह से नहीं पकड़ सकता। समुदाय के सदस्य बेहतर अनुवाद सुझाव दे सकते हैं। mimzy AI-जनित अनुवादों में अशुद्धियों के लिए जिम्मेदार नहीं है।",
        },
        {
          title: "6. निषिद्ध आचरण",
          content:
            "आप ये नहीं कर सकते: अवैध सामग्री अपलोड करना; अन्य उपयोगकर्ताओं को परेशान करना; प्लेटफ़ॉर्म पर स्पैम या फ्लड करना; वोटों या लीडरबोर्ड में हेरफेर करने का प्रयास करना; प्रतिबंधों को दरकिनार करना; स्वचालित उपकरणों से स्क्रैपिंग या बल्क-अपलोड करना; अन्य उपयोगकर्ताओं या संस्थाओं का प्रतिरूपण करना।",
        },
        {
          title: "7. समाप्ति",
          content:
            "हम इन शर्तों या सामुदायिक नियमों के उल्लंघन के लिए अपने विवेक से आपके खाते को निलंबित या समाप्त कर सकते हैं। आप सेटिंग्स के माध्यम से किसी भी समय अपना खाता हटा सकते हैं।",
        },
        {
          title: "8. अस्वीकरण",
          content:
            'सेवा किसी भी प्रकार की वारंटी के बिना "जैसी है" प्रदान की जाती है। हम अपटाइम, अनुवाद की सटीकता या सामग्री के संरक्षण की गारंटी नहीं देते। सेवा का उपयोग आपके अपने जोखिम पर है।',
        },
        {
          title: "9. शर्तों में परिवर्तन",
          content:
            "हम किसी भी समय इन शर्तों को अपडेट कर सकते हैं। परिवर्तनों के बाद सेवा का निरंतर उपयोग स्वीकृति का गठन करता है। हम प्लेटफ़ॉर्म के माध्यम से उपयोगकर्ताओं को महत्वपूर्ण परिवर्तनों की सूचना देंगे।",
        },
        {
          title: "10. आयु प्रतिबंध",
          content:
            "mimzy का उपयोग करने के लिए आपकी आयु कम से कम 13 वर्ष होनी चाहिए। हमारे प्लेटफ़ॉर्म का उपयोग करके, आप पुष्टि करते हैं कि आप इस आयु आवश्यकता को पूरा करते हैं।",
        },
        {
          title: "11. शासी कानून",
          content:
            "ये शर्तें कोरिया गणराज्य के कानूनों द्वारा शासित हैं। किसी भी विवाद का समाधान कोरिया गणराज्य, सियोल की अदालतों में किया जाएगा।",
        },
      ],
    },
    privacy: {
      title: "गोपनीयता नीति",
      blocks: [
        {
          title: "1. हम जो जानकारी एकत्र करते हैं",
          content:
            "खाता डेटा: आपके द्वारा प्रदान किया गया ईमेल पता, उपयोगकर्ता नाम, प्रदर्शन नाम और प्रोफ़ाइल जानकारी।\n\nसामग्री डेटा: आपके द्वारा अपलोड किए गए मीम, अनुवाद, टिप्पणियाँ, वोट और अन्य इंटरैक्शन।\n\nउपयोग डेटा: IP पता, ब्राउज़र प्रकार, डिवाइस जानकारी, देखे गए पृष्ठ और प्लेटफ़ॉर्म पर की गई कार्रवाइयाँ।",
        },
        {
          title: "2. हम आपकी जानकारी का उपयोग कैसे करते हैं",
          content:
            "हम आपकी जानकारी का उपयोग इनके लिए करते हैं: सेवा प्रदान करना और सुधारना; AI अनुवाद संसाधित करना; आपके अनुभव को वैयक्तिकृत करना; आपके द्वारा चुनी गई सूचनाएँ भेजना; हमारे नियमों और शर्तों को लागू करना; प्लेटफ़ॉर्म में सुधार के लिए उपयोग पैटर्न का विश्लेषण करना।",
        },
        {
          title: "3. डेटा साझाकरण",
          content:
            "हम आपकी व्यक्तिगत जानकारी नहीं बेचते। हम निम्नलिखित के साथ डेटा साझा कर सकते हैं: AI सेवा प्रदाता (अनुवाद प्रसंस्करण के लिए); होस्टिंग और अवसंरचना प्रदाता; कानून द्वारा आवश्यक होने पर कानून प्रवर्तन। आपकी सार्वजनिक प्रोफ़ाइल और पोस्ट की गई सामग्री सभी उपयोगकर्ताओं को दिखाई देती है।",
        },
        {
          title: "4. डेटा प्रतिधारण",
          content:
            "खाता डेटा आपके खाते के सक्रिय रहने तक बनाए रखा जाता है। आप सेटिंग्स के माध्यम से अपने खाते और संबंधित डेटा को हटाने का अनुरोध कर सकते हैं। कुछ डेटा कानूनी अनुपालन उद्देश्यों के लिए बनाए रखा जा सकता है।",
        },
        {
          title: "5. कुकीज़",
          content:
            "हम प्रमाणीकरण और सत्र प्रबंधन के लिए आवश्यक कुकीज़ का उपयोग करते हैं। हम प्लेटफ़ॉर्म के उपयोग को समझने के लिए विश्लेषणात्मक कुकीज़ का उपयोग करते हैं। आप अपने ब्राउज़र सेटिंग्स में कुकी प्राथमिकताएँ प्रबंधित कर सकते हैं।",
        },
        {
          title: "6. आपके अधिकार",
          content:
            "आपके पास ये अधिकार हैं: अपने व्यक्तिगत डेटा तक पहुँचना; गलत डेटा को सही करना; अपना खाता और डेटा हटाना; अपना डेटा निर्यात करना; गैर-आवश्यक संचार से ऑप्ट आउट करना।",
        },
        {
          title: "7. सुरक्षा",
          content:
            "हम आपके डेटा की सुरक्षा के लिए उद्योग-मानक सुरक्षा उपाय लागू करते हैं। हालाँकि, कोई भी सिस्टम 100% सुरक्षित नहीं है। सुरक्षा कमजोरियों की रिपोर्ट support@mimzy.app पर करें।",
        },
      ],
    },
    copyright: {
      title: "कॉपीराइट और DMCA नीति",
      blocks: [
        {
          title: "1. बौद्धिक संपदा",
          content:
            "mimzy बौद्धिक संपदा अधिकारों का सम्मान करता है। उपयोगकर्ता अपनी मौलिक सामग्री पर कॉपीराइट बनाए रखते हैं। AI-जनित अनुवाद एक सेवा के रूप में प्रदान किए जाते हैं और कॉपीराइट हस्तांतरित नहीं करते।",
        },
        {
          title: "2. मीम का उचित उपयोग",
          content:
            "कई मीम में टिप्पणी, पैरोडी या आलोचना के लिए परिवर्तनात्मक रूप से उपयोग की गई कॉपीराइट छवियाँ शामिल होती हैं। mimzy उचित उपयोग सिद्धांत का समर्थन करता है लेकिन व्यक्तिगत मामलों पर कानूनी सलाह प्रदान नहीं कर सकता। उपयोगकर्ता यह सुनिश्चित करने के लिए जिम्मेदार हैं कि उनके अपलोड लागू कॉपीराइट कानून का अनुपालन करते हैं।",
        },
        {
          title: "3. DMCA हटाने की प्रक्रिया",
          content:
            "यदि आपको लगता है कि mimzy पर सामग्री आपके कॉपीराइट का उल्लंघन करती है, तो निम्नलिखित सहित support@mimzy.app पर DMCA हटाने की सूचना जमा करें:",
          list: [
            "कॉपीराइट कार्य की पहचान",
            "mimzy पर उल्लंघनकारी सामग्री का URL",
            "आपकी संपर्क जानकारी",
            "उपयोग अधिकृत नहीं होने का सद्भावना बयान",
            "झूठी गवाही के दंड के तहत जानकारी सटीक होने का बयान",
            "आपके भौतिक या इलेक्ट्रॉनिक हस्ताक्षर",
          ],
        },
        {
          title: "4. प्रति-सूचना",
          content:
            "यदि आपकी सामग्री हटा दी गई थी और आप मानते हैं कि यह एक गलती थी, तो आप प्रति-सूचना जमा कर सकते हैं। जब तक कॉपीराइट धारक अदालती कार्रवाई दायर नहीं करता, हम 10-14 कार्य दिवसों के भीतर सामग्री को बहाल कर देंगे।",
        },
        {
          title: "5. बार-बार उल्लंघन करने वाले",
          content:
            "बार-बार कॉपीराइट उल्लंघन करने वाले खातों को समाप्त कर दिया जाएगा। तीन वैध DMCA शिकायतों के परिणामस्वरूप खाता स्थायी रूप से हटा दिया जाएगा।",
        },
        {
          title: "6. अनुवाद कॉपीराइट",
          content:
            "AI-जनित अनुवाद एक व्युत्पन्न सेवा है। मूल मीम निर्माता अपनी स्रोत सामग्री पर अधिकार बनाए रखते हैं। समुदाय द्वारा योगदान किए गए अनुवाद सुधारों को अन्य उपयोगकर्ता सामग्री के समान शर्तों के तहत लाइसेंस प्राप्त होता है (सेवा की शर्तें, धारा 4 देखें)।",
        },
      ],
    },
    cookies: {
      title: "कुकी नीति",
      blocks: [
        {
          title: "1. कुकीज़ क्या हैं",
          content:
            "कुकीज़ छोटी टेक्स्ट फ़ाइलें हैं जो वेबसाइट पर जाने पर आपके डिवाइस पर संग्रहीत होती हैं। ये साइट को आपकी प्राथमिकताओं को याद रखने और आपके अनुभव को बेहतर बनाने में मदद करती हैं। कुछ कुकीज़ साइट के कामकाज के लिए आवश्यक हैं, जबकि अन्य हमें यह समझने में मदद करती हैं कि आप प्लेटफ़ॉर्म का उपयोग कैसे करते हैं।",
        },
        {
          title: "2. हम जो कुकीज़ उपयोग करते हैं",
          content:
            "हम निम्नलिखित कुकीज़ और स्थानीय स्टोरेज आइटम का उपयोग करते हैं:\n\nप्रमाणीकरण: NextAuth सत्र कुकी — लॉगिन के लिए आवश्यक। यह कुकी सेवा के कामकाज के लिए आवश्यक है और अक्षम नहीं की जा सकती।\n\nथीम प्राथमिकता: localStorage — आपके डार्क/लाइट मोड चयन को याद रखता है ताकि पुनः विज़िट पर इंटरफ़ेस आपकी प्राथमिकता से मेल खाए।\n\nकुकी सहमति: localStorage — आपकी कुकी पसंद को याद रखता है ताकि हर विज़िट पर पूछा न जाए।",
        },
        {
          title: "3. तृतीय-पक्ष कुकीज़",
          content: "हम किसी भी तृतीय-पक्ष ट्रैकिंग कुकीज़ या एनालिटिक्स का उपयोग नहीं करते।",
        },
        {
          title: "4. कुकीज़ प्रबंधन",
          content:
            "आप अपने ब्राउज़र सेटिंग्स के माध्यम से कुकीज़ को प्रबंधित या हटा सकते हैं। ध्यान दें कि आवश्यक कुकीज़ को अक्षम करने से हमारी सेवाओं का उपयोग करने की आपकी क्षमता प्रभावित हो सकती है।",
        },
      ],
    },
  },
  contact: {
    title: "संपर्क जानकारी",
    legalInquiries: "कानूनी पूछताछ:",
    dmcaNotices: "DMCA सूचनाएँ:",
    generalSupport: "सामान्य सहायता:",
  },
  footer: {
    communityRules: "सामुदायिक नियम",
    settings: "सेटिंग्स",
  },
};

const rulesHI: RulesContent = {
  pageTitle: "सामुदायिक नियम",
  subtitle:
    "mimzy भाषाओं और संस्कृतियों में मीम साझा करने और अनुवाद करने के लिए एक वैश्विक मंच है। ये नियम हमारे समुदाय को सभी के लिए मज़ेदार, सुरक्षित और स्वागत योग्य बनाए रखने में मदद करते हैं।",
  rules: [
    {
      title: "सम्मानजनक रहें",
      description:
        "सभी समुदाय सदस्यों के साथ सम्मान से व्यवहार करें। किसी भी प्रकार के व्यक्तिगत हमले, उत्पीड़न, बदमाशी या घृणास्पद भाषण की अनुमति नहीं है। हम हर संस्कृति के हास्य का जश्न मनाते हैं।",
    },
    {
      title: "केवल मौलिक सामग्री",
      description:
        "केवल वही मीम अपलोड करें जो आपने बनाए हैं या जिन्हें साझा करने का अधिकार आपके पास है। किसी और के काम को अपना न बताएँ। यदि आप कोई मौजूदा मीम साझा कर रहे हैं, तो मूल निर्माता को श्रेय दें।",
    },
    {
      title: "हानिकारक सामग्री निषिद्ध",
      description:
        "हिंसा, अवैध गतिविधियों, आत्म-हानि या शोषण को बढ़ावा देने वाली सामग्री पोस्ट न करें। मीम मज़ेदार होने चाहिए, हानिकारक नहीं।",
    },
    {
      title: "स्पैम या आत्म-प्रचार निषिद्ध",
      description:
        "दोहराव वाली सामग्री, विज्ञापन पोस्ट न करें या बाहरी उत्पादों या सेवाओं को बढ़ावा देने के लिए प्लेटफ़ॉर्म का उपयोग न करें।",
    },
    {
      title: "अनुवाद गुणवत्ता",
      description:
        "अनुवाद संपादन सुझाते समय, सांस्कृतिक सटीकता का लक्ष्य रखें। अनुवाद केवल शाब्दिक अर्थ नहीं, बल्कि भावना और हास्य को पकड़ना चाहिए। प्रत्येक भाषा की बारीकियों का सम्मान करें।",
    },
    {
      title: "उचित टैगिंग",
      description:
        "अपने मीम के लिए सटीक श्रेणियों और टैग का उपयोग करें। भ्रामक टैग खोज योग्यता और सामुदायिक अनुभव को नुकसान पहुँचाते हैं।",
    },
    {
      title: "सांस्कृतिक अंतरों का सम्मान करें",
      description:
        "हास्य संस्कृतियों में भिन्न होता है। एक संस्कृति में जो मज़ेदार है वह दूसरी में आपत्तिजनक हो सकता है। निर्णय नहीं, बल्कि जिज्ञासा और खुलेपन के साथ जुड़ें।",
    },
    {
      title: "रिपोर्ट करें, प्रतिशोध न लें",
      description:
        "यदि आप नियम उल्लंघन करने वाली सामग्री देखते हैं, तो रिपोर्ट बटन का उपयोग करें। बहस में शामिल न हों या प्रतिशोध न लें। मॉडरेटर को इसे संभालने दें।",
    },
  ],
  enforcement: {
    title: "प्रवर्तन",
    levels: [
      { level: "पहला उल्लंघन", action: "सूचना द्वारा चेतावनी" },
      { level: "दूसरा उल्लंघन", action: "सामग्री हटाना + 24 घंटे की पोस्टिंग प्रतिबंध" },
      { level: "तीसरा उल्लंघन", action: "7 दिन का खाता निलंबन" },
      { level: "गंभीर उल्लंघन", action: "स्थायी प्रतिबंध (घृणा भाषण, अवैध सामग्री आदि के लिए कोई चेतावनी नहीं)" },
    ],
  },
  footer: {
    questionsText: "इन नियमों के बारे में प्रश्न? हमसे support@mimzy.app पर संपर्क करें",
    termsLink: "सेवा की शर्तें",
    privacyLink: "गोपनीयता नीति",
    settingsLink: "सेटिंग्स",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ARABIC
// ═══════════════════════════════════════════════════════════════════════════════

const legalAR: LegalContent = {
  pageTitle: "قانوني",
  lastUpdated: "آخر تحديث: مارس 2026",
  nav: {
    terms: "شروط الخدمة",
    privacy: "سياسة الخصوصية",
    copyright: "حقوق النشر وDMCA",
    cookies: "سياسة ملفات تعريف الارتباط",
  },
  sections: {
    terms: {
      title: "شروط الخدمة",
      blocks: [
        {
          title: "1. قبول الشروط",
          content:
            'بالوصول إلى mimzy ("الخدمة") أو استخدامها، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا كنت لا توافق، فلا تستخدم الخدمة.',
        },
        {
          title: "2. الأهلية",
          content:
            "يجب أن يكون عمرك 13 عامًا على الأقل لاستخدام mimzy. إذا كان عمرك أقل من 18 عامًا، يجب أن تحصل على موافقة أحد الوالدين أو الوصي. باستخدام الخدمة، فإنك تقر بأنك تستوفي هذه المتطلبات.",
        },
        {
          title: "3. حسابات المستخدمين",
          content:
            "أنت مسؤول عن الحفاظ على أمان بيانات اعتماد حسابك. يجب عدم مشاركة حسابك مع الآخرين. أنت مسؤول عن جميع الأنشطة التي تتم ضمن حسابك. أبلغنا فورًا عن أي وصول غير مصرح به.",
        },
        {
          title: "4. محتوى المستخدم",
          content:
            "تحتفظ بملكية المحتوى الذي تقوم بتحميله. بنشر المحتوى، فإنك تمنح mimzy ترخيصًا عالميًا وغير حصري وخاليًا من حقوق الملكية لاستخدام وعرض واستنساخ وتوزيع محتواك على المنصة. أنت تقر بأن لديك الحق في مشاركة أي محتوى تقوم بتحميله.",
        },
        {
          title: "5. الترجمة بالذكاء الاصطناعي",
          content:
            "يستخدم mimzy الذكاء الاصطناعي لترجمة محتوى الميمات تلقائيًا عبر اللغات. يتم تقديم الترجمات كما هي وقد لا تلتقط الفروق الثقافية بشكل كامل. يمكن لأعضاء المجتمع اقتراح ترجمات محسنة. mimzy ليس مسؤولاً عن عدم الدقة في الترجمات المولدة بالذكاء الاصطناعي.",
        },
        {
          title: "6. السلوك المحظور",
          content:
            "لا يجوز لك: تحميل محتوى غير قانوني؛ مضايقة المستخدمين الآخرين؛ إرسال رسائل غير مرغوب فيها أو إغراق المنصة؛ محاولة التلاعب بالتصويت أو لوحات المتصدرين؛ التحايل على الحظر أو القيود؛ استخدام أدوات آلية للكشط أو التحميل المجمع؛ انتحال شخصية المستخدمين أو الكيانات الأخرى.",
        },
        {
          title: "7. الإنهاء",
          content:
            "قد نقوم بتعليق أو إنهاء حسابك وفقًا لتقديرنا بسبب انتهاكات هذه الشروط أو قواعد المجتمع. يمكنك حذف حسابك في أي وقت من خلال الإعدادات.",
        },
        {
          title: "8. إخلاء المسؤولية",
          content:
            'يتم تقديم الخدمة "كما هي" دون ضمانات من أي نوع. لا نضمن وقت التشغيل أو دقة الترجمات أو حفظ المحتوى. استخدم الخدمة على مسؤوليتك الخاصة.',
        },
        {
          title: "9. تغييرات الشروط",
          content:
            "قد نقوم بتحديث هذه الشروط في أي وقت. يشكل الاستخدام المستمر للخدمة بعد التغييرات قبولاً لها. سنقوم بإخطار المستخدمين بالتغييرات الجوهرية عبر المنصة.",
        },
        {
          title: "10. قيود العمر",
          content:
            "يجب أن يكون عمرك 13 عامًا على الأقل لاستخدام mimzy. باستخدام منصتنا، فإنك تؤكد أنك تستوفي هذا الشرط العمري.",
        },
        {
          title: "11. القانون الحاكم",
          content:
            "تخضع هذه الشروط لقوانين جمهورية كوريا. سيتم حل أي نزاعات في محاكم سيول، جمهورية كوريا.",
        },
      ],
    },
    privacy: {
      title: "سياسة الخصوصية",
      blocks: [
        {
          title: "1. المعلومات التي نجمعها",
          content:
            "بيانات الحساب: عنوان البريد الإلكتروني واسم المستخدم والاسم المعروض ومعلومات الملف الشخصي التي تقدمها.\n\nبيانات المحتوى: الميمات التي تحمّلها والترجمات والتعليقات والتصويتات والتفاعلات الأخرى.\n\nبيانات الاستخدام: عنوان IP ونوع المتصفح ومعلومات الجهاز والصفحات التي تمت زيارتها والإجراءات المتخذة على المنصة.",
        },
        {
          title: "2. كيف نستخدم معلوماتك",
          content:
            "نستخدم معلوماتك من أجل: تقديم الخدمة وتحسينها؛ معالجة ترجمات الذكاء الاصطناعي؛ تخصيص تجربتك؛ إرسال الإشعارات التي اخترتها؛ تطبيق قواعدنا وشروطنا؛ تحليل أنماط الاستخدام لتحسين المنصة.",
        },
        {
          title: "3. مشاركة البيانات",
          content:
            "لا نبيع معلوماتك الشخصية. قد نشارك البيانات مع: مزودي خدمات الذكاء الاصطناعي (لمعالجة الترجمة)؛ مزودي الاستضافة والبنية التحتية؛ جهات إنفاذ القانون عند اقتضاء القانون. ملفك الشخصي العام والمحتوى المنشور مرئي لجميع المستخدمين.",
        },
        {
          title: "4. الاحتفاظ بالبيانات",
          content:
            "يتم الاحتفاظ ببيانات الحساب طالما كان حسابك نشطًا. يمكنك طلب حذف حسابك والبيانات المرتبطة من خلال الإعدادات. قد يتم الاحتفاظ ببعض البيانات لأغراض الامتثال القانوني.",
        },
        {
          title: "5. ملفات تعريف الارتباط",
          content:
            "نستخدم ملفات تعريف الارتباط الأساسية للمصادقة وإدارة الجلسات. نستخدم ملفات تعريف الارتباط التحليلية لفهم استخدام المنصة. يمكنك إدارة تفضيلات ملفات تعريف الارتباط في إعدادات المتصفح.",
        },
        {
          title: "6. حقوقك",
          content:
            "لديك الحق في: الوصول إلى بياناتك الشخصية؛ تصحيح البيانات غير الدقيقة؛ حذف حسابك وبياناتك؛ تصدير بياناتك؛ إلغاء الاشتراك في الاتصالات غير الأساسية.",
        },
        {
          title: "7. الأمان",
          content:
            "نطبق إجراءات أمنية وفقًا لمعايير الصناعة لحماية بياناتك. ومع ذلك، لا يوجد نظام آمن بنسبة 100%. أبلغ عن الثغرات الأمنية إلى support@mimzy.app.",
        },
      ],
    },
    copyright: {
      title: "سياسة حقوق النشر وDMCA",
      blocks: [
        {
          title: "1. الملكية الفكرية",
          content:
            "يحترم mimzy حقوق الملكية الفكرية. يحتفظ المستخدمون بحقوق النشر على محتواهم الأصلي. يتم تقديم الترجمات المولدة بالذكاء الاصطناعي كخدمة ولا تنقل حقوق النشر.",
        },
        {
          title: "2. الاستخدام العادل للميمات",
          content:
            "تتضمن العديد من الميمات صورًا محمية بحقوق النشر تُستخدم بشكل تحويلي للتعليق أو المحاكاة أو النقد. يدعم mimzy مبدأ الاستخدام العادل لكنه لا يستطيع تقديم مشورة قانونية حول الحالات الفردية. يتحمل المستخدمون مسؤولية ضمان امتثال تحميلاتهم لقانون حقوق النشر المعمول به.",
        },
        {
          title: "3. إجراءات إزالة DMCA",
          content:
            "إذا كنت تعتقد أن المحتوى على mimzy ينتهك حقوق النشر الخاصة بك، فقدم إشعار إزالة DMCA إلى support@mimzy.app متضمنًا:",
          list: [
            "تحديد العمل المحمي بحقوق النشر",
            "عنوان URL للمحتوى المخالف على mimzy",
            "معلومات الاتصال الخاصة بك",
            "بيان حسن النية بأن الاستخدام غير مصرح به",
            "بيان تحت طائلة عقوبة الحنث باليمين بأن المعلومات دقيقة",
            "توقيعك المادي أو الإلكتروني",
          ],
        },
        {
          title: "4. الإشعار المضاد",
          content:
            "إذا تمت إزالة محتواك وتعتقد أنه كان خطأ، يمكنك تقديم إشعار مضاد. سنعيد المحتوى خلال 10-14 يوم عمل ما لم يرفع صاحب حقوق النشر دعوى قضائية.",
        },
        {
          title: "5. المنتهكون المتكررون",
          content:
            "سيتم إنهاء الحسابات التي تنتهك حقوق النشر بشكل متكرر. ثلاث شكاوى DMCA صالحة تؤدي إلى إزالة الحساب نهائيًا.",
        },
        {
          title: "6. حقوق نشر الترجمة",
          content:
            "الترجمات المولدة بالذكاء الاصطناعي هي خدمة مشتقة. يحتفظ مبتكرو الميمات الأصليون بحقوقهم في محتواهم المصدر. يتم ترخيص تحسينات الترجمة التي يساهم بها المجتمع بنفس شروط محتوى المستخدم الآخر (انظر شروط الخدمة، القسم 4).",
        },
      ],
    },
    cookies: {
      title: "سياسة ملفات تعريف الارتباط",
      blocks: [
        {
          title: "1. ما هي ملفات تعريف الارتباط",
          content:
            "ملفات تعريف الارتباط هي ملفات نصية صغيرة يتم تخزينها على جهازك عند زيارة موقع ويب. تساعد الموقع على تذكر تفضيلاتك وتحسين تجربتك. بعض ملفات تعريف الارتباط ضرورية لعمل الموقع، بينما تساعدنا أخرى على فهم كيفية استخدامك للمنصة.",
        },
        {
          title: "2. ملفات تعريف الارتباط التي نستخدمها",
          content:
            "نستخدم ملفات تعريف الارتباط وعناصر التخزين المحلي التالية:\n\nالمصادقة: ملف تعريف ارتباط جلسة NextAuth — ضروري لتسجيل الدخول. ملف تعريف الارتباط هذا مطلوب لعمل الخدمة ولا يمكن تعطيله.\n\nتفضيل السمة: localStorage — يتذكر اختيارك للوضع الداكن/الفاتح حتى تتطابق الواجهة مع تفضيلاتك في الزيارات اللاحقة.\n\nموافقة ملفات تعريف الارتباط: localStorage — يتذكر اختيارك لملفات تعريف الارتباط حتى لا يُطلب منك في كل زيارة.",
        },
        {
          title: "3. ملفات تعريف الارتباط الخاصة بالأطراف الثالثة",
          content: "لا نستخدم أي ملفات تعريف ارتباط أو تحليلات تتبع من أطراف ثالثة.",
        },
        {
          title: "4. إدارة ملفات تعريف الارتباط",
          content:
            "يمكنك إدارة أو حذف ملفات تعريف الارتباط من خلال إعدادات المتصفح. لاحظ أن تعطيل ملفات تعريف الارتباط الأساسية قد يؤثر على قدرتك على استخدام خدماتنا.",
        },
      ],
    },
  },
  contact: {
    title: "معلومات الاتصال",
    legalInquiries: "استفسارات قانونية:",
    dmcaNotices: "إشعارات DMCA:",
    generalSupport: "الدعم العام:",
  },
  footer: {
    communityRules: "قواعد المجتمع",
    settings: "الإعدادات",
  },
};

const rulesAR: RulesContent = {
  pageTitle: "قواعد المجتمع",
  subtitle:
    "mimzy هي منصة عالمية لمشاركة وترجمة الميمات عبر اللغات والثقافات. تساعد هذه القواعد في الحفاظ على مجتمعنا ممتعًا وآمنًا ومرحبًا للجميع.",
  rules: [
    {
      title: "كن محترمًا",
      description:
        "عامل جميع أعضاء المجتمع باحترام. لا يُسمح بأي شكل من أشكال الهجمات الشخصية أو المضايقة أو التنمر أو خطاب الكراهية. نحتفي بروح الدعابة من كل ثقافة.",
    },
    {
      title: "المحتوى الأصلي فقط",
      description:
        "حمّل فقط الميمات التي أنشأتها أو لديك حق مشاركتها. لا تدّعي عمل شخص آخر على أنه عملك. إذا كنت تشارك ميمًا موجودًا، فاذكر المنشئ الأصلي.",
    },
    {
      title: "ممنوع المحتوى الضار",
      description:
        "لا تنشر محتوى يروج للعنف أو الأنشطة غير القانونية أو إيذاء النفس أو الاستغلال. يجب أن تكون الميمات مضحكة وليست ضارة.",
    },
    {
      title: "ممنوع البريد العشوائي والترويج الذاتي",
      description:
        "لا تنشر محتوى متكررًا أو إعلانات أو تستخدم المنصة فقط للترويج لمنتجات أو خدمات خارجية.",
    },
    {
      title: "جودة الترجمة",
      description:
        "عند اقتراح تعديلات الترجمة، اسعَ للدقة الثقافية. يجب أن تلتقط الترجمات الروح والفكاهة وليس المعنى الحرفي فقط. احترم الفروق الدقيقة لكل لغة.",
    },
    {
      title: "وضع العلامات المناسبة",
      description:
        "استخدم فئات وعلامات دقيقة لميماتك. العلامات المضللة تضر بقابلية الاكتشاف وتجربة المجتمع.",
    },
    {
      title: "احترم الاختلافات الثقافية",
      description:
        "تختلف الفكاهة عبر الثقافات. ما هو مضحك في ثقافة ما قد يكون مسيئًا في ثقافة أخرى. شارك بفضول وانفتاح وليس بحكم.",
    },
    {
      title: "أبلغ ولا تنتقم",
      description:
        "إذا رأيت محتوى يخالف القواعد، استخدم زر الإبلاغ. لا تشارك في الجدالات أو تنتقم. دع المشرفين يتعاملون مع الأمر.",
    },
  ],
  enforcement: {
    title: "التنفيذ",
    levels: [
      { level: "المخالفة الأولى", action: "تحذير عبر الإشعارات" },
      { level: "المخالفة الثانية", action: "إزالة المحتوى + تقييد النشر لمدة 24 ساعة" },
      { level: "المخالفة الثالثة", action: "تعليق الحساب لمدة 7 أيام" },
      { level: "مخالفة خطيرة", action: "حظر دائم (بدون تحذيرات لخطاب الكراهية والمحتوى غير القانوني وغيرها)" },
    ],
  },
  footer: {
    questionsText: "أسئلة حول هذه القواعد؟ تواصل معنا على support@mimzy.app",
    termsLink: "شروط الخدمة",
    privacyLink: "سياسة الخصوصية",
    settingsLink: "الإعدادات",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOOKUP MAPS
// ═══════════════════════════════════════════════════════════════════════════════

const legalMap: Record<LegalLang, LegalContent> = {
  en: legalEN,
  ko: legalKO,
  ja: legalJA,
  zh: legalZH,
  es: legalES,
  hi: legalHI,
  ar: legalAR,
};

const rulesMap: Record<LegalLang, RulesContent> = {
  en: rulesEN,
  ko: rulesKO,
  ja: rulesJA,
  zh: rulesZH,
  es: rulesES,
  hi: rulesHI,
  ar: rulesAR,
};

export function getLegalContent(lang: string): LegalContent {
  return legalMap[lang as LegalLang] ?? legalEN;
}

export function getRulesContent(lang: string): RulesContent {
  return rulesMap[lang as LegalLang] ?? rulesEN;
}
