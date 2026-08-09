import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, UsernameOnboarding } from "@/components/auth";
import { getOwnerSession } from "@/lib/auth/session";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";

export const metadata: Metadata = { title: "Nama Pengguna" };

type OnboardingPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNextPath(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { next } = await searchParams;
  const destination = safeNextPath(next);
  const session = await getOwnerSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  const profile = await backendRepositories.users.getUser(session.uid);
  if (profile?.username) redirect(destination);

  return (
    <AuthShell
      eyebrow="KENANGIN · OWNER SETUP"
      title="Sebelum masuk, kasih nama untuk workspace-mu."
      description="Satu identitas kecil untuk semua Room yang kamu kelola. Nama ini datang dari pilihanmu sendiri, bukan otomatis dari provider login."
      footer={<p>Profil ini hanya perlu disiapkan sekali.</p>}
    >
      <UsernameOnboarding nextPath={destination} />
    </AuthShell>
  );
}
