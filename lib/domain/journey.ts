import type { RoomStatus } from "@/lib/data/contracts";

export const journeyStages = [
  { id: "collecting", label: "Kumpulkan", description: "Ajak orang terdekat" },
  { id: "closed", label: "Pilih momen", description: "Periksa kiriman" },
  { id: "configuring", label: "Susun cerita", description: "Media, suasana & musik" },
  { id: "baking", label: "Terbitkan", description: "Siapkan halaman hadiah" },
  { id: "ready", label: "Bagikan", description: "Kejutan siap dibuka" },
] as const;

export function journeyLabel(status: RoomStatus) {
  return journeyStages.find((stage) => stage.id === status)!.label;
}

export function roomDestination(room: { id: string; status: RoomStatus }) {
  const base = `/rooms/${encodeURIComponent(room.id)}`;
  if (room.status === "ready") return { href: `${base}/finish`, label: "Bagikan kejutan" };
  if (room.status === "configuring") return { href: `${base}/studio`, label: "Lanjutkan cerita" };
  if (room.status === "baking") return { href: `${base}/bake`, label: "Lihat penerbitan" };
  return { href: base, label: room.status === "closed" ? "Pilih kiriman" : "Kumpulkan momen" };
}

export function workspaceGuidance(status: RoomStatus, pending: number, media: number) {
  if (status === "ready") return { title: "Kejutanmu sudah siap.", detail: "Buka hasilnya, lalu bagikan tautan kepada penerima.", action: "finish" as const };
  if (status === "baking") return { title: "Cerita sedang disiapkan.", detail: "Lihat proses penerbitan dan tautan hasilnya.", action: "bake" as const };
  if (status === "configuring") return { title: "Lanjutkan ceritamu.", detail: "Pilihan yang tersimpan bisa kamu lanjutkan di Studio.", action: "studio" as const };
  if (pending > 0) return { title: `${pending} kiriman menunggu pilihanmu.`, detail: "Lihat kiriman di bawah. Simpan momen yang ingin kamu masukkan.", action: "review" as const };
  if (media === 0) return { title: "Mulai dengan satu kenangan.", detail: status === "collecting" ? "Bagikan tautan pengumpulan atau tambahkan foto dan video sendiri." : "Tambahkan setidaknya satu foto atau video untuk mulai menyusun cerita.", action: "upload" as const };
  if (status === "collecting") return { title: "Sudah cukup momennya?", detail: "Tutup pengumpulan saat semua orang selesai mengirim. Setelah itu, susun kejutanmu.", action: "close" as const };
  return { title: "Momen pilihanmu siap dirangkai.", detail: `${media} media tersedia. Berikutnya pilih suasana, musik, dan gaya cerita.`, action: "studio" as const };
}
