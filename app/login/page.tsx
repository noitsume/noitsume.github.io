import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm, AuthShell } from "@/components/auth";
import { getOwnerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Login" };

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const existingSession = await getOwnerSession();
  if (existingSession) redirect("/dashboard");

  const { next } = await searchParams;

  return (
    <AuthShell
      eyebrow="KENANGIN.ID · OWNER"
      title="Kenangan besar dimulai dari satu Room."
      description="Masuk untuk mengelola pengumpulan momen, menyusun pengalaman, lalu menyiapkan kejutan yang terasa personal."
      footer={<p>Belum punya akun? <Link href="/register">Daftar sebagai owner</Link></p>}
    >
      <AuthForm mode="login" nextPath={next} />
    </AuthShell>
  );
}
