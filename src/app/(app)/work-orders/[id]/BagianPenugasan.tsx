"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface MekanikItem {
  id: string;
  nama: string;
  aktif: boolean;
  woAktif: number;
}

interface BagianPenugasanProps {
  woId: string;
  status: string;
  estimasiSelesai: string | null;
  mekanikTerpilih: string[];
  daftarMekanikTim: MekanikItem[];
  bolehUbah: boolean;
}

export function BagianPenugasan({
  woId,
  status,
  estimasiSelesai,
  mekanikTerpilih,
  daftarMekanikTim,
  bolehUbah,
}: BagianPenugasanProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [estimasi, setEstimasi] = useState<string>(
    estimasiSelesai || new Date().toISOString().split("T")[0],
  );
  const [selectedMekanik, setSelectedMekanik] = useState<string[]>(mekanikTerpilih);
  const [errorPesan, setErrorPesan] = useState<string | null>(null);
  const [suksesPesan, setSuksesPesan] = useState<string | null>(null);

  const toggleMekanik = (id: string) => {
    if (selectedMekanik.includes(id)) {
      setSelectedMekanik(selectedMekanik.filter((m) => m !== id));
    } else {
      if (selectedMekanik.length >= 3) return; // Maksimal 3 mekanik (PRD 6.8 Bagian B)
      setSelectedMekanik([...selectedMekanik, id]);
    }
  };

  const handleSimpanPenugasan = () => {
    setErrorPesan(null);
    setSuksesPesan(null);

    if (selectedMekanik.length < 1) {
      setErrorPesan("Pilih minimal 1 mekanik untuk pengerjaan");
      return;
    }
    if (!estimasi) {
      setErrorPesan("Estimasi selesai wajib diisi");
      return;
    }

    startTransition(async () => {
      const { error } = await supabase.rpc("tugaskan_mekanik", {
        p_wo: woId,
        p_mekanik: selectedMekanik,
        p_estimasi: estimasi,
      });

      if (error) {
        setErrorPesan(error.message);
      } else {
        setSuksesPesan("Penugasan mekanik dan estimasi selesai berhasil disimpan.");
        router.refresh();
      }
    });
  };

  // Hanya bisa diedit saat status 'menunggu' (PRD 6.8 Bagian B)
  const isEditable = status === "menunggu" && bolehUbah;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Users className="size-5 text-primary" />
          Bagian B. Penugasan Mekanik & Estimasi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estimasi Selesai */}
        <div className="max-w-xs">
          <Label htmlFor="estimasi" className="text-xs font-semibold uppercase text-text-muted">
            Estimasi Selesai <span className="text-destructive">*</span>
          </Label>
          <div className="relative mt-1">
            <Input
              id="estimasi"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={estimasi}
              disabled={!isEditable}
              onChange={(e) => setEstimasi(e.target.value)}
              className="bg-card"
            />
          </div>
        </div>

        {/* Pilihan Mekanik (1 - 3 orang) */}
        <div>
          <Label className="text-xs font-semibold uppercase text-text-muted">
            Pilih Mekanik Tim (1 - 3 orang) <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-text-muted mt-0.5">
            Daftar diurutkan berdasarkan beban kerja paling ringan
          </p>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {daftarMekanikTim.map((m, idx) => {
              const isSelected = selectedMekanik.includes(m.id);
              const isDisarankan = idx === 0 && m.woAktif <= 1;

              return (
                <div
                  key={m.id}
                  onClick={() => isEditable && toggleMekanik(m.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5 text-primary-strong"
                      : "border-border bg-card hover:bg-muted/50"
                  } ${!isEditable ? "pointer-events-none opacity-80" : ""}`}
                >
                  <div>
                    <p className="font-semibold text-text">{m.nama}</p>
                    <p className="text-xs text-text-muted">
                      {m.woAktif} WO aktif {isDisarankan && "· ★ Disarankan"}
                    </p>
                  </div>
                  <div
                    className={`flex size-5 items-center justify-center rounded-md border ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-muted-foreground/30 bg-background"
                    }`}
                  >
                    {isSelected && <Check className="size-3.5" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {errorPesan && (
          <p className="text-xs font-medium text-destructive">{errorPesan}</p>
        )}
        {suksesPesan && (
          <p className="text-xs font-medium text-success">{suksesPesan}</p>
        )}

        {isEditable && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSimpanPenugasan}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Simpan Penugasan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
