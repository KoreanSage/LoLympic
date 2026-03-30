import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://mimzy.gg";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/leaderboard`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/tournament`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/hall-of-fame`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/seasons`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/rules`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/signup`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamic post pages
  let postPages: MetadataRoute.Sitemap = [];
  try {
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    postPages = posts.map((post) => ({
      url: `${BASE_URL}/post/${post.id}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // If DB is unavailable, return only static pages
  }

  return [...staticPages, ...postPages];
}
