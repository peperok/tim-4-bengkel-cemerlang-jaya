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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTanggalSingkat, formatRingkas } from "@/lib/dashboard";

export interface DataPendapatanHarian {
  tanggal: string;
  pendapatan_jasa: number;
  pendapatan_part: number;
}

interface Props {
  data: DataPendapatanHarian[] | null;
  loading?: boolean;
  /** Jika true tampil juga data laba (untuk Owner) */
  dataLaba?: { tanggal: string; laba: number }[] | null;
}

const chartConfig: ChartConfig = {
  pendapatan_jasa: {
    label: "Jasa",
    color: "var(--status-dikerjakan)",
  },
  pendapatan_part: {
    label: "Spare Part",
    color: "var(--status-siap-diambil)",
  },
  laba: {
    label: "Laba",
    color: "var(--success)",
  },
};

// Gabung data pendapatan dan laba berdasarkan tanggal
function gabungData(
  pendapatan: DataPendapatanHarian[],
  laba?: { tanggal: string; laba: number }[] | null,
): (DataPendapatanHarian & { laba?: number; tanggalLabel: string })[] {
  const labaMap = new Map(laba?.map((l) => [l.tanggal, l.laba]) ?? []);
  return pendapatan.map((d) => ({
    ...d,
    laba: labaMap.get(d.tanggal),
    tanggalLabel: formatTanggalSingkat(d.tanggal),
  }));
}

export function GrafikAreaPendapatan({ data, loading, dataLaba }: Props) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <Skeleton className="h-5 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-64 rounded mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  const chartData = data && data.length > 0 ? gabungData(data, dataLaba) : [];
  const kosong = chartData.length === 0;

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">
          Tren Pendapatan Harian
        </h2>
        <p className="text-sm text-text-muted">
          Pendapatan jasa dan spare part per hari
          {dataLaba ? ", dengan garis laba" : ""}
        </p>
      </div>

      {kosong ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-sm text-text-muted">
            Belum ada pendapatan di periode ini
          </p>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradJasa" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--status-dikerjakan)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--status-dikerjakan)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="gradPart" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--status-siap-diambil)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--status-siap-diambil)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
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
                    formatter={(value, name) => {
                      const label =
                        name === "pendapatan_jasa"
                          ? "Jasa"
                          : name === "pendapatan_part"
                            ? "Spare Part"
                            : "Laba";
                      return `${label}: Rp${Number(value).toLocaleString("id-ID")}`;
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="pendapatan_part"
                stackId="1"
                stroke="var(--status-siap-diambil)"
                fill="url(#gradPart)"
                strokeWidth={2}
                cursor={data ? "pointer" : "default"}
                onClick={() => router.push("/work-orders")}
              />
              <Area
                type="monotone"
                dataKey="pendapatan_jasa"
                stackId="1"
                stroke="var(--status-dikerjakan)"
                fill="url(#gradJasa)"
                strokeWidth={2}
                cursor={data ? "pointer" : "default"}
                onClick={() => router.push("/work-orders")}
              />
              {dataLaba && (
                <Area
                  type="monotone"
                  dataKey="laba"
                  stackId="2"
                  stroke="var(--success)"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
              )}
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}
