"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, DollarSign, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import type { Peran } from "@/lib/peran";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

type WorkshopData = {
  nama: string;
  alamat: string;
  telepon: string;
  logo_path: string | null;
  logo_url: string | null;
};

type InvoiceDetail = Tables<"invoices"> & {
  payments?: Tables<"payments">[];
};

type WorkOrderDetail = Tables<"work_orders"> & {
  customer?: Pick<Tables<"customers">, "nama" | "telepon" | "alamat"> | null;
  vehicle?: Pick<Tables<"vehicles">, "plat" | "merek_model" | "tahun"> | null;
};

type BillingItemDetail = Pick<
  Tables<"billing_items">,
  "id" | "nama_item" | "jenis" | "jumlah" | "harga_dipakai"
>;

export function InvoiceClient({
  wo,
  invoice,
  items,
  bengkel,
  peran,
}: {
  wo: WorkOrderDetail;
  invoice: InvoiceDetail;
  items: BillingItemDetail[];
  bengkel: WorkshopData;
  peran: Peran;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [bukaCatatBayar, setBukaCatatBayar] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState<"tunai" | "transfer" | "qris">("tunai");
  const [jumlahBayarInput, setJumlahBayarInput] = useState("");
  const [loadingBayar, setLoadingBayar] = useState(false);
  const [loadingBayarOnline, setLoadingBayarOnline] = useState(false);

  // Status invoice lokal untuk mendukung auto-refresh real-time hasil polling
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceDetail>(invoice);

  const isAdminOrOwner = peran === "admin" || peran === "owner";
  const sisaTagihan = Math.max(0, currentInvoice.total - currentInvoice.terbayar);
  const isLunas = currentInvoice.status_bayar === "lunas" || sisaTagihan === 0;

  function cetakInvoice() {
    window.print();
  }

  // Polling status invoice setiap 5 detik selama 5 menit (60 kali x 5 detik)
  const mulaiPollingInvoice = () => {
    let count = 0;
    const maxPolling = 60; // 5 menit
    const interval = setInterval(async () => {
      count++;
      try {
        const { data: refreshed, error } = await supabase
          .from("invoices")
          .select("*, payments(*)")
          .eq("id", currentInvoice.id)
          .single();

        if (!error && refreshed) {
          setCurrentInvoice(refreshed);
          if (refreshed.status_bayar === "lunas") {
            clearInterval(interval);
            toast.success("Pembayaran berhasil diverifikasi! Tagihan telah lunas.");
            router.refresh();
            return;
          }
        }
      } catch {
        // Abaikan kegagalan jaringan sementara saat polling
      }

      if (count >= maxPolling) {
        clearInterval(interval);
      }
    }, 5000);
  };

  async function handleBayarOnline() {
    setLoadingBayarOnline(true);
    try {
      const res = await fetch("/api/pembayaran/buat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoice_id: currentInvoice.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat link pembayaran online");
        return;
      }

      if (data.tautan) {
        toast.info("Membuka halaman pembayaran Mayar...");
        window.open(data.tautan, "_blank");
        // Mulai polling selama 5 menit untuk mengecek status lunas
        mulaiPollingInvoice();
      } else {
        toast.error("Tautan pembayaran tidak diterima dari server");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menghubungi layanan pembayaran");
    } finally {
      setLoadingBayarOnline(false);
    }
  }

  async function handleSimpanPembayaran() {
    const jumlahAngka = Number(jumlahBayarInput.replace(/\D/g, ""));
    if (isNaN(jumlahAngka) || jumlahAngka <= 0) {
      toast.error("Masukkan jumlah pembayaran yang valid (lebih dari Rp0)");
      return;
    }
    if (jumlahAngka > sisaTagihan) {
      toast.error(`Jumlah pembayaran (${rupiah(jumlahAngka)}) melebihi sisa tagihan (${rupiah(sisaTagihan)})`);
      return;
    }

    setLoadingBayar(true);
    try {
      const { error } = await supabase.rpc("catat_pembayaran", {
        p_invoice: currentInvoice.id,
        p_metode: metodeBayar,
        p_jumlah: jumlahAngka,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Pembayaran berhasil dicatat");
        setBukaCatatBayar(false);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mencatat pembayaran");
    } finally {
      setLoadingBayar(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Print Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          aside, header, nav, .no-print, [role="region"][aria-label*="Notifications"] {
            display: none !important;
          }
          body, main, div.min-h-dvh {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          .invoice-paper {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `,
        }}
      />

      {/* Navigasi Atas (Tidak Tampil Saat Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/work-orders/${wo.id}/tagihan`}>
            <ArrowLeft className="mr-1.5 size-4" />
            Kembali ke Tagihan
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {isAdminOrOwner && !isLunas && (
            <>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                disabled={loadingBayarOnline}
                onClick={handleBayarOnline}
              >
                <DollarSign className="size-4" />
                {loadingBayarOnline ? "Menghubungkan..." : "Bayar Online"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-success text-success hover:bg-success/10"
                onClick={() => {
                  setJumlahBayarInput(String(sisaTagihan));
                  setMetodeBayar("tunai");
                  setBukaCatatBayar(true);
                }}
              >
                <DollarSign className="size-4" />
                Catat Pembayaran
              </Button>
            </>
          )}

          <Button onClick={cetakInvoice} className="gap-1.5 bg-primary text-white hover:bg-primary-strong">
            <Printer className="size-4" />
            Cetak Invoice (PDF)
          </Button>
        </div>
      </div>

      {/* Lembar Invoice A4 */}
      <Card className="invoice-paper mx-auto max-w-4xl bg-white p-8 text-black shadow-card">
        {/* Kop Bengkel & Header Invoice */}
        <div className="flex items-start justify-between border-b pb-6">
          <div className="flex items-center gap-4">
            {bengkel.logo_url && (
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md border">
                <Image
                  src={bengkel.logo_url}
                  alt={bengkel.nama}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-text">
                {bengkel.nama}
              </h2>
              <p className="text-xs text-text-body">{bengkel.alamat}</p>
              <p className="text-xs text-text-muted">Telp: {bengkel.telepon}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black tracking-wide text-primary">
              INVOICE
            </div>
            <div className="font-mono text-sm font-semibold text-text">
              {currentInvoice.nomor}
            </div>
            <div className="text-xs text-text-muted">
              Tanggal: {tanggal(currentInvoice.diterbitkan_at)}
            </div>
            <div className="mt-1 flex flex-col items-end gap-0.5">
              <Badge
                variant={isLunas ? "default" : "outline"}
                className={
                  isLunas
                    ? "bg-success text-white"
                    : currentInvoice.status_bayar === "sebagian"
                    ? "border-warning text-warning"
                    : "border-danger text-danger"
                }
              >
                {isLunas
                  ? "LUNAS"
                  : currentInvoice.status_bayar === "sebagian"
                  ? "DIBAYAR SEBAGIAN"
                  : "BELUM BAYAR"}
              </Badge>
              {isLunas && currentInvoice.dibayar_online_at && (
                <span className="text-[10px] text-text-muted">
                  Dibayar online: {tanggal(currentInvoice.dibayar_online_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Informasi Pelanggan & Kendaraan */}
        <div className="grid grid-cols-2 gap-6 py-6 text-xs">
          <div className="space-y-1">
            <div className="font-semibold uppercase tracking-wider text-text-muted">
              Ditujukan Kepada
            </div>
            <div className="text-sm font-bold text-text">{wo.customer?.nama}</div>
            <div className="text-text-body">{wo.customer?.telepon}</div>
            {wo.customer?.alamat && (
              <div className="text-text-muted">{wo.customer.alamat}</div>
            )}
          </div>

          <div className="space-y-1 text-right">
            <div className="font-semibold uppercase tracking-wider text-text-muted">
              Data Kendaraan
            </div>
            <div className="text-sm font-bold font-mono text-text">{wo.vehicle?.plat}</div>
            <div className="text-text-body">
              {wo.vehicle?.merek_model} {wo.vehicle?.tahun ? `(${wo.vehicle.tahun})` : ""}
            </div>
            <div className="text-text-muted">
              No WO: <span className="font-mono font-medium">{wo.nomor}</span> · Odometer:{" "}
              {wo.odometer.toLocaleString("id-ID")} km
            </div>
          </div>
        </div>

        {/* Tabel Rincian Pekerjaan & Suku Cadang (PRD 6.9: Tidak memuat harga master / modal / alasan penyesuaian) */}
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[40px] text-center text-xs font-semibold">No</TableHead>
                <TableHead className="text-xs font-semibold">Deskripsi Item / Jasa Servis</TableHead>
                <TableHead className="w-[80px] text-center text-xs font-semibold">Jenis</TableHead>
                <TableHead className="w-[60px] text-center text-xs font-semibold">Qty</TableHead>
                <TableHead className="w-[120px] text-right text-xs font-semibold">Harga Satuan</TableHead>
                <TableHead className="w-[130px] text-right text-xs font-semibold">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {items.map((it, idx) => (
                <TableRow key={it.id}>
                  <TableCell className="text-center font-mono text-text-muted">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium text-text">{it.nama_item}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {it.jenis}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">{it.jumlah}</TableCell>
                  <TableCell className="text-right font-mono">{rupiah(it.harga_dipakai)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {rupiah(it.jumlah * it.harga_dipakai)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Ringkasan Biaya Invoice */}
        <div className="grid grid-cols-2 gap-6 pt-6">
          {/* Riwayat Pembayaran Ringkas */}
          <div className="space-y-2 text-xs">
            {currentInvoice.payments && currentInvoice.payments.length > 0 && (
              <>
                <div className="font-semibold uppercase tracking-wider text-text-muted">
                  Riwayat Pembayaran
                </div>
                <div className="divide-y rounded-md border text-[11px]">
                  {currentInvoice.payments.map((p) => (
                    <div key={p.id} className="flex justify-between p-2">
                      <span>
                        {tanggal(p.created_at)} ({p.metode.toUpperCase()})
                      </span>
                      <span className="font-mono font-medium text-success">
                        {rupiah(p.jumlah)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Angka Total */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal:</span>
              <span className="font-mono font-medium">{rupiah(currentInvoice.subtotal)}</span>
            </div>

            {currentInvoice.diskon > 0 && (
              <div className="flex justify-between text-danger">
                <span>Diskon:</span>
                <span className="font-mono font-medium">-{rupiah(currentInvoice.diskon)}</span>
              </div>
            )}

            <div className="flex justify-between border-t pt-1.5 text-sm font-bold text-text">
              <span>Total:</span>
              <span className="font-mono text-base">{rupiah(currentInvoice.total)}</span>
            </div>

            <div className="flex justify-between text-success">
              <span>Sudah Dibayar:</span>
              <span className="font-mono font-medium">{rupiah(currentInvoice.terbayar)}</span>
            </div>

            <div className="flex justify-between border-t border-dashed pt-1.5 font-bold">
              <span>Sisa Tagihan:</span>
              <span className={`font-mono ${sisaTagihan > 0 ? "text-danger" : "text-success"}`}>
                {rupiah(sisaTagihan)}
              </span>
            </div>
          </div>
        </div>

        {/* Area Tanda Tangan */}
        <div className="grid grid-cols-2 gap-12 pt-16 text-center text-xs">
          <div>
            <p className="text-text-muted">Penerima / Pemilik Kendaraan,</p>
            <div className="h-16" />
            <p className="border-t border-dashed pt-1 font-semibold text-text">
              ( {wo.customer?.nama} )
            </p>
          </div>

          <div>
            <p className="text-text-muted">Hormat Kami / Kasir Bengkel,</p>
            <div className="h-16" />
            <p className="border-t border-dashed pt-1 font-semibold text-text">
              ( {bengkel.nama} )
            </p>
          </div>
        </div>
      </Card>

      {/* Dialog Catat Pembayaran dari Halaman Invoice */}
      <Dialog open={bukaCatatBayar} onOpenChange={setBukaCatatBayar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Invoice</DialogTitle>
            <DialogDescription>
              Invoice: <strong>{invoice.nomor}</strong> · Sisa Tagihan:{" "}
              <strong>{rupiah(sisaTagihan)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel>Metode Pembayaran</FieldLabel>
              <Select
                value={metodeBayar}
                onValueChange={(val) => setMetodeBayar(val as "tunai" | "transfer" | "qris")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tunai">Tunai (Cash)</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Jumlah Pembayaran (Rp)</FieldLabel>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline font-medium"
                  onClick={() => setJumlahBayarInput(String(sisaTagihan))}
                >
                  Bayar Lunas ({rupiah(sisaTagihan)})
                </button>
              </div>
              <Input
                type="number"
                min={1}
                max={sisaTagihan}
                value={jumlahBayarInput}
                onChange={(e) => setJumlahBayarInput(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaCatatBayar(false)} disabled={loadingBayar}>
              Batal
            </Button>
            <Button
              onClick={handleSimpanPembayaran}
              disabled={loadingBayar}
              className="bg-success hover:bg-success/90 text-white"
            >
              {loadingBayar ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
