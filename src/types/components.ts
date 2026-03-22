// ============================================================================
// LoLympic — Component-level types (flat segment for rendering)
// ============================================================================

export interface TranslationSegmentData {
  id: string;
  imageIndex?: number;
  sourceText: string;
  translatedText: string;
  semanticRole: string;
  boxX: number | null;
  boxY: number | null;
  boxWidth: number | null;
  boxHeight: number | null;
  fontFamily?: string;
  fontWeight?: number;
  fontSizePixels?: number;
  color?: string;
  backgroundColor?: string;
  textAlign?: string;
  rotation?: number;
  isUppercase?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  fontHint?: string;
}

export interface MemeRendererProps {
  imageUrl: string;
  cleanImageUrl?: string;
  translatedImageUrl?: string;
  segments: TranslationSegmentData[];
  width?: number;
  height?: number;
  showTranslation?: boolean;
}

export const LANGUAGE_FONT_DEFAULTS: Record<string, string> = {
  ko: "Noto Sans KR",
  ja: "Noto Sans JP",
  zh: "Noto Sans SC",
  en: "Impact",
  es: "Arial",
  hi: "Noto Sans Devanagari",
  ar: "Noto Sans Arabic",
};
