"use client";

import { useState } from "react";
import { TranslationSegmentData } from "@/types/components";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface SegmentEditorProps {
  segment: TranslationSegmentData;
  index: number;
  onUpdate: (id: string, updates: Partial<TranslationSegmentData>) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  confidence?: number;
}

export default function SegmentEditor({
  segment,
  index,
  onUpdate,
  onApprove,
  onReject,
  confidence,
}: SegmentEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editText, setEditText] = useState(segment.translatedText);
  const [fontSizeAdjust, setFontSizeAdjust] = useState(0);
  const [positionNudge, setPositionNudge] = useState({ x: 0, y: 0 });

  const handleTextChange = (value: string) => {
    setEditText(value);
    onUpdate(segment.id, { translatedText: value });
  };

  const handleFontSizeAdjust = (delta: number) => {
    const newAdjust = fontSizeAdjust + delta;
    setFontSizeAdjust(newAdjust);
    const baseFontSize = segment.fontSizePixels || 24;
    onUpdate(segment.id, { fontSizePixels: baseFontSize + newAdjust });
  };

  const handleNudge = (dx: number, dy: number) => {
    const newNudge = { x: positionNudge.x + dx, y: positionNudge.y + dy };
    setPositionNudge(newNudge);
    onUpdate(segment.id, {
      boxX: (segment.boxX ?? 0) + newNudge.x,
      boxY: (segment.boxY ?? 0) + newNudge.y,
    });
  };

  return (
    <div className="bg-background-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-background-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-subtle font-mono">#{index + 1}</span>
          <Badge variant="default" size="sm">
            {segment.semanticRole}
          </Badge>
          {confidence !== undefined && (
            <Badge
              variant={confidence > 0.8 ? "success" : confidence > 0.5 ? "warning" : "danger"}
              size="sm"
            >
              {Math.round(confidence * 100)}%
            </Badge>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-foreground-subtle transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Source text preview */}
      <div className="px-3 pb-2">
        <p className="text-xs text-foreground-subtle truncate">{segment.sourceText}</p>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3">
          {/* Translation text */}
          <div>
            <label className="text-xs text-foreground-subtle mb-1 block">Translation</label>
            <textarea
              value={editText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-[#c9a84c]/50"
              rows={2}
            />
          </div>

          {/* Font size adjustment */}
          <div>
            <label className="text-xs text-foreground-subtle mb-1 block">Font Size</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFontSizeAdjust(-2)}
                className="w-8 h-8 bg-background-elevated border border-border-hover rounded-md text-foreground-muted hover:text-foreground hover:border-border-active transition-colors flex items-center justify-center text-sm"
              >
                -
              </button>
              <span className="text-xs text-foreground-subtle w-16 text-center">
                {fontSizeAdjust >= 0 ? "+" : ""}
                {fontSizeAdjust}px
              </span>
              <button
                onClick={() => handleFontSizeAdjust(2)}
                className="w-8 h-8 bg-background-elevated border border-border-hover rounded-md text-foreground-muted hover:text-foreground hover:border-border-active transition-colors flex items-center justify-center text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Position nudge */}
          <div>
            <label className="text-xs text-foreground-subtle mb-1 block">Position</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleNudge(-2, 0)}
                className="w-8 h-8 bg-background-elevated border border-border-hover rounded-md text-foreground-muted hover:text-foreground hover:border-border-active transition-colors flex items-center justify-center text-xs"
              >
                ←
              </button>
              <button
                onClick={() => handleNudge(0, -2)}
                className="w-8 h-8 bg-background-elevated border border-border-hover rounded-md text-foreground-muted hover:text-foreground hover:border-border-active transition-colors flex items-center justify-center text-xs"
              >
                ↑
              </button>
              <button
                onClick={() => handleNudge(0, 2)}
                className="w-8 h-8 bg-background-elevated border border-border-hover rounded-md text-foreground-muted hover:text-foreground hover:border-border-active transition-colors flex items-center justify-center text-xs"
              >
                ↓
              </button>
              <button
                onClick={() => handleNudge(2, 0)}
                className="w-8 h-8 bg-background-elevated border border-border-hover rounded-md text-foreground-muted hover:text-foreground hover:border-border-active transition-colors flex items-center justify-center text-xs"
              >
                →
              </button>
              <span className="text-xs text-foreground-subtle ml-2">
                ({positionNudge.x}, {positionNudge.y})
              </span>
            </div>
          </div>

          {/* Approve/Reject */}
          {(onApprove || onReject) && (
            <div className="flex items-center gap-2 pt-1">
              {onApprove && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onApprove(segment.id)}
                >
                  Approve
                </Button>
              )}
              {onReject && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onReject(segment.id)}
                >
                  Reject
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
