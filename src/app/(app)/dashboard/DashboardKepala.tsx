"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  hitungRentang,
  hitungRentangSebelumnya,
  type PeriodeDashboard,
} from "@/lib/dashboard";
import { BadgeStatus } from "@/components/BadgeStatus";
import { KartuKPI } from "./KartuKPI";
import { GrafikBatangBebanMekanik, GrafikBatangWOSelesai } from "./GrafikBatang";

interface RingkasanKepala {
  menunggu_ditugaskan: number;
  sedang_dikerjakan: number;
  menunggu_qc: number;
  terlambat: number;
}

interface WOAntrean {
  id: string;
  nomor: string;
  plat: string;
  nama_pelanggan: string;
  status: string;
  estimasi_selesai: string | null;
  terlambat: boolean;
}

interface Props {
  periode: PeriodeDashboard;
  profilId: string;
}

export function DashboardKepala({ periode, profilId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [ringkasan, setRingkasan] = useState<RingkasanKepala | null>(null);
  const [ringkasanBanding, setRingkasanBanding] =
    useState<RingkasanKepala | null>(null);
  const [bebanMekanik, setBebanMekanik] = useState<
    {
      mekanik: string;
      tim: string;
      wo_aktif: number;
      wo_selesai: number;
    }[]
  >([]);
  const [woSelesaiHarian, setWoSelesaiHarian] = useState<
    { tanggal: string; jumlah: number }[]
  >([]);
  const [antrean, setAntrean] = useState<WOAntrean[]>([]);
  const [antreanQC, setAntreanQC] = useState<WOAntrean[]>([]);

  const muat = useCallback(async () => {
    setLoading(true);
    const { dari, sampai } = hitungRentang(periode);
    const { dari: dariB, sampai: sampaiB } =
      hitungRentangSebelumnya(periode);
    const today = new Date().toISOString().slice(0, 10);

    const [
      { data: r },
      { data: rB },
      { data: bm },
      { data: wsh },
    ] = await Promise.all([
      supabase.rpc("dashboard_ringkasan", { p_dari: dari, p_sampai: sampai }),
      supabase.rpc("dashboard_ringkasan", {
        p_dari: dariB,
        p_sampai: sampaiB,
      }),
      supabase.rpc("dashboard_beban_mekanik", {
        p_dari: dari,
        p_sampai: sampai,
        p_tim: profilId,
      }),
      supabase.rpc("dashboard_wo_selesai_harian", {
        p_dari: dari,
        p_sampai: sampai,
      }),
    ]);

    // Antrean tim (menunggu, dikerjakan, tertunda, selesai)
    const { data: antreanData } = await supabase
      .from("work_orders")
      .select(
        "id, nomor, status, estimasi_selesai, vehicles(plat), customers!work_orders_customer_id_fkey(nama)",
      )
      .eq("kepala_mekanik_id", profilId)
      .in("status", ["menunggu", "dikerjakan", "tertunda", "selesai"])
      .order("estimasi_selesai", { ascending: true, nullsFirst: false })
      .limit(10);

    // WO menunggu QC (status = selesai)
    const { data: qcData } = await supabase
      .from("work_orders")
      .select(
        "id, nomor, status, estimasi_selesai, vehicles(plat), customers!work_orders_customer_id_fkey(nama)",
      )
      .eq("kepala_mekanik_id", profilId)
      .eq("status", "selesai")
      .order("updated_at", { ascending: false })
      .limit(5);

    function mapWO(
      wo: NonNullable<typeof antreanData>[number],
    ): WOAntrean {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = wo.vehicles as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = wo.customers as any;
      const estimasi = wo.estimasi_selesai ?? null;
      const terlambat =
        estimasi !== null &&
        estimasi < today &&
        !["selesai", "siap_diambil", "diambil", "dibatalkan"].includes(
          wo.status,
        );
      return {
        id: wo.id,
        nomor: wo.nomor,
        plat: v?.plat ?? "—",
        nama_pelanggan: c?.nama ?? "—",
        status: wo.status,
        estimasi_selesai: estimasi,
        terlambat,
      };
    }

    setRingkasan(r as unknown as RingkasanKepala);
    setRingkasanBanding(rB as unknown as RingkasanKepala);
    setBebanMekanik((bm ?? []).filter((m) => m.tim === profilId || true));
    setWoSelesaiHarian(wsh ?? []);
    setAntrean((antreanData ?? []).map(mapWO));
    setAntreanQC((qcData ?? []).map(mapWO));
    setLoading(false);
  }, [periode, profilId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void muat();
  }, [muat]);

  const r = ringkasan;
  const rb = ringkasanBanding;

  return (
    <div className="space-y-6">
      {/* ── Kartu KPI 4 ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <KartuKPI
          judul="Menunggu Ditugaskan"
          nilai={r?.menunggu_ditugaskan ?? null}
          nilaiBanding={rb?.menunggu_ditugaskan}
          ikon={<Clock className="size-5 text-text-muted" />}
          warnaBg="bg-muted/50"
          loading={loading}
          onClick={() => router.push("/work-orders?status=menunggu")}
        />
        <KartuKPI
          judul="Sedang Dikerjakan"
          nilai={r?.sedang_dikerjakan ?? null}
          nilaiBanding={rb?.sedang_dikerjakan}
          ikon={<Wrench className="size-5 text-primary" />}
          warnaBg="bg-primary/10"
          loading={loading}
          onClick={() =>
            router.push("/work-orders?status=dikerjakan")
          }
        />
        <KartuKPI
          judul="Menunggu QC"
          nilai={r?.menunggu_qc ?? null}
          nilaiBanding={rb?.menunggu_qc}
          ikon={<CheckCircle2 className="size-5 text-status-selesai" />}
          warnaBg="bg-purple-50"
          loading={loading}
          onClick={() => router.push("/work-orders?status=selesai")}
        />
        <KartuKPI
          judul="Terlambat"
          nilai={r?.terlambat ?? null}
          nilaiBanding={rb?.terlambat}
          ikon={<AlertTriangle className="size-5 text-danger" />}
          warnaBg="bg-danger/10"
          loading={loading}
          onClick={() => router.push("/work-orders")}
        />
      </div>

      {/* ── Grafik ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GrafikBatangBebanMekanik data={bebanMekanik} loading={loading} />
        <GrafikBatangWOSelesai data={woSelesaiHarian} loading={loading} />
      </div>

      {/* ── Antrean Tim + QC Hari Ini ────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Antrean Tim */}
        <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Antrean Tim</h2>
              <p className="text-sm text-text-muted">
                WO aktif tim Anda, diurutkan estimasi terdekat
              </p>
            </div>
            <button
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => router.push("/work-orders")}
            >
              Semua <ArrowRight className="size-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-muted/50"
                />
              ))}
            </div>
          ) : antrean.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg bg-muted/30">
              <p className="text-sm text-text-muted">
                Tidak ada WO aktif di tim Anda 🎉
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {antrean.map((wo) => (
                <li
                  key={wo.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30"
                  onClick={() => router.push(`/work-orders/${wo.id}`)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text truncate">
                        {wo.nomor}
                      </span>
                      {wo.terlambat && (
                        <span className="shrink-0 rounded-full bg-danger/10 px-1.5 py-0.5 text-xs font-medium text-danger">
                          Terlambat
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {wo.plat} · {wo.nama_pelanggan}
                    </p>
                  </div>
                  <BadgeStatus status={wo.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* QC Hari Ini */}
        <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">
                Menunggu QC
              </h2>
              <p className="text-sm text-text-muted">
                WO yang sudah selesai dikerjakan dan butuh QC Anda
              </p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-muted/50"
                />
              ))}
            </div>
          ) : antreanQC.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg bg-muted/30">
              <p className="text-sm text-text-muted">
                Tidak ada WO yang menunggu QC 🎉
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {antreanQC.map((wo) => (
                <li
                  key={wo.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">
                        {wo.nomor}
                      </p>
                      <p className="text-xs text-text-muted">
                        {wo.plat} · {wo.nama_pelanggan}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => router.push(`/work-orders/${wo.id}`)}
                    >
                      <CheckCheck className="size-3.5" />
                      QC
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
