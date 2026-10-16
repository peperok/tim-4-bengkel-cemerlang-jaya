"use client";

import { type ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/dashboard";

interface Props {
  judul: string;
  nilai: number | null;
  /** Nilai periode sebelumnya untuk menghitung perubahan */
  nilaiBanding?: number | null;
  /** Apakah nilai adalah angka uang (format Rp) */
  uang?: boolean;
  /** Apakah nilai adalah persentase */
  persen?: boolean;
  ikon: ReactNode;
  /** Warna aksen ikon */
  warnaBg?: string;
  loading?: boolean;
  /** Callback saat kartu diklik */
  onClick?: () => void;
  keterangan?: string;
}

function formatNilai(nilai: number, uang: boolean, persen: boolean): string {
  if (uang) return formatRupiah(nilai);
  if (persen) return `${nilai.toFixed(1)}%`;
  return nilai.toLocaleString("id-ID");
}

export function KartuKPI({
  judul,
  nilai,
  nilaiBanding,
  uang = false,
  persen = false,
  ikon,
  warnaBg = "bg-primary/10",
  loading = false,
  onClick,
  keterangan,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-panel p-5 shadow-card">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <Skeleton className="mt-4 h-8 w-32 rounded" />
        <Skeleton className="mt-2 h-4 w-24 rounded" />
      </div>
    );
  }

  // Hitung perubahan
  let delta: number | null = null;
  if (nilaiBanding != null && nilai != null) {
    if (nilaiBanding === 0) {
      delta = nilai > 0 ? 100 : 0;
    } else {
      delta = ((nilai - nilaiBanding) / nilaiBanding) * 100;
    }
  }

  const naik = delta !== null && delta > 0;
  const turun = delta !== null && delta < 0;

  return (
    <div
      className={`rounded-xl border border-border bg-bg-panel p-5 shadow-card transition-shadow ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`rounded-lg p-2 ${warnaBg}`}>{ikon}</div>
        {delta !== null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium tabular-nums ${
              naik
                ? "text-success"
                : turun
                  ? "text-danger"
                  : "text-text-muted"
            }`}
          >
            {naik ? (
              <TrendingUp className="size-3" />
            ) : turun ? (
              <TrendingDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-4 tabular-nums">
        <p className="text-2xl font-bold text-text leading-tight">
          {nilai !== null ? formatNilai(nilai, uang, persen) : "—"}
        </p>
        <p className="mt-1 text-sm text-text-muted">{judul}</p>
        {keterangan && (
          <p className="mt-0.5 text-xs text-text-muted/70">{keterangan}</p>
        )}
      </div>
    </div>
  );
}
