"use client";

import { useRouter } from "next/navigation";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRingkas } from "@/lib/dashboard";

// ── Grafik WO per Status (horizontal) ─────────────────────────────────────

const STATUS_WARNA: Record<string, string> = {
  menunggu: "#9E9E9E",
  dikerjakan: "#2196F3",
  tertunda: "#F59E0B",
  selesai: "#7E57C2",
  siap_diambil: "#4CAF50",
  diambil: "#2E7D32",
  dibatalkan: "#E53935",
};

const STATUS_LABEL: Record<string, string> = {
  menunggu: "Menunggu",
  dikerjakan: "Dikerjakan",
  tertunda: "Tertunda",
  selesai: "Selesai",
  siap_diambil: "Siap Diambil",
  diambil: "Diambil",
  dibatalkan: "Dibatalkan",
};

export interface DataWOStatus {
  status: string;
  jumlah: number;
}

interface PropsWOStatus {
  data: DataWOStatus[] | null;
  loading?: boolean;
}

export function GrafikBatangWOStatus({ data, loading }: PropsWOStatus) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <Skeleton className="h-5 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-56 rounded mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  const chartData = (data ?? [])
    .map((d) => ({
      status: d.status,
      label: STATUS_LABEL[d.status] ?? d.status,
      jumlah: d.jumlah,
    }))
    .sort((a, b) => {
      const urutan = Object.keys(STATUS_LABEL);
      return urutan.indexOf(a.status) - urutan.indexOf(b.status);
    });

  const kosong = chartData.length === 0 || chartData.every((d) => d.jumlah === 0);

  const cfg: ChartConfig = Object.fromEntries(
    Object.entries(STATUS_WARNA).map(([k, v]) => [k, { label: STATUS_LABEL[k], color: v }]),
  );

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">WO per Status</h2>
        <p className="text-sm text-text-muted">
          Jumlah work order di setiap status saat ini. Klik batang untuk
          membuka daftar.
        </p>
      </div>

      {kosong ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-sm text-text-muted">Belum ada WO di periode ini</p>
        </div>
      ) : (
        <ChartContainer config={cfg} className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 72, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={68}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) =>
                      `${STATUS_LABEL[String(name)] ?? name}: ${value} WO`
                    }
                  />
                }
              />
              <Bar dataKey="jumlah" radius={[0, 4, 4, 0]} cursor="pointer">
                {chartData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_WARNA[entry.status] ?? "#9E9E9E"}
                    onClick={() =>
                      router.push(`/work-orders?status=${entry.status}`)
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}

// ── Grafik Beban Mekanik ──────────────────────────────────────────────────

export interface DataBebanMekanik {
  mekanik: string;
  tim: string;
  wo_aktif: number;
  wo_selesai: number;
}

interface PropsBeban {
  data: DataBebanMekanik[] | null;
  loading?: boolean;
}

const cfgBeban: ChartConfig = {
  wo_aktif: { label: "WO Aktif", color: "var(--status-dikerjakan)" },
  wo_selesai: { label: "WO Selesai", color: "var(--status-siap-diambil)" },
};

export function GrafikBatangBebanMekanik({ data, loading }: PropsBeban) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <Skeleton className="h-5 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-56 rounded mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  const chartData = (data ?? []).map((d) => ({
    ...d,
    label: d.mekanik,
  }));

  const kosong = chartData.length === 0;

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">Beban Mekanik</h2>
        <p className="text-sm text-text-muted">
          WO aktif dan selesai per mekanik di periode ini
        </p>
      </div>

      {kosong ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-sm text-text-muted">Belum ada data mekanik</p>
        </div>
      ) : (
        <ChartContainer config={cfgBeban} className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => String(v)}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) =>
                      name === "wo_aktif"
                        ? `WO Aktif: ${value}`
                        : `WO Selesai: ${value}`
                    }
                  />
                }
              />
              <Bar
                dataKey="wo_aktif"
                stackId="a"
                fill="var(--status-dikerjakan)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="wo_selesai"
                stackId="a"
                fill="var(--status-siap-diambil)"
                radius={[4, 4, 0, 0]}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}

// ── Grafik Batang Pendapatan (untuk Admin – bar, bukan area) ─────────────

export interface DataPendapatanHarian {
  tanggal: string;
  pendapatan_jasa: number;
  pendapatan_part: number;
}

const cfgPendapatan: ChartConfig = {
  pendapatan_jasa: { label: "Jasa", color: "var(--status-dikerjakan)" },
  pendapatan_part: { label: "Spare Part", color: "var(--status-siap-diambil)" },
};

interface PropsPendapatan {
  data: DataPendapatanHarian[] | null;
  loading?: boolean;
}

export function GrafikBatangPendapatan({ data, loading }: PropsPendapatan) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <Skeleton className="h-5 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-56 rounded mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  const chartData = (data ?? []).map((d) => ({
    ...d,
    tanggalLabel: d.tanggal.slice(5).replace("-", "/"),
  }));

  const kosong = chartData.length === 0;

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">Pendapatan Harian</h2>
        <p className="text-sm text-text-muted">
          Pendapatan jasa dan spare part per hari. Klik batang untuk membuka WO.
        </p>
      </div>

      {kosong ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-sm text-text-muted">
            Belum ada pendapatan di periode ini
          </p>
        </div>
      ) : (
        <ChartContainer config={cfgPendapatan} className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="tanggalLabel"
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatRingkas}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) =>
                      name === "pendapatan_jasa"
                        ? `Jasa: Rp${Number(value).toLocaleString("id-ID")}`
                        : `Spare Part: Rp${Number(value).toLocaleString("id-ID")}`
                    }
                  />
                }
              />
              <Bar
                dataKey="pendapatan_part"
                stackId="a"
                fill="var(--status-siap-diambil)"
                cursor="pointer"
                onClick={() => router.push("/work-orders")}
              />
              <Bar
                dataKey="pendapatan_jasa"
                stackId="a"
                fill="var(--status-dikerjakan)"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={() => router.push("/work-orders")}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}

// ── Grafik Batang WO Selesai Harian (untuk Kepala Mekanik – line) ─────────

export interface DataWOSelesaiHarian {
  tanggal: string;
  jumlah: number;
}

const cfgWOSelesai: ChartConfig = {
  jumlah: { label: "WO Selesai", color: "var(--status-selesai)" },
};

interface PropsWOSelesai {
  data: DataWOSelesaiHarian[] | null;
  loading?: boolean;
}

export function GrafikBatangWOSelesai({ data, loading }: PropsWOSelesai) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <Skeleton className="h-5 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-56 rounded mb-4" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  const chartData = (data ?? []).map((d) => ({
    ...d,
    tanggalLabel: formatTanggalSingkat(d.tanggal),
  }));

  const kosong = chartData.length === 0;

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">WO Selesai per Hari</h2>
        <p className="text-sm text-text-muted">
          Jumlah WO tim yang mencapai status selesai per hari
        </p>
      </div>

      {kosong ? (
        <div className="flex h-40 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-sm text-text-muted">Belum ada WO selesai di periode ini</p>
        </div>
      ) : (
        <ChartContainer config={cfgWOSelesai} className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="tanggalLabel"
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `WO Selesai: ${value}`}
                  />
                }
              />
              <Bar
                dataKey="jumlah"
                fill="var(--status-selesai)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}

// Reexport formatTanggalSingkat lokal (tidak mengimpor ulang)
function formatTanggalSingkat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
