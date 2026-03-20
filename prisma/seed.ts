import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed countries
  const countries = [
    // Korean
    { id: "KR", nameEn: "South Korea", nameLocal: "대한민국", flagEmoji: "\u{1F1F0}\u{1F1F7}" },
    // English
    { id: "US", nameEn: "United States", nameLocal: "United States", flagEmoji: "\u{1F1FA}\u{1F1F8}" },
    { id: "GB", nameEn: "United Kingdom", nameLocal: "United Kingdom", flagEmoji: "\u{1F1EC}\u{1F1E7}" },
    { id: "AU", nameEn: "Australia", nameLocal: "Australia", flagEmoji: "\u{1F1E6}\u{1F1FA}" },
    { id: "CA", nameEn: "Canada", nameLocal: "Canada", flagEmoji: "\u{1F1E8}\u{1F1E6}" },
    // Japanese
    { id: "JP", nameEn: "Japan", nameLocal: "日本", flagEmoji: "\u{1F1EF}\u{1F1F5}" },
    // Chinese
    { id: "CN", nameEn: "China", nameLocal: "中国", flagEmoji: "\u{1F1E8}\u{1F1F3}" },
    { id: "TW", nameEn: "Taiwan", nameLocal: "臺灣", flagEmoji: "\u{1F1F9}\u{1F1FC}" },
    { id: "HK", nameEn: "Hong Kong", nameLocal: "香港", flagEmoji: "\u{1F1ED}\u{1F1F0}" },
    // Spanish
    { id: "MX", nameEn: "Mexico", nameLocal: "México", flagEmoji: "\u{1F1F2}\u{1F1FD}" },
    { id: "ES", nameEn: "Spain", nameLocal: "España", flagEmoji: "\u{1F1EA}\u{1F1F8}" },
    { id: "AR", nameEn: "Argentina", nameLocal: "Argentina", flagEmoji: "\u{1F1E6}\u{1F1F7}" },
    { id: "CO", nameEn: "Colombia", nameLocal: "Colombia", flagEmoji: "\u{1F1E8}\u{1F1F4}" },
    { id: "CL", nameEn: "Chile", nameLocal: "Chile", flagEmoji: "\u{1F1E8}\u{1F1F1}" },
    // Hindi
    { id: "IN", nameEn: "India", nameLocal: "भारत", flagEmoji: "\u{1F1EE}\u{1F1F3}" },
    // Arabic
    { id: "SA", nameEn: "Saudi Arabia", nameLocal: "السعودية", flagEmoji: "\u{1F1F8}\u{1F1E6}" },
    { id: "EG", nameEn: "Egypt", nameLocal: "مصر", flagEmoji: "\u{1F1EA}\u{1F1EC}" },
    { id: "AE", nameEn: "UAE", nameLocal: "الإمارات", flagEmoji: "\u{1F1E6}\u{1F1EA}" },
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
