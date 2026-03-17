// ============================================================================
// LoLympic — TypeScript Types
// Mirrors prisma/schema.prisma enums and models
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export enum UserRole {
  USER = "USER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export enum LanguageCode {
  ko = "ko",
  en = "en",
  ja = "ja",
  zh = "zh",
  es = "es",
}

export enum PostStatus {
  DRAFT = "DRAFT",
  PROCESSING = "PROCESSING",
  PUBLISHED = "PUBLISHED",
  HIDDEN = "HIDDEN",
  REMOVED = "REMOVED",
}

export enum Visibility {
  PUBLIC = "PUBLIC",
  UNLISTED = "UNLISTED",
  PRIVATE = "PRIVATE",
}

export enum TranslationPayloadStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUPERSEDED = "SUPERSEDED",
}

export enum CreatorType {
  AI = "AI",
  COMMUNITY = "COMMUNITY",
  ADMIN = "ADMIN",
}

export enum SemanticRole {
  HEADLINE = "HEADLINE",
  CAPTION = "CAPTION",
  DIALOGUE = "DIALOGUE",
  LABEL = "LABEL",
  WATERMARK = "WATERMARK",
  SUBTITLE = "SUBTITLE",
  OVERLAY = "OVERLAY",
  OTHER = "OTHER",
}

export enum TextAlign {
  LEFT = "LEFT",
  CENTER = "CENTER",
  RIGHT = "RIGHT",
}

export enum CommentStatus {
  VISIBLE = "VISIBLE",
  HIDDEN = "HIDDEN",
  REMOVED = "REMOVED",
}

export enum SuggestionType {
  TRANSLATION = "TRANSLATION",
  CULTURE_NOTE = "CULTURE_NOTE",
}

export enum SuggestionStatus {
  PENDING = "PENDING",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUPERSEDED = "SUPERSEDED",
}

export enum TargetEntityType {
  TRANSLATION_PAYLOAD = "TRANSLATION_PAYLOAD",
  TRANSLATION_SEGMENT = "TRANSLATION_SEGMENT",
  CULTURE_NOTE = "CULTURE_NOTE",
}

export enum ReactionType {
  FIRE = "FIRE",
  LAUGH = "LAUGH",
  SKULL = "SKULL",
  HEART = "HEART",
  CRY = "CRY",
}

export enum SeasonStatus {
  UPCOMING = "UPCOMING",
  ACTIVE = "ACTIVE",
  JUDGING = "JUDGING",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

export enum SeasonEntryStatus {
  SUBMITTED = "SUBMITTED",
  QUALIFIED = "QUALIFIED",
  DISQUALIFIED = "DISQUALIFIED",
  WITHDRAWN = "WITHDRAWN",
}

export enum MedalType {
  GOLD = "GOLD",
  SILVER = "SILVER",
  BRONZE = "BRONZE",
}

export enum MedalScope {
  COUNTRY = "COUNTRY",
  CREATOR = "CREATOR",
  MEME = "MEME",
  TRANSLATOR = "TRANSLATOR",
  CULTURE_CONTRIBUTOR = "CULTURE_CONTRIBUTOR",
  EDITOR = "EDITOR",
}

export enum RewardType {
  PROFILE_BORDER = "PROFILE_BORDER",
  PROFILE_TITLE = "PROFILE_TITLE",
  BADGE = "BADGE",
  FLAIR = "FLAIR",
  CUSTOM = "CUSTOM",
}

export enum ReportStatus {
  PENDING = "PENDING",
  REVIEWING = "REVIEWING",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED",
}

export enum NotificationType {
  REACTION = "REACTION",
  COMMENT = "COMMENT",
  REPLY = "REPLY",
  SUGGESTION = "SUGGESTION",
  SUGGESTION_APPROVED = "SUGGESTION_APPROVED",
  MEDAL_AWARDED = "MEDAL_AWARDED",
  REWARD_GRANTED = "REWARD_GRANTED",
  FOLLOW = "FOLLOW",
  SEASON_START = "SEASON_START",
  SEASON_END = "SEASON_END",
  SYSTEM = "SYSTEM",
}

export enum CultureNoteStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUPERSEDED = "SUPERSEDED",
}

// ============================================================================
// RENDERING TYPES
// ============================================================================

/** Style metadata for a single translation segment (text block on image) */
export interface TranslationSegmentStyle {
  fontFamily: string | null;
  fontWeight: number | null;
  fontSizePixels: number | null;
  lineHeightRatio: number | null;
  letterSpacing: number | null;
  color: string | null;
  backgroundColor: string | null;
  textAlign: TextAlign;
  rotation: number | null;
  isUppercase: boolean;
  strokeColor: string | null;
  strokeWidth: number | null;
  shadowColor: string | null;
  shadowOffsetX: number | null;
  shadowOffsetY: number | null;
  shadowBlur: number | null;
  fontHint: string | null;
}

/** Complete data for a translation segment, used by the rendering engine */
export interface TranslationSegmentData {
  id: string;
  orderIndex: number;
  sourceText: string;
  translatedText: string;
  semanticRole: SemanticRole;

