"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  LABEL_PERIODE,
  type PeriodeDashboard,
} from "@/lib/dashboard";
import type { Peran } from "@/lib/peran";
import { DashboardOwner } from "./DashboardOwner";
import { DashboardAdmin } from "./DashboardAdmin";
import { DashboardKepala } from "./DashboardKepala";

interface Props {
  peran: Peran;
  profilId: string;
}

const PERIODE_LIST: PeriodeDashboard[] = [
  "hari_ini",
  "7_hari",
  "30_hari",
  "bulan_ini",
];

export function DashboardClient({ peran, profilId }: Props) {
  const [periode, setPeriode] = useState<PeriodeDashboard>("7_hari");

  const handlePeriode = useCallback((p: PeriodeDashboard) => {
    setPeriode(p);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header + penyaring periode */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {peran === "owner"
              ? "Ringkasan bengkel secara menyeluruh"
              : peran === "admin"
                ? "Operasional hari ini dan antrean tagihan"
                : "Kondisi tim mekanik Anda"}
          </p>
        </div>

        {/* Tombol pilihan periode */}
        <div className="flex gap-1 rounded-xl border border-border bg-bg-panel p-1 shadow-card self-start">
          {PERIODE_LIST.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={periode === p ? "default" : "ghost"}
              className={
                periode === p
                  ? "rounded-lg text-sm font-medium"
                  : "rounded-lg text-sm font-medium text-text-muted hover:text-text"
              }
              onClick={() => handlePeriode(p)}
            >
              {LABEL_PERIODE[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Konten per peran */}
      {peran === "owner" && (
        <DashboardOwner periode={periode} />
      )}
      {peran === "admin" && (
        <DashboardAdmin periode={periode} />
      )}
      {peran === "kepala_mekanik" && (
        <DashboardKepala periode={periode} profilId={profilId} />
      )}
    </div>
  );
}
