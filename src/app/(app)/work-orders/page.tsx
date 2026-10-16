import Link from "next/link";
import { Plus, Search, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paginasi } from "@/components/Paginasi";
import { BadgeStatusWO, DAFTAR_STATUS_WO, LABEL_STATUS_WO } from "@/components/BadgeStatusWO";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FilterTim } from "./FilterTim";

const PER_HALAMAN = 20;

export default async function HalamanWorkOrders({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    tim?: string;
    hal?: string;
  }>;
}) {
  const params = await searchParams;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  const q = params.q?.replace(/[,()*%\\]/g, " ").trim() || "";
  const hal = Math.max(1, Number(params.hal) || 1);
  const statusAktif = params.status || "semua";

  // Filter default untuk Kepala Mekanik adalah timnya sendiri jika tim belum diset
  let timFilter = params.tim;
  if (!timFilter && profil.peran === "kepala_mekanik") {
    timFilter = profil.id;
  }

  // Ambil daftar kepala mekanik untuk filter tab/dropdown
  const { data: daftarTim } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // Hitung jumlah WO per status untuk tab
  const { data: woUntukHitung } = await supabase
    .from("work_orders")
    .select("status, kepala_mekanik_id");

  const filterTimWO = (item: { kepala_mekanik_id: string }) => {
    if (!timFilter || timFilter === "semua") return true;
    return item.kepala_mekanik_id === timFilter;
  };

  const countStatus: Record<string, number> = {
    semua: (woUntukHitung ?? []).filter(filterTimWO).length,
  };
  DAFTAR_STATUS_WO.forEach((st) => {
    countStatus[st] = (woUntukHitung ?? []).filter(
      (w) => w.status === st && filterTimWO(w),
    ).length;
  });

  // Query daftar Work Order (Hanya kolom yang ditampilkan - hemat egress)
  let kueri = supabase
    .from("work_orders")
    .select(
      `
      id,
      nomor,
      status,
      estimasi_selesai,
      created_at,
      kepala_mekanik_id,
      vehicles!inner (plat),
      customers!inner (nama),
      profiles!kepala_mekanik_id (nama),
      billing_items (jumlah, harga_dipakai),
      invoices (total)
    `,
      { count: "exact" },
    );

  if (statusAktif && statusAktif !== "semua") {
    kueri = kueri.eq("status", statusAktif);
  }

  if (timFilter && timFilter !== "semua") {
    kueri = kueri.eq("kepala_mekanik_id", timFilter);
  }

  if (q) {
    kueri = kueri.or(
      `nomor.ilike.%${q}%,vehicles.plat.ilike.%${q}%,customers.nama.ilike.%${q}%`,
    );
  }

  const { data: workOrders, count } = await kueri
    .order("created_at", { ascending: false })
    .range((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN - 1);

  const hariIni = new Date().toISOString().split("T")[0];
  const bolehBuat = profil.peran === "admin" || profil.peran === "owner";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Work Order</h1>
          <p className="text-sm text-text-muted">
            Kelola seluruh pengerjaan unit mobil dari penerimaan hingga penyerahan
          </p>
        </div>
        {bolehBuat && (
          <Button asChild>
            <Link href="/work-orders/baru">
              <Plus className="mr-1 size-4" />
              Work Order Baru
            </Link>
          </Button>
        )}
      </div>

      {/* Filter Tim & Pencarian */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Tab Status */}
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
          <Link
            href={`/work-orders?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(timFilter ? { tim: timFilter } : {}),
              status: "semua",
            })}`}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              statusAktif === "semua"
                ? "bg-card text-primary shadow-card"
                : "text-muted-foreground hover:text-text"
            }`}
          >
            Semua ({countStatus.semua || 0})
          </Link>
          {DAFTAR_STATUS_WO.map((st) => (
            <Link
              key={st}
              href={`/work-orders?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(timFilter ? { tim: timFilter } : {}),
                status: st,
              })}`}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                statusAktif === st
                  ? "bg-card text-primary shadow-card"
                  : "text-muted-foreground hover:text-text"
              }`}
            >
              {LABEL_STATUS_WO[st]} ({countStatus[st] || 0})
            </Link>
          ))}
        </div>

        {/* Filter Tim & Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {daftarTim && daftarTim.length > 0 && (
            <FilterTim daftarTim={daftarTim} timAktif={timFilter || "semua"} />
          )}

          <form className="flex gap-2" role="search">
            {statusAktif && <input type="hidden" name="status" value={statusAktif} />}
            {timFilter && <input type="hidden" name="tim" value={timFilter} />}
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari No WO, Plat, Pelanggan"
              className="w-56"
              aria-label="Cari work order"
            />
            <Button type="submit" variant="outline" size="sm">
              <Search className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Tabel Work Orders */}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No WO</TableHead>
              <TableHead>Plat</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Tim</TableHead>
              <TableHead>Estimasi Selesai</TableHead>
              <TableHead className="text-right">Total Tagihan</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!workOrders || workOrders.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Belum ada Work Order pada kriteria ini
                </TableCell>
              </TableRow>
            )}
            {workOrders?.map((wo) => {
              const plat = (wo.vehicles as unknown as { plat: string })?.plat || "-";
              const pelanggan = (wo.customers as unknown as { nama: string })?.nama || "-";
              const tim = (wo.profiles as unknown as { nama: string })?.nama || "-";

              // Cek terlambat (PRD 6.6): estimasi lewat tapi belum selesai/siap/diambil/dibatalkan
              const isSelesai = [
                "selesai",
                "siap_diambil",
                "diambil",
                "dibatalkan",
              ].includes(wo.status);
              const isTerlambat =
                !isSelesai && wo.estimasi_selesai && wo.estimasi_selesai < hariIni;

              // Hitung total dari invoice (jika ada) atau dari kalkulasi billing_items
              const invTotal = (wo.invoices as unknown as { total: number }[])?.[0]?.total;
              const billTotal = (
                wo.billing_items as unknown as {
                  jumlah: number;
                  harga_dipakai: number;
                }[]
              )?.reduce((acc, curr) => acc + curr.jumlah * curr.harga_dipakai, 0);

              const total = invTotal ?? (billTotal || 0);

              return (
                <TableRow key={wo.id} className="hover:bg-muted/50">
                  <TableCell className="font-semibold text-primary">
                    <Link href={`/work-orders/${wo.id}`} className="hover:underline">
                      {wo.nomor}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{plat}</TableCell>
                  <TableCell>{pelanggan}</TableCell>
                  <TableCell className="text-text-muted">{tim}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{wo.estimasi_selesai ? tanggal(wo.estimasi_selesai) : "-"}</span>
                      {isTerlambat && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                          <AlertCircle className="mr-0.5 size-2.5" />
                          Terlambat
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {total > 0 ? rupiah(total) : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <BadgeStatusWO status={wo.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Paginasi 20 baris */}
      <Paginasi
        halaman={hal}
        totalBaris={count || 0}
        perHalaman={PER_HALAMAN}
        params={{
          ...(q ? { q } : {}),
          ...(statusAktif ? { status: statusAktif } : {}),
          ...(timFilter ? { tim: timFilter } : {}),
        }}
      />
    </div>
  );
}
