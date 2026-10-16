import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormWorkOrderBaru } from "./FormWorkOrderBaru";

export default async function HalamanWorkOrderBaru() {
  const profil = await ambilProfilSaya();

  // Hanya Admin dan Owner yang berhak membuat WO baru (PRD 6.7)
  if (profil.peran !== "admin" && profil.peran !== "owner") {
    redirect("/work-orders");
  }

  const supabase = await createClient();

  // Ambil daftar kepala mekanik beserta hitungan WO aktif tiap tim (PRD 6.7)
  const { data: kepalaMekanik } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  const { data: woAktif } = await supabase
    .from("work_orders")
    .select("kepala_mekanik_id")
    .in("status", ["menunggu", "dikerjakan", "tertunda"]);

  const daftarTim = (kepalaMekanik ?? []).map((km) => {
    const aktif = (woAktif ?? []).filter((w) => w.kepala_mekanik_id === km.id).length;
    return {
      id: km.id,
      nama: km.nama,
      woAktif: aktif,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/work-orders"
          className="rounded-lg border border-border p-2 hover:bg-muted text-muted-foreground hover:text-text transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-text">Penerimaan Mobil (WO Baru)</h1>
          <p className="text-sm text-text-muted">
            Ketik plat nomor kendaraan untuk mendeteksi data mobil dan pelanggan otomatis
          </p>
        </div>
      </div>

      <FormWorkOrderBaru daftarTim={daftarTim} />
    </div>
  );
}
