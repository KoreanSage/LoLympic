"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import UploadStudio from "@/components/upload/UploadStudio";

export default function UploadPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <MainLayout showSidebar={false}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="py-6">
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">
          Share a Meme
        </h1>
        <p className="text-sm text-foreground-subtle text-center mb-8">
          Upload a meme and we&apos;ll translate it to 5 languages automatically.
        </p>
        <UploadStudio />
      </div>
    </MainLayout>
  );
}
