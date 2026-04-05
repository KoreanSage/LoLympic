// Metadata is handled in page.tsx to avoid duplicate DB queries

interface Props {
  children: React.ReactNode;
}

export default function PostLayout({ children }: Props) {
  return children;
}
