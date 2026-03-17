"use client";

import { useCallback, useState, useRef } from "react";

interface ImageUploaderProps {
  onImageSelected: (file: File, previewUrl: string) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  className?: string;
}

const DEFAULT_ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DEFAULT_MAX_SIZE_MB = 10;

export default function ImageUploader({
  onImageSelected,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedTypes = DEFAULT_ACCEPTED,
  className = "",
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      if (!acceptedTypes.includes(file.type)) {
        setError("Invalid file type. Please upload JPEG, PNG, WebP, or GIF.");
        return;
      }

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      onImageSelected(file, previewUrl);
    },
    [acceptedTypes, maxSizeMB, onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
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
            {isDragging ? "Drop your image here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs text-foreground-subtle mt-1">
            JPEG, PNG, WebP, or GIF up to {maxSizeMB}MB
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
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
