"use client";

import { useCallback, useState, useRef } from "react";

interface ImageUploaderProps {
  onImagesSelected: (files: File[], previewUrls: string[]) => void;
  maxFiles?: number;
  maxImageSizeMB?: number;
  maxVideoSizeMB?: number;
  maxVideoDurationSec?: number;
  acceptedTypes?: string[];
  className?: string;
}

const DEFAULT_ACCEPTED = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm",
];
const DEFAULT_MAX_IMAGE_SIZE_MB = 10;
const DEFAULT_MAX_VIDEO_SIZE_MB = 50;
const DEFAULT_MAX_VIDEO_DURATION_SEC = 60;

const VIDEO_TYPES = ["video/mp4", "video/webm"];

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Could not read video"));
    };
    video.src = URL.createObjectURL(file);
  });
}

export default function ImageUploader({
  onImagesSelected,
  maxFiles = 10,
  maxImageSizeMB = DEFAULT_MAX_IMAGE_SIZE_MB,
  maxVideoSizeMB = DEFAULT_MAX_VIDEO_SIZE_MB,
  maxVideoDurationSec = DEFAULT_MAX_VIDEO_DURATION_SEC,
  acceptedTypes = DEFAULT_ACCEPTED,
  className = "",
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null);
      const files = Array.from(fileList).slice(0, maxFiles);

      if (files.length === 0) return;

      setValidating(true);
      try {
        for (const file of files) {
          if (!acceptedTypes.includes(file.type)) {
            setError("Invalid file type. Supported: JPEG, PNG, WebP, GIF, MP4, WebM.");
            return;
          }

          const isVideo = VIDEO_TYPES.includes(file.type);
          const maxSize = isVideo ? maxVideoSizeMB : maxImageSizeMB;

          if (file.size > maxSize * 1024 * 1024) {
            setError(`File too large. Max ${isVideo ? "video" : "image"} size is ${maxSize}MB.`);
            return;
          }

          if (isVideo) {
            try {
              const duration = await getVideoDuration(file);
              if (duration > maxVideoDurationSec) {
                setError(`Video too long. Maximum duration is ${maxVideoDurationSec} seconds.`);
                return;
              }
            } catch {
              setError("Could not read video file. Please try a different format.");
              return;
            }
          }
        }

        const previewUrls = files.map((f) => URL.createObjectURL(f));
        onImagesSelected(files, previewUrls);
      } finally {
        setValidating(false);
      }
    },
    [acceptedTypes, maxImageSizeMB, maxVideoSizeMB, maxVideoDurationSec, maxFiles, onImagesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) validateAndSelect(e.dataTransfer.files);
    },
    [validateAndSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) validateAndSelect(e.target.files);
      // Reset so selecting same files again triggers change
      if (inputRef.current) inputRef.current.value = "";
    },
    [validateAndSelect]
  );

  return (
    <div
      className={`relative ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={validating}
        className={`
          w-full aspect-[4/3] rounded-xl border-2 border-dashed transition-all duration-200
          flex flex-col items-center justify-center gap-3 cursor-pointer
          ${
            isDragging
              ? "border-[#c9a84c] bg-[#c9a84c]/5"
              : "border-border-hover bg-background-surface hover:border-border-active hover:bg-background-elevated"
          }
          ${validating ? "opacity-60 pointer-events-none" : ""}
        `}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isDragging ? "bg-[#c9a84c]/10" : "bg-background-elevated"
          }`}
        >
          {validating ? (
            <div className="w-6 h-6 border-2 border-border-active border-t-[#c9a84c] rounded-full animate-spin" />
          ) : (
            <svg
              className={`w-6 h-6 ${isDragging ? "text-[#c9a84c]" : "text-foreground-subtle"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm text-foreground-muted">
            {validating ? "Checking files..." : isDragging ? "Drop your files here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs text-foreground-subtle mt-1">
            Images (max {maxImageSizeMB}MB) or videos (max {maxVideoSizeMB}MB, {maxVideoDurationSec}s)
          </p>
          <p className="text-[11px] text-foreground-subtle mt-1.5 opacity-60">
            JPEG, PNG, WebP, GIF, MP4, WebM
          </p>
        </div>
      </button>

      {error && (
        <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
