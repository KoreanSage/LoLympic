import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed countries
  const countries = [
    { id: "KR", nameEn: "South Korea", nameLocal: "대한민국", flagEmoji: "\u{1F1F0}\u{1F1F7}" },
    { id: "US", nameEn: "United States", nameLocal: "United States", flagEmoji: "\u{1F1FA}\u{1F1F8}" },
    { id: "JP", nameEn: "Japan", nameLocal: "日本", flagEmoji: "\u{1F1EF}\u{1F1F5}" },
    { id: "CN", nameEn: "China", nameLocal: "中国", flagEmoji: "\u{1F1E8}\u{1F1F3}" },
    { id: "MX", nameEn: "Mexico", nameLocal: "México", flagEmoji: "\u{1F1F2}\u{1F1FD}" },
  ];

  for (const country of countries) {
    await prisma.country.upsert({
      where: { id: country.id },
      update: country,
      create: country,
    });
  }

  console.log("Seeded countries:", countries.map((c) => c.id).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
