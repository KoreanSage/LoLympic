"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ImageCarouselProps {
  children: React.ReactNode[];
  className?: string;
}

export default function ImageCarousel({ children, className = "" }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isDragging = useRef(false);
  const total = children.length;

  const goTo = useCallback(
    (index: number) => {
      setCurrent(Math.max(0, Math.min(index, total - 1)));
    },
    [total]
  );

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current < 0) goTo(current + 1);
      else goTo(current - 1);
    }
    touchDeltaX.current = 0;
  };

  if (total <= 1) {
    return <div className={className}>{children[0]}</div>;
  }

  return (
    <div className={`relative group ${className}`}>
      {/* Track */}
      <div
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={trackRef}
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {children.map((child, i) => (
            <div key={i} className="w-full flex-shrink-0">
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Left arrow */}
      {current > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goTo(current - 1);
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Right arrow */}
      {current < total - 1 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goTo(current + 1);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {children.map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goTo(i);
            }}
            className={`rounded-full transition-all duration-200 ${
              i === current
                ? "w-2 h-2 bg-white"
                : "w-1.5 h-1.5 bg-white/50 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* Counter badge */}
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs z-10">
        {current + 1}/{total}
      </div>
    </div>
  );
}
