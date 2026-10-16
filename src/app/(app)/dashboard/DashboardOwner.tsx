"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  hitungRentang,
  hitungRentangSebelumnya,
  formatRupiah,
  type PeriodeDashboard,
} from "@/lib/dashboard";
import { KartuKPI } from "./KartuKPI";
import { GrafikAreaPendapatan } from "./GrafikAreaPendapatan";
import {
  GrafikBatangWOStatus,
  GrafikBatangBebanMekanik,
} from "./GrafikBatang";
import { GrafikDonatKomposisi } from "./GrafikDonat";

interface RingkasanOwner {
  pendapatan: number;
  laba_kotor: number;
  margin_persen: number;
  wo_aktif: number;
  wo_terlambat: number;
  piutang: number;
  pendapatan_jasa_total?: number;
  pendapatan_part_total?: number;
}

interface Props {
  periode: PeriodeDashboard;
}

export function DashboardOwner({ periode }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [ringkasan, setRingkasan] = useState<RingkasanOwner | null>(null);
  const [ringkasanBanding, setRingkasanBanding] =
    useState<RingkasanOwner | null>(null);
  const [pendapatanHarian, setPendapatanHarian] = useState<
    { tanggal: string; pendapatan_jasa: number; pendapatan_part: number }[]
  >([]);
  const [labaHarian, setLabaHarian] = useState<
    { tanggal: string; laba: number }[]
  >([]);
  const [woStatus, setWoStatus] = useState<
    { status: string; jumlah: number }[]
  >([]);
  const [bebanMekanik, setBebanMekanik] = useState<
    {
      mekanik: string;
      tim: string;
      wo_aktif: number;
      wo_selesai: number;
    }[]
  >([]);
  const [topItem, setTopItem] = useState<
    { nama: string; jumlah: number; pendapatan: number }[]
  >([]);
  const [stokMenipis, setStokMenipis] = useState<
    {
      id: string;
      nama: string;
      stok: number;
      stok_minimum: number;
    }[]
  >([]);

  const muat = useCallback(async () => {
    setLoading(true);
    const { dari, sampai } = hitungRentang(periode);
    const { dari: dariB, sampai: sampaiB } =
      hitungRentangSebelumnya(periode);

    const [
      { data: r },
      { data: rB },
      { data: ph },
      { data: lh },
      { data: ws },
      { data: bm },
      { data: ti },
    ] = await Promise.all([
      supabase.rpc("dashboard_ringkasan", { p_dari: dari, p_sampai: sampai }),
      supabase.rpc("dashboard_ringkasan", {
        p_dari: dariB,
        p_sampai: sampaiB,
      }),
      supabase.rpc("dashboard_pendapatan_harian", {
        p_dari: dari,
        p_sampai: sampai,
      }),
      supabase.rpc("dashboard_laba_harian", {
        p_dari: dari,
        p_sampai: sampai,
      }),
      supabase.rpc("dashboard_wo_per_status"),
      supabase.rpc("dashboard_beban_mekanik", {
        p_dari: dari,
        p_sampai: sampai,
      }),
      supabase.rpc("dashboard_top_item", {
        p_dari: dari,
        p_sampai: sampai,
      }),
    ]);

    // Stok menipis: ambil semua part aktif lalu filter di client (filter lte pada kolom berbeda tidak didukung postgrest)
    const { data: stokData } = await supabase
      .from("inventory_items")
      .select("id, nama, stok, stok_minimum")
      .eq("jenis", "part")
      .eq("aktif", true)
      .order("stok", { ascending: true })
      .limit(20);

    const stokMenipisData = (stokData ?? []).filter(
      (s) => s.stok <= s.stok_minimum,
    );

    setRingkasan(r as unknown as RingkasanOwner);
    setRingkasanBanding(rB as unknown as RingkasanOwner);
    setPendapatanHarian(ph ?? []);
    setLabaHarian(lh ?? []);
    setWoStatus(ws ?? []);
    setBebanMekanik(bm ?? []);
    setTopItem(ti ?? []);
    setStokMenipis(stokMenipisData.slice(0, 5));
    setLoading(false);
  }, [periode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void muat();
  }, [muat]);

  const r = ringkasan;
  const rb = ringkasanBanding;

  return (
    <div className="space-y-6">
      {/* ── Kartu KPI 6 ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KartuKPI
          judul="Pendapatan"
          nilai={r?.pendapatan ?? null}
          nilaiBanding={rb?.pendapatan}
          uang
          ikon={<DollarSign className="size-5 text-primary" />}
          warnaBg="bg-primary/10"
          loading={loading}
          onClick={() => router.push("/laporan-laba")}
        />
        <KartuKPI
          judul="Laba Kotor"
          nilai={r?.laba_kotor ?? null}
          nilaiBanding={rb?.laba_kotor}
          uang
          ikon={<TrendingUp className="size-5 text-success" />}
          warnaBg="bg-success/10"
          loading={loading}
          onClick={() => router.push("/laporan-laba")}
        />
        <KartuKPI
          judul="Margin"
          nilai={r?.margin_persen ?? null}
          nilaiBanding={rb?.margin_persen}
          persen
          ikon={<Percent className="size-5 text-warning" />}
          warnaBg="bg-warning/10"
          loading={loading}
        />
        <KartuKPI
          judul="WO Aktif"
          nilai={r?.wo_aktif ?? null}
          nilaiBanding={rb?.wo_aktif}
          ikon={<Clock className="size-5 text-primary" />}
          warnaBg="bg-primary/10"
          loading={loading}
          onClick={() => router.push("/work-orders?status=dikerjakan")}
        />
        <KartuKPI
          judul="WO Terlambat"
          nilai={r?.wo_terlambat ?? null}
          nilaiBanding={rb?.wo_terlambat}
          ikon={<AlertTriangle className="size-5 text-danger" />}
          warnaBg="bg-danger/10"
          loading={loading}
          keterangan="Estimasi selesai sudah lewat"
          onClick={() => router.push("/work-orders")}
        />
        <KartuKPI
          judul="Piutang"
          nilai={r?.piutang ?? null}
          nilaiBanding={rb?.piutang}
          uang
          ikon={<CreditCard className="size-5 text-warning" />}
          warnaBg="bg-warning/10"
          loading={loading}
          onClick={() => router.push("/work-orders?status=siap_diambil")}
        />
      </div>

      {/* ── Grafik Baris 1 ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GrafikAreaPendapatan
          data={pendapatanHarian}
          loading={loading}
          dataLaba={labaHarian}
        />
        <GrafikDonatKomposisi
          totalJasa={r?.pendapatan_jasa_total ?? null}
          totalPart={r?.pendapatan_part_total ?? null}
          loading={loading}
        />
      </div>

      {/* ── Grafik Baris 2 ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GrafikBatangWOStatus data={woStatus} loading={loading} />
        <GrafikBatangBebanMekanik data={bebanMekanik} loading={loading} />
      </div>

      {/* ── Top Item + Stok Menipis ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top 5 Item */}
        <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-text">
              Top 5 Item Terlaris
            </h2>
            <p className="text-sm text-text-muted">
              Item paling banyak dipakai di periode ini
            </p>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : topItem.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg bg-muted/30">
              <p className="text-sm text-text-muted">Belum ada data</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {topItem.map((item, i) => {
                const max = topItem[0]?.jumlah ?? 1;
                const pct = (item.jumlah / max) * 100;
                return (
                  <li key={item.nama} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 text-center text-xs font-semibold text-text-muted">
                          #{i + 1}
                        </span>
                        <span className="font-medium text-text">
                          {item.nama}
                        </span>
                      </span>
                      <span className="flex flex-col items-end text-xs tabular-nums">
                        <span className="font-semibold text-text">
                          {item.jumlah}×
                        </span>
                        <span className="text-text-muted">
                          {formatRupiah(item.pendapatan)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/50">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Stok Menipis */}
        <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">
                Stok Menipis
              </h2>
              <p className="text-sm text-text-muted">
                Spare part dengan stok ≤ stok minimum
              </p>
            </div>
            <button
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => router.push("/inventory")}
            >
              Lihat semua <ArrowRight className="size-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : stokMenipis.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg bg-muted/30">
              <p className="text-sm text-text-muted">Semua stok aman 🎉</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {stokMenipis.map((s) => {
                const pct = Math.min(
                  (s.stok / Math.max(s.stok_minimum, 1)) * 100,
                  100,
                );
                const habis = s.stok === 0;
                return (
                  <li
                    key={s.id}
                    className="cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/30"
                    onClick={() => router.push("/inventory")}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <Package className="size-4 text-text-muted" />
                        <span className="font-medium text-text">{s.nama}</span>
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          habis ? "text-danger" : "text-warning"
                        }`}
                      >
                        {habis ? "HABIS" : `${s.stok} / ${s.stok_minimum}`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted/50">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          habis ? "bg-danger" : "bg-warning"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
