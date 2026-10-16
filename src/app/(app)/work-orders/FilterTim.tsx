"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface TimItem {
  id: string;
  nama: string;
}

export function FilterTim({
  daftarTim,
  timAktif,
}: {
  daftarTim: TimItem[];
  timAktif: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sp = new URLSearchParams(searchParams.toString());
    const val = e.target.value;
    if (val && val !== "semua") {
      sp.set("tim", val);
    } else {
      sp.delete("tim");
    }
    sp.set("hal", "1");
    router.push(`/work-orders?${sp.toString()}`);
  };

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">Tim:</span>
      <select
        aria-label="Pilih tim kepala mekanik"
        className="h-9 rounded-md border border-input bg-card px-2.5 text-sm text-text"
        value={timAktif || "semua"}
        onChange={handleChange}
      >
        <option value="semua">Semua Tim</option>
        {daftarTim.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nama}
          </option>
        ))}
      </select>
    </div>
  );
}
