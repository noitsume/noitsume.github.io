import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm, AuthShell } from "@/components/auth";
import { getOwnerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage() {
  const existingSession = await getOwnerSession();
  if (existingSession) redirect("/dashboard");

  return (
    <AuthShell
      eyebrow="KENANGIN · CREATE OWNER"
      title="Bikin kejutan, bukan sekadar template."
      description="Buat akun owner untuk memulai Room, mengumpulkan momen dari orang-orang terdekat, lalu menyusunnya menjadi pengalaman Receiver."
      footer={<p>Sudah punya akun? <Link href="/login">Masuk ke Kenangin</Link></p>}
    >
      <AuthForm mode="register" />
    </AuthShell>
  );
}
