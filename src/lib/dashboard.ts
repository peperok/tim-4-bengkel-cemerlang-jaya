/**
 * Helper rentang tanggal dashboard (PRD 12.1).
 * Dashboard date-range helpers (PRD 12.1).
 */

export type PeriodeDashboard = "hari_ini" | "7_hari" | "30_hari" | "bulan_ini";

export const LABEL_PERIODE: Record<PeriodeDashboard, string> = {
  hari_ini: "Hari ini",
  "7_hari": "7 hari",
  "30_hari": "30 hari",
  bulan_ini: "Bulan ini",
};

export function hitungRentang(periode: PeriodeDashboard): {
  dari: string;
  sampai: string;
} {
  const now = new Date();
  const today = toDateStr(now);

  switch (periode) {
    case "hari_ini":
      return { dari: today, sampai: today };

    case "7_hari": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { dari: toDateStr(d), sampai: today };
    }

    case "30_hari": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { dari: toDateStr(d), sampai: today };
    }

    case "bulan_ini": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dari: toDateStr(d), sampai: today };
    }
  }
}

/**
 * Rentang periode sebelumnya dengan panjang yang sama, untuk perbandingan KPI.
 * Previous period of equal length, for KPI comparison.
 */
export function hitungRentangSebelumnya(periode: PeriodeDashboard): {
  dari: string;
  sampai: string;
} {
  const { dari, sampai } = hitungRentang(periode);
  const d1 = new Date(dari);
  const d2 = new Date(sampai);
  const durasi = d2.getTime() - d1.getTime(); // ms

  const prev2 = new Date(d1.getTime() - durasi - 86_400_000);
  const prev1 = new Date(d1.getTime() - 86_400_000);
  return { dari: toDateStr(prev2), sampai: toDateStr(prev1) };
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format angka uang: Rp12.500.000 */
export function formatRupiah(nilai: number): string {
  return `Rp${nilai.toLocaleString("id-ID")}`;
}

/** Format angka ringkas untuk sumbu grafik: 12,5 jt / 500 rb */
export function formatRingkas(nilai: number): string {
  if (nilai >= 1_000_000_000)
    return `${(nilai / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (nilai >= 1_000_000)
    return `${(nilai / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (nilai >= 1_000) return `${(nilai / 1_000).toFixed(0)} rb`;
  return `${nilai}`;
}

/** Format tanggal singkat: 14 Okt */
export function formatTanggalSingkat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
