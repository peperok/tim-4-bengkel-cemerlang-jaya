import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  User,
  Car,
  AlertCircle,
  Phone,
  Calendar,
  Gauge,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeStatusWO } from "@/components/BadgeStatusWO";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

import { TombolAksiStatus } from "./TombolAksiStatus";
import { BagianPenugasan } from "./BagianPenugasan";
import { BagianPengerjaan } from "./BagianPengerjaan";
import { GaleriFotoWO } from "./GaleriFotoWO";

export default async function RincianWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // Ambil data utama Work Order
  const { data: wo } = await supabase
    .from("work_orders")
    .select(`
      id,
      nomor,
      odometer,
      keluhan,
      diagnosis,
      status,
      estimasi_selesai,
      catatan_status,
      created_at,
      selesai_at,
      diambil_at,
      kepala_mekanik_id,
      profiles!kepala_mekanik_id (id, nama),
      vehicles (id, plat, merek_model, tahun, warna, transmisi),
      customers (id, nama, telepon, alamat)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!wo) notFound();

  // Ambil mekanik yang ditugaskan ke WO ini
  const { data: listMekanikWO } = await supabase
    .from("work_order_mekanik")
    .select("mekanik_id, mekanik (id, nama)")
    .eq("work_order_id", id);

  const mekanikTerpilih = (listMekanikWO ?? []).map((m) => m.mekanik_id);

  // Ambil seluruh mekanik dari tim kepala mekanik WO ini
  const { data: seluruhMekanikTim } = await supabase
    .from("mekanik")
    .select("id, nama, aktif")
    .eq("kepala_mekanik_id", wo.kepala_mekanik_id)
    .eq("aktif", true)
    .order("nama");

  // Ambil hitungan beban WO aktif per mekanik
  const { data: mekanikAktifWO } = await supabase
    .from("work_order_mekanik")
    .select(`
      mekanik_id,
      work_orders!inner (status)
    `)
    .in("work_orders.status", ["menunggu", "dikerjakan", "tertunda"]);

  const daftarMekanikTim = (seluruhMekanikTim ?? []).map((m) => {
    const beban = (mekanikAktifWO ?? []).filter((w) => w.mekanik_id === m.id).length;
    return {
      id: m.id,
      nama: m.nama,
      aktif: m.aktif,
      woAktif: beban,
    };
  });
  // Urutkan dari beban paling ringan (PRD 6.8 Bagian B)
  daftarMekanikTim.sort((a, b) => a.woAktif - b.woAktif);

  // Ambil billing items terpasang
  const { data: billingItems } = await supabase
    .from("billing_items")
    .select("id, item_id, nama_item, jenis, jumlah, harga_dipakai")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  // Ambil master inventory (part & jasa)
  const { data: masterInventory } = await supabase
    .from("inventory_items")
    .select("id, kode, nama, jenis, harga_jual, stok")
    .eq("aktif", true)
    .order("nama");

  // Cek invoice untuk syarat status penyerahan mobil
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status_bayar")
    .eq("work_order_id", id)
    .maybeSingle();

  // Ambil foto WO dari database
  const { data: photos } = await supabase
    .from("work_order_photos")
    .select("id, jenis, path")
    .eq("work_order_id", id);

  // Generate signed URLs untuk foto (PRD 11.3: createSignedUrls berlaku 10 menit)
  const pathsToSign = (photos ?? []).map((p) => p.path);
  const signedMap: Record<string, string> = {};
  if (pathsToSign.length > 0) {
    const { data: signedList } = await supabase.storage
      .from("foto-wo")
      .createSignedUrls(pathsToSign, 600);

    if (signedList) {
      signedList.forEach((s) => {
        if (s.signedUrl && s.path) {
          signedMap[s.path] = s.signedUrl;
        }
      });
    }
  }

  const daftarFoto = (photos ?? []).map((p) => {
    return {
      id: p.id,
      jenis: p.jenis as "stnk" | "kondisi_awal" | "pengerjaan" | "kondisi_akhir",
      url: signedMap[p.path] || "",
      path: p.path,
    };
  });

  // Ambil riwayat status WO (PRD 6.8 & 9.2)
  const { data: statusHistory } = await supabase
    .from("wo_status_history")
    .select(`
      id,
      dari_status,
      ke_status,
      catatan,
      created_at,
      profiles (nama)
    `)
    .eq("work_order_id", id)
    .order("created_at", { ascending: false });

  // Hak Akses
  const isOwner = profil.peran === "owner";
  const isAdmin = profil.peran === "admin";
  const isKepalaTimIni =
    profil.peran === "kepala_mekanik" && profil.id === wo.kepala_mekanik_id;
  const bolehKelolaPengerjaan = isOwner || isKepalaTimIni;

  const hariIni = new Date().toISOString().split("T")[0];
  const isTerlambat =
    !["selesai", "siap_diambil", "diambil", "dibatalkan"].includes(wo.status) &&
    wo.estimasi_selesai &&
    wo.estimasi_selesai < hariIni;

  const vehicle = wo.vehicles as unknown as {
    plat: string;
    merek_model: string;
    tahun: number | null;
    warna: string | null;
    transmisi: string | null;
  };
  const customer = wo.customers as unknown as {
    nama: string;
    telepon: string;
    alamat: string | null;
  };

  const jumlahFotoAkhir = daftarFoto.filter((f) => f.jenis === "kondisi_akhir").length;

  return (
    <div className="space-y-6">
      {/* Tab Work Order (Rincian | Tagihan) */}
      <TabWorkOrder id={id} />

      {/* Header Utama Rincian */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/work-orders"
            className="rounded-lg border border-border p-2 hover:bg-muted text-muted-foreground hover:text-text transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-text">
                {wo.nomor}
              </h1>
              <BadgeStatusWO status={wo.status} />
              {isTerlambat && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  <AlertCircle className="mr-1 size-3" />
                  Terlambat
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Dibuat pada {tanggal(wo.created_at)} · Ditangani oleh{" "}
              <span className="font-semibold text-text">
                {(wo.profiles as unknown as { nama: string })?.nama}
              </span>
            </p>
          </div>
        </div>

        {/* Tombol Aksi Status Sesuai Peran (PRD 7.2) */}
        <TombolAksiStatus
          woId={id}
          statusSekarang={wo.status}
          peran={profil.peran}
          userId={profil.id}
          kepalaMekanikId={wo.kepala_mekanik_id}
          estimasiSelesai={wo.estimasi_selesai}
          jumlahMekanik={mekanikTerpilih.length}
          jumlahBillingItems={(billingItems ?? []).length}
          invoiceLunas={invoice?.status_bayar === "lunas"}
          jumlahFotoAkhir={jumlahFotoAkhir}
        />
      </div>

      {/* Bagian A. Data Masuk (PRD 6.8) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Kartu Pelanggan & WhatsApp */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase text-text-muted">
              <User className="size-4 text-primary" />
              Pelanggan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-base font-bold text-text">{customer.nama}</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted">{customer.telepon}</span>
              <a
                href={`https://wa.me/${customer.telepon.replace(/^0/, "62")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded bg-[#25D366]/10 px-2 py-0.5 text-xs font-semibold text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
              >
                <Phone className="size-3" />
                WhatsApp
              </a>
            </div>
            {customer.alamat && (
              <p className="text-xs text-text-muted">{customer.alamat}</p>
            )}
          </CardContent>
        </Card>

        {/* Kartu Kendaraan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase text-text-muted">
              <Car className="size-4 text-primary" />
              Kendaraan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-mono text-base font-bold text-text">
              {vehicle.plat}
            </p>
            <p className="text-sm font-medium text-text">
              {vehicle.merek_model} {vehicle.tahun ? `(${vehicle.tahun})` : ""}
            </p>
            <p className="text-xs text-text-muted">
              Warna: {vehicle.warna || "-"} · Transmisi: {vehicle.transmisi || "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Odometer, Keluhan & Catatan Status */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <span className="text-xs font-semibold uppercase text-text-muted flex items-center gap-1">
                <Gauge className="size-3.5 text-primary" /> Odometer Masuk
              </span>
              <p className="mt-1 font-mono text-base font-bold text-text">
                {wo.odometer.toLocaleString("id-ID")} km
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-text-muted flex items-center gap-1">
                <Calendar className="size-3.5 text-primary" /> Estimasi Selesai
              </span>
              <p className="mt-1 text-sm font-semibold text-text">
                {wo.estimasi_selesai ? tanggal(wo.estimasi_selesai) : "-"}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-text-muted flex items-center gap-1">
                <Clock className="size-3.5 text-primary" /> Tim Penanganan
              </span>
              <p className="mt-1 text-sm font-semibold text-text">
                {(wo.profiles as unknown as { nama: string })?.nama}
              </p>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase text-text-muted">
              Keluhan Pelanggan
            </span>
            <p className="mt-1 rounded-md bg-muted/50 p-3 text-sm text-text">
              {wo.keluhan}
            </p>
          </div>

          {wo.catatan_status && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
              <span className="text-xs font-semibold uppercase text-warning flex items-center gap-1">
                <AlertCircle className="size-3.5" /> Catatan Status Terakhir
              </span>
              <p className="mt-1 text-sm text-text font-medium">{wo.catatan_status}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bagian B. Penugasan Mekanik */}
      <BagianPenugasan
        woId={id}
        status={wo.status}
        estimasiSelesai={wo.estimasi_selesai}
        mekanikTerpilih={mekanikTerpilih}
        daftarMekanikTim={daftarMekanikTim}
        bolehUbah={bolehKelolaPengerjaan}
      />

      {/* Bagian C. Pengerjaan (Diagnosis, Spare Part & Jasa) */}
      <BagianPengerjaan
        woId={id}
        status={wo.status}
        diagnosis={wo.diagnosis}
        billingItems={(billingItems ?? []).map((b) => ({
          id: b.id,
          item_id: b.item_id,
          nama_item: b.nama_item,
          jenis: b.jenis as "part" | "jasa",
          jumlah: b.jumlah,
          harga_dipakai: b.harga_dipakai,
        }))}
        daftarInventory={(masterInventory ?? []).map((i) => ({
          id: i.id,
          kode: i.kode,
          nama: i.nama,
          jenis: i.jenis as "part" | "jasa",
          harga_jual: i.harga_jual,
          stok: i.stok,
        }))}
        bolehPengerjaan={bolehKelolaPengerjaan}
      />

      {/* Dokumentasi Foto */}
      <GaleriFotoWO
        woId={id}
        status={wo.status}
        daftarFoto={daftarFoto}
        bolehUnggahAkhir={isAdmin || isOwner}
        bolehUnggahPengerjaan={bolehKelolaPengerjaan}
      />

      {/* Linimasa Riwayat Status WO (PRD 6.8 Bagian Bawah) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <History className="size-5 text-primary" />
            Linimasa Riwayat Work Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-4 before:absolute before:bottom-0 before:left-2 before:top-2 before:w-0.5 before:bg-border">
            {(statusHistory ?? []).map((h) => {
              const pelaku =
                (h.profiles as unknown as { nama: string })?.nama || "Sistem";
              return (
                <div key={h.id} className="relative">
                  <span className="absolute -left-6 top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-text">
                      {h.ke_status.replace("_", " ").toUpperCase()}
                    </span>
                    {h.dari_status && (
                      <span className="text-xs text-text-muted">
                        (dari {h.dari_status})
                      </span>
                    )}
                    <span className="text-xs text-text-muted">· {tanggal(h.created_at)}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Oleh: <span className="font-medium text-text">{pelaku}</span>
                  </p>
                  {h.catatan && (
                    <p className="mt-1 text-xs text-text bg-muted/50 p-2 rounded">
                      &quot;{h.catatan}&quot;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
