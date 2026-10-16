import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormSetelan, type WorkshopSettingsData } from "./FormSetelan";

export default async function HalamanSetelan() {
  const profil = await ambilProfilSaya();

  // PRD 6.11 & 2.3: Menu Setelan Bengkel hanya untuk Owner
  if (profil.peran !== "owner") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <Card className="border-danger/30 bg-danger/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <ShieldAlert className="size-6 text-danger" />
            <CardTitle className="text-danger">Akses Dibatasi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Halaman setelan bengkel hanya dapat diakses oleh peran <strong>Owner</strong>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: rawSettings, error } = await supabase
    .from("workshop_settings")
    .select("id, nama, alamat, telepon, jam_buka, logo_path, galeri_paths")
    .eq("id", 1)
    .single();

  if (error || !rawSettings) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <Card>
          <CardContent className="py-10 text-center text-danger">
            Gagal memuat pengaturan bengkel. Pastikan data awal telah diinisialisasi.
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings: WorkshopSettingsData = {
    id: rawSettings.id,
    nama: rawSettings.nama,
    alamat: rawSettings.alamat,
    telepon: rawSettings.telepon,
    jam_buka: rawSettings.jam_buka,
    logo_path: rawSettings.logo_path,
    galeri_paths: (rawSettings.galeri_paths as string[]) ?? [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <p className="text-sm text-muted-foreground">
          Kelola profil bengkel, logo identitas, dan galeri foto halaman depan.
        </p>
      </div>

      <FormSetelan settings={settings} />
    </div>
  );
}
