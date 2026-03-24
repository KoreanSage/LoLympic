import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

export interface SessionUser {
  id: string;
  username: string;
  countryId: string;
  preferredLanguage: string;
  role?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = session.user;
  return {
    id: user.id,
    username: user.username || user.email?.split("@")[0] || "unknown",
    countryId: user.countryId || "US",
    preferredLanguage: user.preferredLanguage || "en",
    role: user.role || "USER",
    email: user.email || undefined,
    displayName: user.displayName || user.name || undefined,
    avatarUrl: user.avatarUrl || user.image || undefined,
  };
}
