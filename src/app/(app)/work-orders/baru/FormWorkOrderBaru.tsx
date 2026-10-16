"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { kompresFotoUtama, kompresThumbnail } from "@/lib/kompresi";

interface TimMekanik {
  id: string;
  nama: string;
  woAktif: number;
}

export function FormWorkOrderBaru({
  daftarTim,
}: {
  daftarTim: TimMekanik[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Step plat & kendaraan
  const [plat, setPlat] = useState("");
  const [isMencariPlat, setIsMencariPlat] = useState(false);
  const [kendaraanDitemukan, setKendaraanDitemukan] = useState<{
    id: string;
    plat: string;
    merek_model: string;
    tahun: number | null;
    customer_id: string;
    customer_nama: string;
    customer_telepon: string;
  } | null>(null);
  const [platBelumTerdaftar, setPlatBelumTerdaftar] = useState(false);

  // Form kendaraan baru jika plat belum ada
  const [merekModel, setMerekModel] = useState("");
  const [tahun, setTahun] = useState<number | "">("");
  const [warna, setWarna] = useState("");
  const [transmisi, setTransmisi] = useState<"AT" | "MT">("AT");

  // Form pelanggan jika plat belum ada
  const [modePelanggan, setModePelanggan] = useState<"cari" | "baru">("baru");
  const [teleponCari, setTeleponCari] = useState("");
  const [pelangganTerpilih, setPelangganTerpilih] = useState<{
    id: string;
    nama: string;
    telepon: string;
  } | null>(null);
  const [namaPelangganBaru, setNamaPelangganBaru] = useState("");
  const [teleponBaru, setTeleponBaru] = useState("");
  const [tipePelanggan, setTipePelanggan] = useState<"perorangan" | "perusahaan">("perorangan");

  // Form Data Masuk WO
  const [odometer, setOdometer] = useState<number | "">("");
  const [keluhan, setKeluhan] = useState("");
  const [kepalaMekanikId, setKepalaMekanikId] = useState(daftarTim[0]?.id || "");

  // Foto (File asli & preview)
  const [fotoStnk, setFotoStnk] = useState<File | null>(null);
  const [previewStnk, setPreviewStnk] = useState<string | null>(null);
  const [fotoKondisiAwal, setFotoKondisiAwal] = useState<File[]>([]);
  const [previewKondisiAwal, setPreviewKondisiAwal] = useState<string[]>([]);

  const [pesanError, setPesanError] = useState<string | null>(null);
  const [prosesUpload, setProsesUpload] = useState<string | null>(null);

  // Debounced search plat nomor
  useEffect(() => {
    const rawPlat = plat.trim().toUpperCase();
    if (rawPlat.length < 3) {
      setKendaraanDitemukan(null);
      setPlatBelumTerdaftar(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsMencariPlat(true);
      const { data } = await supabase
        .from("vehicles")
        .select(`
          id,
          plat,
          merek_model,
          tahun,
          customer_id,
          customers (id, nama, telepon)
        `)
        .ilike("plat", rawPlat)
        .maybeSingle();

      setIsMencariPlat(false);
      if (data && data.customers) {
        setKendaraanDitemukan({
          id: data.id,
          plat: data.plat,
          merek_model: data.merek_model,
          tahun: data.tahun,
          customer_id: data.customer_id,
          customer_nama: data.customers.nama,
          customer_telepon: data.customers.telepon,
        });
        setPlatBelumTerdaftar(false);
      } else {
        setKendaraanDitemukan(null);
        setPlatBelumTerdaftar(true);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [plat, supabase]);

  // Handler cari pelanggan by telepon
  const handleCariPelanggan = async () => {
    if (!teleponCari.trim()) return;
    const { data } = await supabase
      .from("customers")
      .select("id, nama, telepon")
      .eq("telepon", teleponCari.trim())
      .maybeSingle();

    if (data) {
      setPelangganTerpilih(data);
    } else {
      setPesanError("Pelanggan dengan nomor telepon ini tidak ditemukan");
    }
  };

  // Handler file STNK
  const handlePilihStnk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoStnk(file);
      setPreviewStnk(URL.createObjectURL(file));
    }
  };

  // Handler file Kondisi Awal (1 - 6 foto)
  const handlePilihKondisiAwal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const gabung = [...fotoKondisiAwal, ...files].slice(0, 6);
    setFotoKondisiAwal(gabung);
    setPreviewKondisiAwal(gabung.map((f) => URL.createObjectURL(f)));
  };

  const handleHapusFotoKondisi = (idx: number) => {
    const barufiles = fotoKondisiAwal.filter((_, i) => i !== idx);
    setFotoKondisiAwal(barufiles);
    setPreviewKondisiAwal(barufiles.map((f) => URL.createObjectURL(f)));
  };

  // Validasi tombol simpan (PRD 6.7)
  const isLengkap = Boolean(
    (kendaraanDitemukan ||
      (merekModel.trim() &&
        (pelangganTerpilih ||
          (namaPelangganBaru.trim() && teleponBaru.trim())))) &&
      odometer !== "" &&
      Number(odometer) >= 0 &&
      keluhan.trim() &&
      kepalaMekanikId &&
      fotoStnk &&
      fotoKondisiAwal.length >= 1,
  );

  // Submit Simpan WO
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesanError(null);

    if (!isLengkap) {
      setPesanError("Harap lengkapi seluruh field berbintang (*), foto STNK, dan minimal 1 foto kondisi awal.");
      return;
    }

    startTransition(async () => {
      try {
        let vehicleId = kendaraanDitemukan?.id;

        // Jika plat belum terdaftar, buat pelanggan & kendaraan terlebih dahulu
        if (!vehicleId) {
          let customerId = pelangganTerpilih?.id;

          if (!customerId) {
            setProsesUpload("Menyimpan data pelanggan...");
            const { data: custBaru, error: errCust } = await supabase
              .from("customers")
              .insert({
                nama: namaPelangganBaru.trim(),
                telepon: teleponBaru.trim(),
                tipe: tipePelanggan,
              })
              .select("id")
              .single();

            if (errCust) throw new Error(`Gagal membuat pelanggan: ${errCust.message}`);
            customerId = custBaru.id;
          }

          setProsesUpload("Menyimpan data kendaraan...");
          const { data: vehBaru, error: errVeh } = await supabase
            .from("vehicles")
            .insert({
              customer_id: customerId,
              plat: plat.trim().toUpperCase(),
              merek_model: merekModel.trim(),
              tahun: tahun ? Number(tahun) : null,
              warna: warna.trim() || null,
              transmisi,
            })
            .select("id")
            .single();

          if (errVeh) throw new Error(`Gagal membuat kendaraan: ${errVeh.message}`);
          vehicleId = vehBaru.id;
        }

        // Panggil fungsi bisnis buat_work_order
        setProsesUpload("Membuat nomor Work Order...");
        const { data: woId, error: errWo } = await supabase.rpc("buat_work_order", {
          p_vehicle_id: vehicleId,
          p_kepala_mekanik_id: kepalaMekanikId,
          p_odometer: Number(odometer),
          p_keluhan: keluhan.trim(),
        });

        if (errWo) throw new Error(errWo.message);

        // Upload Foto STNK (kompresi utama & thumbnail)
        if (fotoStnk && woId) {
          setProsesUpload("Mengompresi dan mengunggah foto STNK...");
          const fileUtama = await kompresFotoUtama(fotoStnk);
          const fileThumb = await kompresThumbnail(fotoStnk);
          const extId = crypto.randomUUID();

          const pathUtama = `${woId}/stnk/${extId}.webp`;
          const pathThumb = `${woId}/stnk/thumb/${extId}.webp`;

          await supabase.storage.from("foto-wo").upload(pathUtama, fileUtama, { contentType: "image/webp" });
          await supabase.storage.from("foto-wo").upload(pathThumb, fileThumb, { contentType: "image/webp" });

          await supabase.from("work_order_photos").insert({
            work_order_id: woId,
            jenis: "stnk",
            path: pathUtama,
          });
        }

        // Upload Foto Kondisi Awal
        if (fotoKondisiAwal.length > 0 && woId) {
          setProsesUpload("Mengunggah foto kondisi awal...");
          for (let i = 0; i < fotoKondisiAwal.length; i++) {
            const f = fotoKondisiAwal[i];
            const fileUtama = await kompresFotoUtama(f);
            const fileThumb = await kompresThumbnail(f);
            const extId = crypto.randomUUID();

            const pathUtama = `${woId}/kondisi_awal/${extId}.webp`;
            const pathThumb = `${woId}/kondisi_awal/thumb/${extId}.webp`;

            await supabase.storage.from("foto-wo").upload(pathUtama, fileUtama, { contentType: "image/webp" });
            await supabase.storage.from("foto-wo").upload(pathThumb, fileThumb, { contentType: "image/webp" });

            await supabase.from("work_order_photos").insert({
              work_order_id: woId,
              jenis: "kondisi_awal",
              path: pathUtama,
            });
          }
        }

        // Sukses, alihkan ke rincian WO
        router.push(`/work-orders/${woId}`);
      } catch (err: unknown) {
        setProsesUpload(null);
        setPesanError((err as Error).message || "Terjadi kesalahan saat menyimpan Work Order");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Kartu Pencarian Plat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="size-5 text-primary" />
            1. Identifikasi Kendaraan & Pelanggan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="plat" className="font-semibold">
              Plat Nomor <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1 max-w-sm">
              <Input
                id="plat"
                value={plat}
                onChange={(e) => setPlat(e.target.value.toUpperCase())}
                placeholder="Contoh: B 1234 ABC"
                className="font-mono text-base tracking-wider uppercase"
                disabled={Boolean(kendaraanDitemukan)}
                autoFocus
              />
              {isMencariPlat && (
                <Loader2 className="absolute right-3 top-2.5 size-5 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Kondisi 1: Plat Ditemukan */}
          {kendaraanDitemukan && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-success">
                    <CheckCircle2 className="size-4" />
                    Kendaraan Terdaftar
                  </div>
                  <p className="mt-1 font-mono font-bold text-text">
                    {kendaraanDitemukan.plat} · {kendaraanDitemukan.merek_model}{" "}
                    {kendaraanDitemukan.tahun ? `(${kendaraanDitemukan.tahun})` : ""}
                  </p>
                  <p className="mt-0.5 text-text-muted">
                    Pemilik:{" "}
                    <span className="font-medium text-text">
                      {kendaraanDitemukan.customer_nama}
                    </span>{" "}
                    ({kendaraanDitemukan.customer_telepon})
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setKendaraanDitemukan(null);
                    setPlat("");
                  }}
                >
                  Ubah Plat
                </Button>
              </div>
            </div>
          )}

          {/* Kondisi 2: Plat Belum Terdaftar */}
          {platBelumTerdaftar && (
            <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
              <div className="flex items-center gap-1.5 font-medium text-warning">
                <AlertCircle className="size-4" />
                Plat belum terdaftar. Isi data kendaraan dan pemilik:
              </div>

              {/* Data Kendaraan */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="merek">Merek & Model *</Label>
                  <Input
                    id="merek"
                    value={merekModel}
                    onChange={(e) => setMerekModel(e.target.value)}
                    placeholder="Contoh: Toyota Avanza 1.3 G"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tahun">Tahun</Label>
                  <Input
                    id="tahun"
                    type="number"
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value ? Number(e.target.value) : "")}
                    placeholder="2020"
                  />
                </div>
                <div>
                  <Label htmlFor="transmisi">Transmisi</Label>
                  <select
                    id="transmisi"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={transmisi}
                    onChange={(e) => setTransmisi(e.target.value as "AT" | "MT")}
                  >
                    <option value="AT">Automatic (AT)</option>
                    <option value="MT">Manual (MT)</option>
                  </select>
                </div>
              </div>

              {/* Data Pelanggan */}
              <div className="border-t border-border/60 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-text">Data Pemilik Mobil</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={modePelanggan === "baru" ? "default" : "outline"}
                      onClick={() => {
                        setModePelanggan("baru");
                        setPelangganTerpilih(null);
                      }}
                    >
                      Pelanggan Baru
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={modePelanggan === "cari" ? "default" : "outline"}
                      onClick={() => setModePelanggan("cari")}
                    >
                      Cari Nomor Lama
                    </Button>
                  </div>
                </div>

                {modePelanggan === "cari" ? (
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Ketik nomor telepon pelanggan"
                      value={teleponCari}
                      onChange={(e) => setTeleponCari(e.target.value)}
                    />
                    <Button type="button" onClick={handleCariPelanggan} variant="outline">
                      Cari
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="namaCust">Nama Pelanggan *</Label>
                      <Input
                        id="namaCust"
                        value={namaPelangganBaru}
                        onChange={(e) => setNamaPelangganBaru(e.target.value)}
                        placeholder="Nama lengkap pemilik"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="telpCust">No. Telepon / WhatsApp *</Label>
                      <Input
                        id="telpCust"
                        value={teleponBaru}
                        onChange={(e) => setTeleponBaru(e.target.value)}
                        placeholder="08123456789"
                        required
                      />
                    </div>
                  </div>
                )}

                {pelangganTerpilih && (
                  <p className="mt-2 text-sm text-success">
                    ✓ Terpilih: <b>{pelangganTerpilih.nama}</b> ({pelangganTerpilih.telepon})
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kartu Data Masuk WO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Data Masuk Work Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="odometer">
                Kilometer / Odometer <span className="text-destructive">*</span>
              </Label>
              <Input
                id="odometer"
                type="number"
                min={0}
                value={odometer}
                onChange={(e) => setOdometer(e.target.value ? Number(e.target.value) : "")}
                placeholder="Contoh: 45000"
                required
              />
            </div>

            <div>
              <Label htmlFor="tim">
                Pilih Tim Kepala Mekanik <span className="text-destructive">*</span>
              </Label>
              <select
                id="tim"
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={kepalaMekanikId}
                onChange={(e) => setKepalaMekanikId(e.target.value)}
                required
              >
                {daftarTim.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nama} ({t.woAktif} WO Aktif)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="keluhan">
              Keluhan Pelanggan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="keluhan"
              rows={3}
              value={keluhan}
              onChange={(e) => setKeluhan(e.target.value)}
              placeholder="Deskripsikan keluhan atau permintaan servis mobil..."
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Kartu Foto Dokumentasi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. Foto Dokumentasi Awal (Privat)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Foto STNK */}
          <div>
            <Label className="font-semibold">
              Foto STNK <span className="text-destructive">*</span> (1 foto)
            </Label>
            <p className="text-xs text-text-muted">
              Foto STNK disimpan privat untuk verifikasi legalitas kendaraan.
            </p>
            <div className="mt-2 flex items-center gap-4">
              <label className="flex h-28 w-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 hover:bg-muted">
                <Upload className="size-6 text-muted-foreground" />
                <span className="mt-1 text-xs text-muted-foreground">Pilih Foto STNK</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePilihStnk}
                />
              </label>
              {previewStnk && (
                <div className="relative size-28 overflow-hidden rounded-lg border border-border">
                  <img src={previewStnk} alt="STNK" className="size-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* Upload Foto Kondisi Awal */}
          <div>
            <Label className="font-semibold">
              Foto Kondisi Awal <span className="text-destructive">*</span> (1 - 6 foto)
            </Label>
            <p className="text-xs text-text-muted">
              Foto goresan, bodi depan/belakang/samping sebelum mobil dikerjakan.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {fotoKondisiAwal.length < 6 && (
                <label className="flex h-28 w-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 hover:bg-muted">
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="mt-1 text-xs text-muted-foreground">+ Foto Mobil</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePilihKondisiAwal}
                  />
                </label>
              )}
              {previewKondisiAwal.map((src, idx) => (
                <div
                  key={idx}
                  className="relative size-28 overflow-hidden rounded-lg border border-border"
                >
                  <img src={src} alt={`Kondisi ${idx + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Hapus foto kondisi ${idx + 1}`}
                    onClick={() => handleHapusFotoKondisi(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error / Loading State */}
      {pesanError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {pesanError}
        </div>
      )}

      {prosesUpload && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Loader2 className="size-4 animate-spin" />
          <span>{prosesUpload}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/work-orders">Batal</Link>
        </Button>
        <Button type="submit" disabled={!isLengkap || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            "Simpan Work Order"
          )}
        </Button>
      </div>
    </form>
  );
}
