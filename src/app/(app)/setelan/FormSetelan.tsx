"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const skemaBengkel = z.object({
  nama: z.string().trim().min(1, "Nama bengkel wajib diisi"),
  alamat: z.string().trim().min(1, "Alamat wajib diisi"),
  telepon: z.string().trim().min(1, "Nomor telepon wajib diisi"),
  jam_buka: z.string().trim().optional(),
});

type DataBengkel = z.infer<typeof skemaBengkel>;

export interface WorkshopSettingsData {
  id: number;
  nama: string;
  alamat: string;
  telepon: string;
  jam_buka: string | null;
  logo_path: string | null;
  galeri_paths: string[];
}

export function FormSetelan({ settings }: { settings: WorkshopSettingsData }) {
  const router = useRouter();
  const supabase = createClient();

  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingLogo, setLoadingLogo] = useState(false);
  const [loadingGaleri, setLoadingGaleri] = useState(false);

  const [logoPath, setLogoPath] = useState<string | null>(settings.logo_path);
  const [galeriPaths, setGaleriPaths] = useState<string[]>(settings.galeri_paths ?? []);

  const form = useForm<DataBengkel>({
    resolver: zodResolver(skemaBengkel),
    defaultValues: {
      nama: settings.nama,
      alamat: settings.alamat,
      telepon: settings.telepon,
      jam_buka: settings.jam_buka ?? "",
    },
  });

  // URL helper untuk bucket publik
  function getUrl(path: string | null) {
    if (!path) return "";
    return supabase.storage.from("publik").getPublicUrl(path).data.publicUrl;
  }

  // 1. Simpan Data Umum Bengkel
  async function simpanInfo(data: DataBengkel) {
    setLoadingInfo(true);
    try {
      const { error } = await supabase
        .from("workshop_settings")
        .update({
          nama: data.nama,
          alamat: data.alamat,
          telepon: data.telepon,
          jam_buka: data.jam_buka || null,
        })
        .eq("id", 1);

      if (error) {
        toast.error("Gagal menyimpan data bengkel: " + error.message);
        setLoadingInfo(false);
        return;
      }

      toast.success("Informasi bengkel berhasil diperbarui");
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat menyimpan data");
    } finally {
      setLoadingInfo(false);
    }
  }

  // 2. Unggah Logo Baru (PRD 11.4: WebP, max 1MB)
  async function unggahLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingLogo(true);
    try {
      // Kompresi gambar via browser-image-compression
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.8,
      };
      const compressed = await imageCompression(file, options);

      const namaBerkas = `logo/logo-${Date.now()}.webp`;

      const { error: errUpload } = await supabase.storage
        .from("publik")
        .upload(namaBerkas, compressed, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });

      if (errUpload) {
        toast.error("Gagal mengunggah logo: " + errUpload.message);
        setLoadingLogo(false);
        return;
      }

      // Catatan: jangan menyertakan updated_at karena dikelola otomatis oleh trigger set_updated_at
      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({
          logo_path: namaBerkas,
        })
        .eq("id", 1);

      if (errDb) {
        toast.error("Gagal memperbarui path logo: " + errDb.message);
        setLoadingLogo(false);
        return;
      }

      setLogoPath(namaBerkas);
      toast.success("Logo bengkel berhasil diperbarui");
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat mengunggah logo");
    } finally {
      setLoadingLogo(false);
      e.target.value = "";
    }
  }

  // Hapus Logo
  async function hapusLogo() {
    if (!logoPath) return;
    setLoadingLogo(true);
    try {
      await supabase.storage.from("publik").remove([logoPath]);
      const { error } = await supabase
        .from("workshop_settings")
        .update({
          logo_path: null,
        })
        .eq("id", 1);

      if (error) {
        toast.error("Gagal menghapus logo: " + error.message);
        setLoadingLogo(false);
        return;
      }

      setLogoPath(null);
      toast.success("Logo berhasil dihapus");
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat menghapus logo");
    } finally {
      setLoadingLogo(false);
    }
  }

  // 3. Galeri: Tambah Foto (Maksimal 6 foto, PRD 6.11)
  async function tambahFotoGaleri(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (galeriPaths.length >= 6) {
      toast.error("Galeri maksimal berisi 6 foto.");
      return;
    }

    setLoadingGaleri(true);
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.8,
      };
      const compressed = await imageCompression(file, options);

      const pathBaru = `galeri/foto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.webp`;

      const { error: errUpload } = await supabase.storage
        .from("publik")
        .upload(pathBaru, compressed, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });

      if (errUpload) {
        toast.error("Gagal mengunggah foto galeri: " + errUpload.message);
        setLoadingGaleri(false);
        return;
      }

      const pathsUpdate = [...galeriPaths, pathBaru];

      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({
          galeri_paths: pathsUpdate,
        })
        .eq("id", 1);

      if (errDb) {
        toast.error("Gagal menyimpan galeri: " + errDb.message);
        setLoadingGaleri(false);
        return;
      }

      setGaleriPaths(pathsUpdate);
      toast.success("Foto galeri berhasil ditambahkan");
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat mengunggah foto");
    } finally {
      setLoadingGaleri(false);
      e.target.value = "";
    }
  }

  // Galeri: Hapus Foto
  async function hapusFotoGaleri(index: number) {
    setLoadingGaleri(true);
    try {
      const pathTarget = galeriPaths[index];
      const pathsUpdate = galeriPaths.filter((_, i) => i !== index);

      await supabase.storage.from("publik").remove([pathTarget]);

      const { error } = await supabase
        .from("workshop_settings")
        .update({
          galeri_paths: pathsUpdate,
        })
        .eq("id", 1);

      if (error) {
        toast.error("Gagal memperbarui galeri: " + error.message);
        setLoadingGaleri(false);
        return;
      }

      setGaleriPaths(pathsUpdate);
      toast.success("Foto galeri berhasil dihapus");
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat menghapus foto");
    } finally {
      setLoadingGaleri(false);
    }
  }

  // Galeri: Urutkan (Tukar posisi)
  async function geserFoto(index: number, arah: "kiri" | "kanan") {
    const targetIndex = arah === "kiri" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= galeriPaths.length) return;

    setLoadingGaleri(true);
    try {
      const copy = [...galeriPaths];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;

      const { error } = await supabase
        .from("workshop_settings")
        .update({
          galeri_paths: copy,
        })
        .eq("id", 1);

      if (error) {
        toast.error("Gagal mengubah urutan: " + error.message);
        setLoadingGaleri(false);
        return;
      }

      setGaleriPaths(copy);
      toast.success("Urutan foto diperbarui");
      router.refresh();
    } catch (e: unknown) {
      toast.error("Gagal mengubah urutan foto");
    } finally {
      setLoadingGaleri(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Kolom Kiri: Informasi Bengkel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="size-5 text-primary" />
            Informasi Bengkel
          </CardTitle>
          <CardDescription>
            Data bengkel yang ditampilkan pada header, kop invoice, dan informasi kontak.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(simpanInfo)} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nama">Nama Bengkel *</FieldLabel>
                <Input id="nama" {...form.register("nama")} />
                <FieldError errors={[form.formState.errors.nama]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="alamat">Alamat Lengkap *</FieldLabel>
                <Textarea id="alamat" rows={3} {...form.register("alamat")} />
                <FieldError errors={[form.formState.errors.alamat]} />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="telepon">Nomor Telepon *</FieldLabel>
                  <Input id="telepon" {...form.register("telepon")} />
                  <FieldError errors={[form.formState.errors.telepon]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="jam_buka">Jam Operasional</FieldLabel>
                  <Input
                    id="jam_buka"
                    placeholder="Contoh: Sen - Sab, 08.00 - 17.00"
                    {...form.register("jam_buka")}
                  />
                  <FieldError errors={[form.formState.errors.jam_buka]} />
                </Field>
              </div>
            </FieldGroup>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loadingInfo}>
                {loadingInfo && <Loader2 className="size-4 animate-spin" />}
                Simpan Informasi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Kolom Kanan: Logo Bengkel & Galeri */}
      <div className="space-y-6">
        {/* Card Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Logo Bengkel</CardTitle>
            <CardDescription>
              Logo disimpan di bucket publik (<code>publik/logo/</code>). Format WebP/PNG/JPG (maksimal 1 MB).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                {logoPath ? (
                  <Image
                    src={getUrl(logoPath)}
                    alt="Logo Bengkel"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                ) : (
                  <Building className="size-10 text-muted-foreground/60" />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
                    <Upload className="size-3.5" />
                    {loadingLogo ? "Mengunggah..." : "Pilih Logo Baru"}
                  </span>
                  <input
                    type="file"
                    accept="image/webp,image/jpeg,image/png"
                    onChange={unggahLogo}
                    disabled={loadingLogo}
                    className="hidden"
                  />
                </label>

                {logoPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={hapusLogo}
                    disabled={loadingLogo}
                  >
                    <Trash2 className="size-3.5" />
                    Hapus Logo
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Galeri */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Galeri Halaman Depan</CardTitle>
                <CardDescription>
                  3 hingga 6 foto untuk halaman publik (<code>publik/galeri/</code>).
                </CardDescription>
              </div>
              <label
                className={`inline-flex cursor-pointer ${
                  galeriPaths.length >= 6 || loadingGaleri
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90">
                  <ImagePlus className="size-3.5" />
                  Tambah Foto
                </span>
                <input
                  type="file"
                  accept="image/webp,image/jpeg,image/png"
                  onChange={tambahFotoGaleri}
                  disabled={galeriPaths.length >= 6 || loadingGaleri}
                  className="hidden"
                />
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {galeriPaths.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada foto di galeri. Tambahkan 3 hingga 6 foto untuk halaman depan.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {galeriPaths.map((p, index) => (
                  <div
                    key={p}
                    className="group relative aspect-4/3 overflow-hidden rounded-md border bg-muted/30"
                  >
                    <Image
                      src={getUrl(p)}
                      alt={`Foto Galeri ${index + 1}`}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized
                    />

                    {/* Kontrol Overlay */}
                    <div className="absolute inset-0 flex items-center justify-between bg-black/50 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-xs"
                          disabled={index === 0 || loadingGaleri}
                          onClick={() => geserFoto(index, "kiri")}
                          title="Geser ke kiri"
                        >
                          <ArrowLeft className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-xs"
                          disabled={index === galeriPaths.length - 1 || loadingGaleri}
                          onClick={() => geserFoto(index, "kanan")}
                          title="Geser ke kanan"
                        >
                          <ArrowRight className="size-3" />
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        disabled={loadingGaleri}
                        onClick={() => hapusFotoGaleri(index)}
                        title="Hapus foto"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-right text-xs text-muted-foreground">
              {galeriPaths.length} dari maksimal 6 foto
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
