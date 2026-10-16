"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Car,
  AlertTriangle,
  Loader2,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { Peran } from "@/lib/peran";

interface TombolAksiStatusProps {
  woId: string;
  statusSekarang: string;
  peran: Peran;
  userId: string;
  kepalaMekanikId: string;
  estimasiSelesai: string | null;
  jumlahMekanik: number;
  jumlahBillingItems: number;
  invoiceLunas: boolean;
  jumlahFotoAkhir: number;
}

export function TombolAksiStatus({
  woId,
  statusSekarang,
  peran,
  userId,
  kepalaMekanikId,
  estimasiSelesai,
  jumlahMekanik,
  jumlahBillingItems,
  invoiceLunas,
  jumlahFotoAkhir,
}: TombolAksiStatusProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // State dialog aksi
  const [dialogBuka, setDialogBuka] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [judulDialog, setJudulDialog] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");
  const [errorAksi, setErrorAksi] = useState<string | null>(null);

  const isOwner = peran === "owner";
  const isAdmin = peran === "admin";
  const isKepalaTimIni = peran === "kepala_mekanik" && userId === kepalaMekanikId;
  const bolehKelolaPengerjaan = isOwner || isKepalaTimIni;
  const bolehKelolaAdmin = isOwner || isAdmin;

  const bukaDialog = (status: string, judul: string) => {
    setTargetStatus(status);
    setJudulDialog(judul);
    setCatatan("");
    setErrorAksi(null);
    setDialogBuka(true);
  };

  const eksekusiUbahStatus = async (statusTujuan: string, textCatatan?: string) => {
    setErrorAksi(null);
    startTransition(async () => {
      const { error } = await supabase.rpc("ubah_status_wo", {
        p_wo: woId,
        p_status: statusTujuan,
        p_catatan: textCatatan || undefined,
      });

      if (error) {
        setErrorAksi(error.message);
      } else {
        setDialogBuka(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 1. Status: menunggu -> Mulai Kerjakan (ke dikerjakan) */}
      {statusSekarang === "menunggu" && bolehKelolaPengerjaan && (
        <Button
          size="sm"
          className="bg-primary text-white hover:bg-primary-strong"
          disabled={!estimasiSelesai || jumlahMekanik < 1 || isPending}
          onClick={() => eksekusiUbahStatus("dikerjakan")}
        >
          <Play className="mr-1.5 size-4" />
          Mulai Kerjakan
        </Button>
      )}

      {/* 2. Status: dikerjakan -> Tunda (wajib catatan) */}
      {statusSekarang === "dikerjakan" && bolehKelolaPengerjaan && (
        <Button
          size="sm"
          variant="outline"
          className="border-warning text-warning hover:bg-warning/10"
          onClick={() => bukaDialog("tertunda", "Tunda Pengerjaan Work Order")}
        >
          <Pause className="mr-1.5 size-4" />
          Tunda
        </Button>
      )}

      {/* 3. Status: tertunda -> Lanjutkan (ke dikerjakan) */}
      {statusSekarang === "tertunda" && bolehKelolaPengerjaan && (
        <Button
          size="sm"
          className="bg-primary text-white hover:bg-primary-strong"
          disabled={isPending}
          onClick={() => eksekusiUbahStatus("dikerjakan", "Melanjutkan pengerjaan")}
        >
          <Play className="mr-1.5 size-4" />
          Lanjutkan
        </Button>
      )}

      {/* 4. Status: dikerjakan -> Selesai Dikerjakan (ke selesai) */}
      {statusSekarang === "dikerjakan" && bolehKelolaPengerjaan && (
        <Button
          size="sm"
          className="bg-[#7E57C2] text-white hover:bg-[#6A1B9A]"
          disabled={jumlahBillingItems < 1 || isPending}
          title={
            jumlahBillingItems < 1
              ? "Catat minimal 1 jasa atau spare part sebelum menyelesaikan pengerjaan"
              : undefined
          }
          onClick={() => eksekusiUbahStatus("selesai")}
        >
          <CheckCircle className="mr-1.5 size-4" />
          Selesai Dikerjakan
        </Button>
      )}

      {/* 5. Status: selesai -> QC Lulus (ke siap_diambil) & QC Gagal (ke dikerjakan) */}
      {statusSekarang === "selesai" && bolehKelolaPengerjaan && (
        <>
          <Button
            size="sm"
            className="bg-success text-white hover:bg-success/90"
            disabled={isPending}
            onClick={() => eksekusiUbahStatus("siap_diambil", "QC Lulus")}
          >
            <FileCheck className="mr-1.5 size-4" />
            QC Lulus
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => bukaDialog("dikerjakan", "QC Gagal (Pengerjaan Ulang)")}
          >
            <XCircle className="mr-1.5 size-4" />
            QC Gagal
          </Button>
        </>
      )}

      {/* 6. Status: siap_diambil -> Serahkan Mobil (ke diambil) */}
      {statusSekarang === "siap_diambil" && bolehKelolaAdmin && (
        <Button
          size="sm"
          className="bg-[#2E7D32] text-white hover:bg-[#1B5E20]"
          disabled={!invoiceLunas || jumlahFotoAkhir < 1 || isPending}
          title={
            !invoiceLunas
              ? "Invoice harus lunas terlebih dahulu"
              : jumlahFotoAkhir < 1
                ? "Unggah minimal 1 foto kondisi akhir sebelum menyerahkan mobil"
                : undefined
          }
          onClick={() => eksekusiUbahStatus("diambil", "Mobil diserahkan kepada pelanggan")}
        >
          <Car className="mr-1.5 size-4" />
          Serahkan Mobil
        </Button>
      )}

      {/* 7. Batalkan WO: dari menunggu, dikerjakan, tertunda */}
      {["menunggu", "dikerjakan", "tertunda"].includes(statusSekarang) &&
        bolehKelolaAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => bukaDialog("dibatalkan", "Batalkan Work Order")}
          >
            Batalkan WO
          </Button>
        )}

      {/* Dialog Konfirmasi Input Catatan (Tunda, QC Gagal, Batal) */}
      <Dialog open={dialogBuka} onOpenChange={setDialogBuka}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              {judulDialog}
            </DialogTitle>
            <DialogDescription>
              {targetStatus === "tertunda" &&
                "Wajib mengisi alasan penundaan (misal: Menunggu spare part datang)."}
              {targetStatus === "dikerjakan" &&
                "Wajib mengisi catatan kekurangan pengerjaan yang perlu diperbaiki."}
              {targetStatus === "dibatalkan" &&
                "Wajib mengisi alasan pembatalan. Semua stok spare part yang terpasang akan otomatis dikembalikan ke inventory."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Textarea
              rows={3}
              placeholder="Tuliskan catatan / alasan di sini..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
            {errorAksi && (
              <p className="mt-2 text-xs font-medium text-destructive">{errorAksi}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogBuka(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant={targetStatus === "dibatalkan" ? "destructive" : "default"}
              disabled={!catatan.trim() || isPending}
              onClick={() => eksekusiUbahStatus(targetStatus, catatan.trim())}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Simpan & Perbarui Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
