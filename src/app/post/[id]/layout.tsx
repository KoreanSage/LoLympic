import type { Metadata } from "next";
import prisma from "@/lib/prisma";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        title: true,
        body: true,
        author: { select: { username: true, displayName: true } },
        country: { select: { nameEn: true, flagEmoji: true } },
        images: { select: { originalUrl: true }, take: 1 },
      },
    });

    if (!post) {
      return { title: "Post Not Found" };
    }

    const authorName = post.author?.displayName || post.author?.username || "Unknown";
    const description = post.body
      ? post.body.substring(0, 160)
      : `Meme by ${authorName}${post.country ? ` ${post.country.flagEmoji}` : ""} on mimzy`;
    const imageUrl = post.images[0]?.originalUrl;

    return {
      title: post.title,
      description,
      openGraph: {
        title: `${post.title} — mimzy`,
        description,
        type: "article",
        ...(imageUrl && {
          images: [{ url: imageUrl, width: 800, height: 600, alt: post.title }],
        }),
      },
      twitter: {
        card: imageUrl ? "summary_large_image" : "summary",
        title: `${post.title} — mimzy`,
        description,
        ...(imageUrl && { images: [imageUrl] }),
      },
    };
  } catch {
    return { title: "mimzy" };
  }
}

export default function PostLayout({ children }: Props) {
  return children;
}
