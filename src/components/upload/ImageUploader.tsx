"use client";

import { useCallback, useState, useRef } from "react";

interface ImageUploaderProps {
  onImagesSelected: (files: File[], previewUrls: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  className?: string;
}

const DEFAULT_ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DEFAULT_MAX_SIZE_MB = 10;

export default function ImageUploader({
  onImagesSelected,
  maxFiles = 10,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedTypes = DEFAULT_ACCEPTED,
  className = "",
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (fileList: FileList | File[]) => {
      setError(null);
      const files = Array.from(fileList).slice(0, maxFiles);

      if (files.length === 0) return;

      for (const file of files) {
        if (!acceptedTypes.includes(file.type)) {
          setError("Invalid file type. Please upload JPEG, PNG, WebP, or GIF.");
          return;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
          setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
          return;
        }
      }

      const previewUrls = files.map((f) => URL.createObjectURL(f));
      onImagesSelected(files, previewUrls);
    },
    [acceptedTypes, maxSizeMB, maxFiles, onImagesSelected]
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
        className={`
          w-full aspect-[4/3] rounded-xl border-2 border-dashed transition-all duration-200
          flex flex-col items-center justify-center gap-3 cursor-pointer
          ${
            isDragging
              ? "border-[#c9a84c] bg-[#c9a84c]/5"
              : "border-border-hover bg-background-surface hover:border-border-active hover:bg-background-elevated"
          }
        `}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isDragging ? "bg-[#c9a84c]/10" : "bg-background-elevated"
          }`}
        >
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
        </div>
        <div className="text-center">
          <p className="text-sm text-foreground-muted">
            {isDragging ? "Drop your images here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs text-foreground-subtle mt-1">
            Up to {maxFiles} images · JPEG, PNG, WebP, or GIF · max {maxSizeMB}MB each
          </p>
          <p className="text-[11px] text-foreground-subtle mt-1.5 opacity-60">
            Tip: Hold ⌘(Cmd) to select multiple files at once
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
