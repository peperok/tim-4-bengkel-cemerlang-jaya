"use client";

import { useRouter } from "next/navigation";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/dashboard";

// ── Donat WO per Status ───────────────────────────────────────────────────

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

export function GrafikDonatWOStatus({ data, loading }: PropsWOStatus) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <Skeleton className="h-5 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-56 rounded mb-4" />
        <Skeleton className="h-48 w-full rounded-full mx-auto" style={{ maxWidth: 192 }} />
      </div>
    );
  }

  const chartData = (data ?? []).filter((d) => d.jumlah > 0);
  const total = chartData.reduce((s, d) => s + d.jumlah, 0);
  const kosong = chartData.length === 0;

  const cfg: ChartConfig = Object.fromEntries(
    Object.entries(STATUS_WARNA).map(([k, v]) => [
      k,
      { label: STATUS_LABEL[k], color: v },
    ]),
  );

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">
          Komposisi Status WO
        </h2>
        <p className="text-sm text-text-muted">
          Proporsi work order per status. Klik irisan untuk membuka daftar.
        </p>
      </div>

      {kosong ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-sm text-text-muted">Belum ada WO</p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ChartContainer config={cfg} className="h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) =>
                        `${STATUS_LABEL[String(name)] ?? name}: ${value} WO`
                      }
                    />
                  }
                />
                <Pie
                  data={chartData}
                  dataKey="jumlah"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  cursor="pointer"
                   onClick={(entry) => {
                     const d = entry as unknown as DataWOStatus;
                     router.push(`/work-orders?status=${d.status}`);
                   }}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_WARNA[entry.status] ?? "#9E9E9E"}
                    />
                  ))}
                </Pie>
                {/* Total di tengah (SVG text) */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-text text-xl font-bold"
                  style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700 }}
                >
                  {total}
                </text>
                <text
                  x="50%"
                  y="62%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-text-muted"
                  style={{ fontFamily: "inherit", fontSize: 11 }}
                >
                  Total WO
                </text>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Legenda manual */}
          <ul className="flex flex-col gap-1.5 text-sm">
            {chartData.map((d) => (
              <li
                key={d.status}
                className="flex cursor-pointer items-center gap-2 rounded px-1 hover:bg-muted/40"
                onClick={() =>
                  router.push(`/work-orders?status=${d.status}`)
                }
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: STATUS_WARNA[d.status] ?? "#9E9E9E",
                  }}
                />
                <span className="text-text-muted">
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
                <span className="ml-auto font-semibold tabular-nums text-text">
                  {d.jumlah}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Donat Komposisi Pendapatan (Jasa vs Part) ────────────────────────────

interface PropsKomposisi {
  totalJasa: number | null;
  totalPart: number | null;
  loading?: boolean;
}

const cfgKomposisi: ChartConfig = {
  jasa: { label: "Jasa", color: "var(--status-dikerjakan)" },
  part: { label: "Spare Part", color: "var(--status-siap-diambil)" },
};

export function GrafikDonatKomposisi({
  totalJasa,
  totalPart,
  loading,
}: PropsKomposisi) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <Skeleton className="h-5 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-56 rounded mb-4" />
        <Skeleton className="h-48 w-48 rounded-full mx-auto" />
      </div>
    );
  }

  const j = totalJasa ?? 0;
  const p = totalPart ?? 0;
  const total = j + p;
  const kosong = total === 0;

  const chartData = [
    { name: "jasa", value: j },
    { name: "part", value: p },
  ];

  return (
    <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-text">
          Komposisi Pendapatan
        </h2>
        <p className="text-sm text-text-muted">
          Proporsi pendapatan jasa vs spare part di periode ini
        </p>
      </div>

      {kosong ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
          <p className="text-sm text-text-muted">
            Belum ada pendapatan di periode ini
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ChartContainer config={cfgKomposisi} className="h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) =>
                        `${name === "jasa" ? "Jasa" : "Spare Part"}: ${formatRupiah(Number(value))}`
                      }
                    />
                  }
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  <Cell fill="var(--status-dikerjakan)" />
                  <Cell fill="var(--status-siap-diambil)" />
                </Pie>
                <text
                  x="50%"
                  y="46%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontFamily: "inherit", fontSize: 11 }}
                  className="fill-text-muted"
                >
                  Total
                </text>
                <text
                  x="50%"
                  y="58%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}
                  className="fill-text"
                >
                  {formatRupiah(total)}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--status-dikerjakan)" }}
              />
              <span className="text-text-muted">Jasa</span>
              <span className="ml-auto font-semibold tabular-nums text-text">
                {formatRupiah(j)}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--status-siap-diambil)" }}
              />
              <span className="text-text-muted">Spare Part</span>
              <span className="ml-auto font-semibold tabular-nums text-text">
                {formatRupiah(p)}
              </span>
            </li>
            <li className="flex items-center gap-2 border-t border-border pt-1">
              <span className="text-text-muted">Jasa</span>
              <span className="ml-auto text-text">
                {total > 0 ? `${((j / total) * 100).toFixed(1)}%` : "—"}
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
