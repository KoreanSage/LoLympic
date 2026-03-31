import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import MainLayout from "@/components/layout/MainLayout";
import CountryBoardFeed from "@/components/community/CountryBoardFeed";
import { getSessionUser } from "@/lib/auth";

export default async function CountryBoardPage({ params }: { params: { id: string } }) {
  const country = await prisma.country.findUnique({
    where: { id: params.id },
    select: { id: true, nameEn: true, flagEmoji: true },
  });
  if (!country) notFound();

  const sessionUser = await getSessionUser();
  let userCountryId: string | undefined;

  if (sessionUser) {
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { countryId: true },
    });
    userCountryId = dbUser?.countryId ?? undefined;
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-2xl mx-auto py-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{country.flagEmoji}</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">{country.nameEn} Board</h1>
            <p className="text-xs text-foreground-subtle">Community posts from {country.nameEn}</p>
          </div>
        </div>
        <CountryBoardFeed countryId={country.id} userCountryId={userCountryId} />
      </div>
    </MainLayout>
  );
}
