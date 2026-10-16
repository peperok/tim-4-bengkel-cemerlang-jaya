"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  CheckCircle2,
  FileText,
  DollarSign,
  ArrowRight,
  Package,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  hitungRentang,
  hitungRentangSebelumnya,
  formatRupiah,
  type PeriodeDashboard,
} from "@/lib/dashboard";
import { KartuKPI } from "./KartuKPI";
import { GrafikBatangPendapatan } from "./GrafikBatang";
import { GrafikDonatWOStatus } from "./GrafikDonat";

interface RingkasanAdmin {
  mobil_masuk: number;
  siap_diambil: number;
  perlu_ditagih: number;
  pendapatan: number;
}

interface WOPerluTagih {
  id: string;
  nomor: string;
  plat: string;
  nama_pelanggan: string;
  status_invoice: string | null;
}

interface Props {
  periode: PeriodeDashboard;
}

export function DashboardAdmin({ periode }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [ringkasan, setRingkasan] = useState<RingkasanAdmin | null>(null);
  const [ringkasanBanding, setRingkasanBanding] =
    useState<RingkasanAdmin | null>(null);
  const [pendapatanHarian, setPendapatanHarian] = useState<
    { tanggal: string; pendapatan_jasa: number; pendapatan_part: number }[]
  >([]);
  const [woStatus, setWoStatus] = useState<
    { status: string; jumlah: number }[]
  >([]);
  const [perluTagih, setPerluTagih] = useState<WOPerluTagih[]>([]);
  const [siapSerah, setSiapSerah] = useState<WOPerluTagih[]>([]);
  const [stokMenipis, setStokMenipis] = useState<
    { id: string; nama: string; stok: number; stok_minimum: number }[]
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
      { data: ws },
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
      supabase.rpc("dashboard_wo_per_status"),
    ]);

    // WO perlu ditagih: siap_diambil tanpa invoice atau invoice belum lunas
    const { data: ptData } = await supabase
      .from("work_orders")
      .select(
        "id, nomor, invoices(status_bayar), vehicles(plat), customers!work_orders_customer_id_fkey(nama)",
      )
      .eq("status", "siap_diambil")
      .order("created_at", { ascending: false })
      .limit(5);

    // WO lunas belum diambil
    const { data: saData } = await supabase
      .from("work_orders")
      .select(
        "id, nomor, vehicles(plat), customers!work_orders_customer_id_fkey(nama)",
      )
      .eq("status", "siap_diambil")
      .limit(5);

    // Stok menipis
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

    setRingkasan(r as unknown as RingkasanAdmin);
    setRingkasanBanding(rB as unknown as RingkasanAdmin);
    setPendapatanHarian(ph ?? []);
    setWoStatus(ws ?? []);

    setPerluTagih(
      (ptData ?? []).map((wo) => ({
        id: wo.id,
        nomor: wo.nomor,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plat: (wo.vehicles as any)?.plat ?? "—",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nama_pelanggan: (wo.customers as any)?.nama ?? "—",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status_invoice: (wo.invoices as any)?.status_bayar ?? null,
      })),
    );

    setSiapSerah(
      (saData ?? []).map((wo) => ({
        id: wo.id,
        nomor: wo.nomor,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plat: (wo.vehicles as any)?.plat ?? "—",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nama_pelanggan: (wo.customers as any)?.nama ?? "—",
        status_invoice: null,
      })),
    );

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
      {/* ── Aksi Cepat ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-panel p-4 shadow-card">
        <Button
          className="gap-2"
          onClick={() => router.push("/work-orders/baru")}
        >
          <Plus className="size-4" />
          Work Order Baru
        </Button>
        <span className="text-sm text-text-muted hidden sm:block">
          atau cari plat di{" "}
          <button
            className="text-primary hover:underline"
            onClick={() => router.push("/work-orders")}
          >
            daftar WO
          </button>
        </span>
      </div>

      {/* ── Kartu KPI 4 ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <KartuKPI
          judul="Mobil Masuk"
          nilai={r?.mobil_masuk ?? null}
          nilaiBanding={rb?.mobil_masuk}
          ikon={<Car className="size-5 text-primary" />}
          warnaBg="bg-primary/10"
          loading={loading}
          onClick={() => router.push("/work-orders")}
        />
        <KartuKPI
          judul="Siap Diambil"
          nilai={r?.siap_diambil ?? null}
          nilaiBanding={rb?.siap_diambil}
          ikon={<CheckCircle2 className="size-5 text-success" />}
          warnaBg="bg-success/10"
          loading={loading}
          onClick={() =>
            router.push("/work-orders?status=siap_diambil")
          }
        />
        <KartuKPI
          judul="Perlu Ditagih"
          nilai={r?.perlu_ditagih ?? null}
          nilaiBanding={rb?.perlu_ditagih}
          ikon={<FileText className="size-5 text-warning" />}
          warnaBg="bg-warning/10"
          loading={loading}
          onClick={() =>
            router.push("/work-orders?status=siap_diambil")
          }
        />
        <KartuKPI
          judul="Pendapatan"
          nilai={r?.pendapatan ?? null}
          nilaiBanding={rb?.pendapatan}
          uang
          ikon={<DollarSign className="size-5 text-primary" />}
          warnaBg="bg-primary/10"
          loading={loading}
        />
      </div>

      {/* ── Grafik ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GrafikBatangPendapatan data={pendapatanHarian} loading={loading} />
        <GrafikDonatWOStatus data={woStatus} loading={loading} />
      </div>

      {/* ── Tabel Perlu Ditagih + Stok Menipis ───────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Perlu Ditagih */}
        <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">
                Perlu Ditagih
              </h2>
              <p className="text-sm text-text-muted">
                WO siap diambil yang belum lunas
              </p>
            </div>
            <button
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() =>
                router.push("/work-orders?status=siap_diambil")
              }
            >
              Lihat semua <ArrowRight className="size-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : perluTagih.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-lg bg-muted/30">
              <p className="text-sm text-text-muted">
                Tidak ada WO yang perlu ditagih 🎉
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {perluTagih.map((wo) => (
                <li
                  key={wo.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30"
                  onClick={() =>
                    router.push(`/work-orders/${wo.id}/tagihan`)
                  }
                >
                  <div>
                    <p className="text-sm font-medium text-text">{wo.nomor}</p>
                    <p className="text-xs text-text-muted">
                      {wo.plat} · {wo.nama_pelanggan}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      wo.status_invoice === null
                        ? "bg-warning/10 text-warning"
                        : wo.status_invoice === "sebagian"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-text-muted"
                    }`}
                  >
                    {wo.status_invoice === null
                      ? "Belum ditagih"
                      : wo.status_invoice === "sebagian"
                        ? "Sebagian"
                        : wo.status_invoice}
                  </span>
                </li>
              ))}
            </ul>
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
              Inventory <ArrowRight className="size-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : stokMenipis.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-lg bg-muted/30">
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
                        {habis
                          ? "HABIS"
                          : `${s.stok} / min ${s.stok_minimum}`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted/50">
                      <div
                        className={`h-1.5 rounded-full ${habis ? "bg-danger" : "bg-warning"}`}
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
