"use client";

import { useState } from "react";
import MemeRenderer from "@/components/translation/MemeRenderer";
import TranslationToggle from "@/components/translation/TranslationToggle";
import SegmentEditor from "@/components/translation/SegmentEditor";
import { TranslationSegmentData } from "@/types/components";

interface TranslationPreviewProps {
  imageUrl: string;
  segments: TranslationSegmentData[];
  onSegmentUpdate: (id: string, updates: Partial<TranslationSegmentData>) => void;
  confidenceMap?: Record<string, number>;
  className?: string;
}

export default function TranslationPreview({
  imageUrl,
  segments,
  onSegmentUpdate,
  confidenceMap = {},
  className = "",
}: TranslationPreviewProps) {
  const [showTranslation, setShowTranslation] = useState(true);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Image preview with MemeRenderer */}
      <div>
        <div className="flex justify-center mb-3">
          <TranslationToggle
            showTranslation={showTranslation}
            onChange={setShowTranslation}
          />
        </div>
        <div className="rounded-lg overflow-hidden">
          <MemeRenderer
            imageUrl={imageUrl}
            segments={segments}
            showTranslation={showTranslation}
          />
        </div>
      </div>

      {/* Segment editors */}
      {segments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-foreground-subtle px-1">
            Segments ({segments.length})
          </h4>
          {segments.map((seg, i) => (
            <SegmentEditor
              key={seg.id}
              segment={seg}
              index={i}
              onUpdate={onSegmentUpdate}
              confidence={confidenceMap[seg.id]}
            />
          ))}
        </div>
      )}

      {segments.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-foreground-subtle">
            No text segments detected yet. Run detection first.
          </p>
        </div>
      )}
    </div>
  );
}
