"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { kompresFotoUtama, kompresThumbnail } from "@/lib/kompresi";

interface FotoItem {
  id: string;
  jenis: "stnk" | "kondisi_awal" | "pengerjaan" | "kondisi_akhir";
  url: string;
  path: string;
}

interface GaleriFotoWOProps {
  woId: string;
  status: string;
  daftarFoto: FotoItem[];
  bolehUnggahAkhir: boolean;
  bolehUnggahPengerjaan?: boolean;
}

export function GaleriFotoWO({
  woId,
  status,
  daftarFoto,
  bolehUnggahAkhir,
}: GaleriFotoWOProps) {
  const router = useRouter();
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const [unggahLoading, setUnggahLoading] = useState<string | null>(null);
  const [errorUnggah, setErrorUnggah] = useState<string | null>(null);

  const fotoStnk = daftarFoto.find((f) => f.jenis === "stnk");
  const fotoAwal = daftarFoto.filter((f) => f.jenis === "kondisi_awal");
  const fotoAkhir = daftarFoto.filter((f) => f.jenis === "kondisi_akhir");

  const uploadFotoBaru = async (
    files: FileList | null,
    jenis: "pengerjaan" | "kondisi_akhir",
  ) => {
    if (!files || files.length === 0) return;
    setErrorUnggah(null);

    startTransition(async () => {
      try {
        setUnggahLoading(`Mengompresi dan mengunggah foto ${jenis}...`);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileUtama = await kompresFotoUtama(file);
          const fileThumb = await kompresThumbnail(file);
          const extId = crypto.randomUUID();

          const pathUtama = `${woId}/${jenis}/${extId}.webp`;
          const pathThumb = `${woId}/${jenis}/thumb/${extId}.webp`;

          await supabase.storage.from("foto-wo").upload(pathUtama, fileUtama, { contentType: "image/webp" });
          await supabase.storage.from("foto-wo").upload(pathThumb, fileThumb, { contentType: "image/webp" });

          await supabase.from("work_order_photos").insert({
            work_order_id: woId,
            jenis,
            path: pathUtama,
          });
        }
        setUnggahLoading(null);
        router.refresh();
      } catch (err: unknown) {
        setUnggahLoading(null);
        setErrorUnggah((err as Error).message || "Gagal mengunggah foto");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ImageIcon className="size-5 text-primary" />
          Dokumentasi Foto (Privat)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Foto STNK & Foto Awal */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* STNK */}
          <div>
            <Label className="text-xs font-semibold uppercase text-text-muted">
              Foto STNK
            </Label>
            <div className="mt-2">
              {fotoStnk ? (
                <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border">
                  <img
                    src={fotoStnk.url}
                    alt="STNK Mobil"
                    className="size-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-xs text-text-muted">
                  Foto STNK tidak tersedia
                </div>
              )}
            </div>
          </div>

          {/* Kondisi Awal */}
          <div>
            <Label className="text-xs font-semibold uppercase text-text-muted">
              Foto Kondisi Awal ({fotoAwal.length})
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {fotoAwal.length === 0 ? (
                <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-xs text-text-muted">
                  Belum ada foto kondisi awal
                </div>
              ) : (
                fotoAwal.map((f) => (
                  <div
                    key={f.id}
                    className="relative size-24 overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={f.url}
                      alt="Kondisi Awal"
                      className="size-full object-cover"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Foto Kondisi Akhir (Syarat Penyerahan Mobil PRD 6.8 & 7.2) */}
        <div className="border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-xs font-semibold uppercase text-text-muted">
                Foto Kondisi Akhir ({fotoAkhir.length})
              </Label>
              <p className="text-xs text-text-muted">
                Wajib diunggah minimal 1 foto sebelum mobil diserahkan
              </p>
            </div>
            {bolehUnggahAkhir && status === "siap_diambil" && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted">
                <Upload className="size-3.5" />
                + Unggah Foto Akhir
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => uploadFotoBaru(e.target.files, "kondisi_akhir")}
                />
              </label>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {fotoAkhir.length === 0 ? (
              <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-xs text-text-muted">
                Belum ada foto kondisi akhir (unggah saat status Siap Diambil)
              </div>
            ) : (
              fotoAkhir.map((f) => (
                <div
                  key={f.id}
                  className="relative size-24 overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={f.url}
                    alt="Kondisi Akhir"
                    className="size-full object-cover"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Loading & Error */}
        {unggahLoading && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="size-3.5 animate-spin" />
            <span>{unggahLoading}</span>
          </div>
        )}
        {errorUnggah && <p className="text-xs text-destructive">{errorUnggah}</p>}
      </CardContent>
    </Card>
  );
}
