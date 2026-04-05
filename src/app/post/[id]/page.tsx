import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import PostPageClient from "./PostPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        title: true,
        body: true,
        sourceLanguage: true,
        images: { take: 1, select: { originalUrl: true } },
        translationPayloads: {
          where: { status: { in: ["COMPLETED", "APPROVED"] }, translatedImageUrl: { not: null } },
          orderBy: { version: "desc" as const },
          take: 1,
          select: { translatedImageUrl: true, translatedTitle: true, targetLanguage: true },
        },
      },
    });

    if (!post) {
      return { title: "Post Not Found" };
    }

    // Prefer English translated image for OG (most universal),
    // otherwise first available translation, fallback to original
    const enPayload = post.translationPayloads.find((p: any) => p.targetLanguage === "en");
    const anyPayload = post.translationPayloads[0];
    const bestPayload = enPayload || anyPayload;

    const ogImage = bestPayload?.translatedImageUrl || post.images[0]?.originalUrl;
    const ogTitle = bestPayload?.translatedTitle || post.title;
    const description = post.body
      ? post.body.slice(0, 160)
      : `Check out this meme on mimzy — translated to 7 languages!`;

    return {
      title: post.title,
      description,
      openGraph: {
        title: ogTitle,
        description,
        siteName: "mimzy",
        images: ogImage ? [{ url: ogImage, width: 800, height: 800, alt: ogTitle }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: ogTitle,
        images: ogImage ? [ogImage] : [],
      },
    };
  } catch {
    return { title: "mimzy" };
  }
}

export default function PostPage() {
  return <PostPageClient />;
}
