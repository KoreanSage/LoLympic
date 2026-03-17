import Link from "next/link";

const LEGAL_LINKS = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/terms#privacy" },
  { label: "Cookie Policy", href: "/terms#cookies" },
  { label: "Community Rules", href: "/rules" },
  { label: "Copyright / DMCA", href: "/terms#copyright" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border mt-12 py-6">
      <div className="max-w-[1280px] mx-auto px-4">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-3">
          {LEGAL_LINKS.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-center text-[10px] text-foreground-subtle">
          &copy; {new Date().getFullYear()} LoLympic. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
