import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "ACTIVE";

  const events = await prisma.countryVsEvent.findMany({
    where: { status },
    include: {
      country1: { select: { id: true, nameEn: true, flagEmoji: true } },
      country2: { select: { id: true, nameEn: true, flagEmoji: true } },
    },
    orderBy: { startAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.role || !["ADMIN", "SUPER_ADMIN"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, country1Id, country2Id, startAt, endAt } = body;

  if (!title || !country1Id || !country2Id || !startAt || !endAt)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const event = await prisma.countryVsEvent.create({
    data: {
      title,
      country1Id,
      country2Id,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      status: new Date(startAt) <= new Date() ? "ACTIVE" : "UPCOMING",
      createdById: user.id,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
