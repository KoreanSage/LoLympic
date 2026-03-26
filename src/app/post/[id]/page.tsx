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
        images: { take: 1, select: { originalUrl: true } },
      },
    });

    if (!post) {
      return { title: "Post Not Found" };
    }

    const description = post.body
      ? post.body.slice(0, 160)
      : `Check out this meme on LoLympic!`;
    const imageUrl = post.images[0]?.originalUrl;

    return {
      title: post.title,
      description,
      openGraph: {
        title: post.title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        images: imageUrl ? [imageUrl] : [],
      },
    };
  } catch {
    return { title: "LoLympic" };
  }
}

export default function PostPage() {
  return <PostPageClient />;
}