  // Absolute box coordinates (pixels)
  boxX: number | null;
  boxY: number | null;
  boxWidth: number | null;
  boxHeight: number | null;

  // Style metadata
  style: TranslationSegmentStyle;
}

// ============================================================================
// LANGUAGE CONFIG
// ============================================================================

export interface LanguageConfig {
  code: LanguageCode;
  nameEn: string;
  nameNative: string;
  fontHint: string;
  direction: "ltr" | "rtl";
}

export const LANGUAGE_CONFIG_MAP: Record<LanguageCode, LanguageConfig> = {
  [LanguageCode.ko]: {
    code: LanguageCode.ko,
    nameEn: "Korean",
    nameNative: "\ud55c\uad6d\uc5b4",
    fontHint: "Noto Sans KR",
    direction: "ltr",
  },
  [LanguageCode.en]: {
    code: LanguageCode.en,
    nameEn: "English",
    nameNative: "English",
    fontHint: "Impact",
    direction: "ltr",
  },
  [LanguageCode.ja]: {
    code: LanguageCode.ja,
    nameEn: "Japanese",
    nameNative: "\u65e5\u672c\u8a9e",
    fontHint: "Noto Sans JP",
    direction: "ltr",
  },
  [LanguageCode.zh]: {
    code: LanguageCode.zh,
    nameEn: "Chinese",
    nameNative: "\u4e2d\u6587",
    fontHint: "Noto Sans SC",
    direction: "ltr",
  },
  [LanguageCode.es]: {
    code: LanguageCode.es,
    nameEn: "Spanish",
    nameNative: "Espa\u00f1ol",
    fontHint: "Arial",
    direction: "ltr",
  },
};

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

// --- Upload ---

export interface UploadImageRequest {
  file: File;
  postId?: string;
}

export interface UploadImageResponse {
  id: string;
  url: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
}

// --- Translation ---

export interface TranslateRequest {
  postId: string;
  targetLanguage: LanguageCode;
  /** If provided, uses this specific image; otherwise translates all post images */
  imageId?: string;
}

export interface TranslateResponse {
  payloadId: string;
  status: TranslationPayloadStatus;
  segments: TranslationSegmentData[];
  confidence: number | null;
  targetLanguage: LanguageCode;
}

export interface TranslationStatusResponse {
  payloadId: string;
  status: TranslationPayloadStatus;
  progress?: number; // 0-100
  segments?: TranslationSegmentData[];
}

// --- Posts ---

export interface CreatePostRequest {
  title: string;
  body?: string;
  category?: string;
  tags?: string[];
  sourceLanguage: LanguageCode;
  visibility?: Visibility;
  countryId?: string;
  seasonId?: string;
}

export interface UpdatePostRequest {
  title?: string;
  body?: string;
  category?: string;
  tags?: string[];
  visibility?: Visibility;
  status?: PostStatus;
}

export interface PostListParams {
  page?: number;
  limit?: number;
  category?: string;
  countryId?: string;
  seasonId?: string;
  language?: LanguageCode;
  status?: PostStatus;
  sortBy?: "recent" | "popular" | "trending";
}

export interface PostSummary {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  sourceLanguage: LanguageCode;
  status: PostStatus;
  visibility: Visibility;
  reactionCount: number;
  commentCount: number;
  viewCount: number;
  translationCount: number;
  rankingScore: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  country: {
    id: string;
    nameEn: string;
    flagEmoji: string;
  } | null;
  thumbnailUrl: string | null;
  availableLanguages: LanguageCode[];
}

export interface PostDetail extends PostSummary {
  body: string | null;
  shareCount: number;
  saveCount: number;
  updatedAt: string;
  images: Array<{
    id: string;
    originalUrl: string;
    cleanUrl: string | null;
    width: number | null;
    height: number | null;
    altText: string | null;
    orderIndex: number;
  }>;
  translations: Record<LanguageCode, {
    payloadId: string;
    status: TranslationPayloadStatus;
    version: number;
    confidence: number | null;
    creatorType: CreatorType;
    segments: TranslationSegmentData[];
  }>;
  cultureNotes: Array<{
    id: string;
    language: LanguageCode;
    summary: string;
    explanation: string;
    translationNote: string | null;
    creatorType: CreatorType;
    status: CultureNoteStatus;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// --- Suggestions ---

export interface CreateSuggestionRequest {
  postId: string;
  type: SuggestionType;
  targetLanguage?: LanguageCode;
  targetEntityType: TargetEntityType;
  targetEntityId: string;
  originalText: string;
  proposedText: string;
  reason?: string;
}

export interface SuggestionResponse {
  id: string;
  postId: string;
  type: SuggestionType;
  targetLanguage: LanguageCode | null;
  targetEntityType: TargetEntityType;
  targetEntityId: string;
  originalText: string;
  proposedText: string;
  reason: string | null;
  upvoteCount: number;
  downvoteCount: number;
  status: SuggestionStatus;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

// --- Generic API ---

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
