"use client";

import MemeRenderer from "./MemeRenderer";
import { TranslationSegmentData } from "@/types/components";

interface CompareModeProps {
  imageUrl: string;
  segments: TranslationSegmentData[];
  className?: string;
}

export default function CompareMode({
  imageUrl,
  segments,
  className = "",
}: CompareModeProps) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      <div>
        <div className="text-xs text-foreground-subtle font-medium mb-2 uppercase tracking-wider">
          Original
        </div>
        <div className="rounded-xl overflow-hidden border border-border">
          <MemeRenderer
            imageUrl={imageUrl}
            segments={segments}
            showTranslation={false}
          />
        </div>
      </div>
      <div>
        <div className="text-xs text-[#c9a84c] font-medium mb-2 uppercase tracking-wider">
          Translated
        </div>
        <div className="rounded-xl overflow-hidden border border-[#c9a84c]/20">
          <MemeRenderer
            imageUrl={imageUrl}
            segments={segments}
            showTranslation={true}
          />
        </div>
      </div>
    </div>
  );
}
