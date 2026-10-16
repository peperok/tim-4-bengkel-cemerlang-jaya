"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  FileCheck,
  FileText,
  Info,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import type { Peran } from "@/lib/peran";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

export type BillingItemRow = Tables<"billing_items"> & {
  billing_item_costs?: { harga_modal: number } | null;
  penyesuai?: { nama: string } | null;
  penambah?: { nama: string } | null;
};

export type WorkOrderData = Tables<"work_orders"> & {
  customer?: Pick<Tables<"customers">, "nama" | "telepon"> | null;
  vehicle?: Pick<Tables<"vehicles">, "plat" | "merek_model" | "tahun"> | null;
  kepala_mekanik?: Pick<Tables<"profiles">, "nama"> | null;
};

export type InvoiceData = Tables<"invoices"> & {
  payments?: Tables<"payments">[];
};

type ItemInventory = Pick<Tables<"inventory_items">, "id" | "kode" | "nama" | "jenis" | "harga_jual" | "stok">;

const ALASAN_PENYESUAIAN_OPTIONS = [
  "Harga khusus pelanggan",
  "Negosiasi",
  "Harga paket",
  "Koreksi harga master",
  "Lainnya",
];

export function TagihanClient({
  wo,
  items,
  invoice,
  inventoryParts,
  inventoryJasa,
  peran,
  userId,
}: {
  wo: WorkOrderData;
  items: BillingItemRow[];
  invoice: InvoiceData | null;
  inventoryParts: ItemInventory[];
  inventoryJasa: ItemInventory[];
  peran: Peran;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  // Dialog State
  const [bukaTambahPart, setBukaTambahPart] = useState(false);
  const [bukaTambahJasa, setBukaTambahJasa] = useState(false);
  const [bukaSesuaikanHarga, setBukaSesuaikanHarga] = useState(false);
  const [bukaAturDiskon, setBukaAturDiskon] = useState(false);
  const [bukaTerbitkanInvoice, setBukaTerbitkanInvoice] = useState(false);
  const [bukaCatatBayar, setBukaCatatBayar] = useState(false);
  const [bukaHapusItem, setBukaHapusItem] = useState(false);
  const [itemMauDihapus, setItemMauDihapus] = useState<BillingItemRow | null>(null);

  // Form State: Tambah Item
  const [pilihanItemId, setPilihanItemId] = useState("");
  const [jumlahItem, setJumlahItem] = useState(1);
  const [loadingAksi, setLoadingAksi] = useState(false);

  // Form State: Sesuaikan Harga
  const [itemDisesuaikan, setItemDisesuaikan] = useState<BillingItemRow | null>(null);
  const [hargaBaruInput, setHargaBaruInput] = useState("");
  const [alasanPilihan, setAlasanPilihan] = useState(ALASAN_PENYESUAIAN_OPTIONS[0]);
  const [alasanKustom, setAlasanKustom] = useState("");

  // Form State: Atur Diskon
  const [diskonInput, setDiskonInput] = useState(wo.diskon ? String(wo.diskon) : "0");
  const [alasanDiskonInput, setAlasanDiskonInput] = useState(wo.alasan_diskon ?? "");

  // Form State: Catat Pembayaran
  const [metodeBayar, setMetodeBayar] = useState<"tunai" | "transfer" | "qris">("tunai");
  const [jumlahBayarInput, setJumlahBayarInput] = useState("");

  // Hak Akses
  const isInvoiceTerbit = !!invoice;
  const isOwner = peran === "owner";
  const isAdminOrOwner = peran === "admin" || peran === "owner";
  const isTimWO = wo.kepala_mekanik_id === userId;
  const bolehKelolaPengerjaan = (isOwner || (peran === "kepala_mekanik" && isTimWO)) && wo.status === "dikerjakan" && !isInvoiceTerbit;
  const bolehSesuaikanTagihan = isAdminOrOwner && !isInvoiceTerbit;
  const bolehTerbitkanInvoice = isAdminOrOwner && !isInvoiceTerbit && wo.status === "siap_diambil";
  const bolehCatatBayar = isAdminOrOwner && isInvoiceTerbit && invoice.status_bayar !== "lunas";

  // Perhitungan Subtotal, Diskon, Total, Modal, dan Laba
  const subtotalTagihan = items.reduce((acc, item) => acc + item.jumlah * item.harga_dipakai, 0);
  const diskonWO = Number(wo.diskon) || 0;
  const totalTagihan = Math.max(0, subtotalTagihan - diskonWO);

  const totalModalWO = items.reduce((acc, item) => {
    const modalSatuan = item.billing_item_costs?.harga_modal ?? 0;
    return acc + modalSatuan * item.jumlah;
  }, 0);
  const totalLabaWO = totalTagihan - totalModalWO;

  // 1. Aksi Tambah Item
  async function handleTambahItem(jenis: "part" | "jasa") {
    if (!pilihanItemId) {
      toast.error(`Pilih ${jenis === "part" ? "spare part" : "jasa"} terlebih dahulu`);
      return;
    }
    if (jumlahItem < 1) {
      toast.error("Jumlah item minimal 1");
      return;
    }

    setLoadingAksi(true);
    try {
      const { error } = await supabase.rpc("tambah_item_tagihan", {
        p_wo: wo.id,
        p_item: pilihanItemId,
        p_jumlah: Number(jumlahItem),
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Berhasil menambahkan ${jenis === "part" ? "spare part" : "jasa"}`);
        setPilihanItemId("");
        setJumlahItem(1);
        setBukaTambahPart(false);
        setBukaTambahJasa(false);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan item");
    } finally {
      setLoadingAksi(false);
    }
  }

  // 2. Aksi Hapus Item
  async function handleHapusItem() {
    if (!itemMauDihapus) return;

    setLoadingAksi(true);
    try {
      const { error } = await supabase.rpc("hapus_item_tagihan", {
        p_billing_item: itemMauDihapus.id,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Item tagihan berhasil dihapus dan stok dikembalikan");
        setBukaHapusItem(false);
        setItemMauDihapus(null);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus item");
    } finally {
      setLoadingAksi(false);
    }
  }

  // 3. Aksi Sesuaikan Harga
  async function handleSimpanPenyesuaianHarga() {
    if (!itemDisesuaikan) return;
    const hargaAngka = Number(hargaBaruInput.replace(/\D/g, ""));
    if (isNaN(hargaAngka) || hargaAngka < 0) {
      toast.error("Masukkan harga baru yang valid");
      return;
    }

    const alasanFinal =
      alasanPilihan === "Lainnya" ? alasanKustom.trim() : alasanPilihan;

    if (!alasanFinal) {
      toast.error("Alasan penyesuaian harga wajib diisi");
      return;
    }

    setLoadingAksi(true);
    try {
      const { data: diBawahModal, error } = await supabase.rpc("sesuaikan_harga_item", {
        p_billing_item: itemDisesuaikan.id,
        p_harga: hargaAngka,
        p_alasan: alasanFinal,
      });

      if (error) {
        toast.error(error.message);
      } else {
        if (diBawahModal) {
          toast.warning("Harga berhasil disesuaikan, namun harga ini berada di bawah harga modal!");
        } else {
          toast.success("Harga item berhasil disesuaikan");
        }
        setBukaSesuaikanHarga(false);
        setItemDisesuaikan(null);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyesuaikan harga");
    } finally {
      setLoadingAksi(false);
    }
  }

  // 4. Aksi Atur Diskon
  async function handleSimpanDiskon() {
    const diskonAngka = Number(diskonInput.replace(/\D/g, "")) || 0;
    if (diskonAngka < 0) {
      toast.error("Nominal diskon tidak boleh negatif");
      return;
    }
    if (diskonAngka > subtotalTagihan) {
      toast.error(`Diskon tidak boleh melebihi subtotal tagihan (${rupiah(subtotalTagihan)})`);
      return;
    }
    if (diskonAngka > 0 && !alasanDiskonInput.trim()) {
      toast.error("Alasan diskon wajib diisi jika memberikan diskon");
      return;
    }

    setLoadingAksi(true);
    try {
      const { error } = await supabase.rpc("atur_diskon", {
        p_wo: wo.id,
        p_diskon: diskonAngka,
        p_alasan: diskonAngka > 0 ? alasanDiskonInput.trim() : "",
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(diskonAngka > 0 ? "Diskon berhasil disimpan" : "Diskon berhasil dihapus");
        setBukaAturDiskon(false);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengatur diskon");
    } finally {
      setLoadingAksi(false);
    }
  }

  // 5. Aksi Terbitkan Invoice
  async function handleTerbitkanInvoice() {
    if (wo.status !== "siap_diambil") {
      toast.error("Invoice hanya dapat diterbitkan saat status WO sudah Siap Diambil");
      return;
    }
    if (items.length === 0) {
      toast.error("Tagihan masih kosong, tidak dapat menerbitkan invoice");
      return;
    }

    setLoadingAksi(true);
    try {
      const { error } = await supabase.rpc("terbitkan_invoice", {
        p_wo: wo.id,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Invoice resmi berhasil diterbitkan!");
        setBukaTerbitkanInvoice(false);
        router.push(`/work-orders/${wo.id}/invoice`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menerbitkan invoice");
    } finally {
      setLoadingAksi(false);
    }
  }

  // 6. Aksi Catat Pembayaran
  async function handleCatatPembayaran() {
    if (!invoice) return;
    const jumlahAngka = Number(jumlahBayarInput.replace(/\D/g, ""));
    const sisa = invoice.total - invoice.terbayar;

    if (isNaN(jumlahAngka) || jumlahAngka <= 0) {
      toast.error("Masukkan jumlah pembayaran yang valid (lebih dari Rp0)");
      return;
    }
    if (jumlahAngka > sisa) {
      toast.error(`Jumlah pembayaran (${rupiah(jumlahAngka)}) melebihi sisa tagihan (${rupiah(sisa)})`);
      return;
    }

    setLoadingAksi(true);
    try {
      const { error } = await supabase.rpc("catat_pembayaran", {
        p_invoice: invoice.id,
        p_metode: metodeBayar,
        p_jumlah: jumlahAngka,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Pembayaran berhasil dicatat");
        setJumlahBayarInput("");
        setBukaCatatBayar(false);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mencatat pembayaran");
    } finally {
      setLoadingAksi(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info WO & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Tagihan: {wo.nomor}
            </h1>
            <BadgeStatus status={wo.status} />
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {wo.customer?.nama} ({wo.customer?.telepon}) · {wo.vehicle?.plat} ({wo.vehicle?.merek_model}) · Tim {wo.kepala_mekanik?.nama}
          </p>
        </div>

        {/* Invoice Link / Status Banner */}
        {isInvoiceTerbit ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary bg-primary/10 px-3 py-1.5 text-primary">
              <FileCheck className="size-4" />
              {invoice.nomor} ({invoice.status_bayar === "lunas" ? "Lunas" : invoice.status_bayar === "sebagian" ? "Dibayar Sebagian" : "Belum Bayar"})
            </Badge>
            <Button asChild variant="default" size="sm">
              <Link href={`/work-orders/${wo.id}/invoice`}>
                <FileText className="mr-1.5 size-4" />
                Buka Invoice
              </Link>
            </Button>
          </div>
        ) : (
          bolehTerbitkanInvoice && (
            <Button onClick={() => setBukaTerbitkanInvoice(true)} className="gap-1.5 bg-primary text-white hover:bg-primary-strong">
              <Receipt className="size-4" />
              Terbitkan Invoice
            </Button>
          )
        )}
      </div>

      {/* Info Banner status tagihan */}
      {isInvoiceTerbit ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-text-body">
          <Info className="size-5 shrink-0 text-primary" />
          <div>
            <span className="font-semibold text-text">Tagihan Terkunci.</span> Invoice resmi telah diterbitkan dengan nomor <strong>{invoice.nomor}</strong> pada {tanggal(invoice.diterbitkan_at)}. Baris tagihan dan diskon tidak dapat diubah lagi.
          </div>
        </div>
      ) : wo.status !== "dikerjakan" && wo.status !== "siap_diambil" ? (
        <div className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-text-body">
          <AlertCircle className="size-5 shrink-0 text-warning" />
          <div>
            Status WO saat ini adalah <strong>{wo.status}</strong>. Penambahan dan penghapusan spare part atau jasa hanya dapat dilakukan oleh Kepala Mekanik saat status <strong>dikerjakan</strong>.
          </div>
        </div>
      ) : null}

      {/* Tabel Item Tagihan */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Rincian Item & Jasa</CardTitle>
            <CardDescription>
              Daftar spare part dan layanan servis yang digunakan pada kendaraan
            </CardDescription>
          </div>

          {bolehKelolaPengerjaan && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPilihanItemId("");
                  setJumlahItem(1);
                  setBukaTambahPart(true);
                }}
              >
                <Plus className="mr-1.5 size-4" />
                + Spare Part
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPilihanItemId("");
                  setJumlahItem(1);
                  setBukaTambahJasa(true);
                }}
              >
                <Plus className="mr-1.5 size-4" />
                + Jasa
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No</TableHead>
                <TableHead>Item / Layanan</TableHead>
                <TableHead className="w-[100px]">Jenis</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Harga Master</TableHead>
                <TableHead className="text-right">Harga Dipakai</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                {isOwner && (
                  <>
                    <TableHead className="text-right text-muted-foreground">Modal</TableHead>
                    <TableHead className="text-right text-muted-foreground">Laba</TableHead>
                  </>
                )}
                {(!isInvoiceTerbit || bolehKelolaPengerjaan) && (
                  <TableHead className="w-[80px] text-center">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 10 : 8}
                    className="h-32 text-center text-text-muted"
                  >
                    Belum ada item tagihan yang dicatat untuk Work Order ini.
                    {bolehKelolaPengerjaan && (
                      <p className="mt-1 text-xs">
                        Gunakan tombol di atas untuk mencatat spare part atau jasa.
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  const isDisesuaikan = item.harga_dipakai !== item.harga_master;
                  const subtotalItem = item.jumlah * item.harga_dipakai;
                  const modalItem = item.billing_item_costs?.harga_modal ?? 0;
                  const labaItem = (item.harga_dipakai - modalItem) * item.jumlah;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-text-muted">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-text">{item.nama_item}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            item.jenis === "part"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                          }
                        >
                          {item.jenis === "part" ? "Part" : "Jasa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">{item.jumlah}</TableCell>
                      <TableCell className="text-right font-mono text-text-muted">
                        {rupiah(item.harga_master)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono font-medium text-text">
                            {rupiah(item.harga_dipakai)}
                          </span>

                          {/* Penanda harga disesuaikan dengan popover alasan */}
                          {isDisesuaikan && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded-full bg-amber-100 p-0.5 text-amber-800 transition-colors hover:bg-amber-200"
                                  title="Harga Disesuaikan (Klik untuk alasan)"
                                >
                                  <Info className="size-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 text-xs">
                                <div className="space-y-1.5">
                                  <div className="font-semibold text-text">
                                    Penyesuaian Harga
                                  </div>
                                  <p className="text-text-body">
                                    <strong>Alasan:</strong> {item.alasan_penyesuaian}
                                  </p>
                                  {item.penyesuai?.nama && (
                                    <p className="text-text-muted">
                                      Oleh: {item.penyesuai.nama}
                                    </p>
                                  )}
                                  {item.disesuaikan_at && (
                                    <p className="text-text-muted">
                                      Waktu: {tanggal(item.disesuaikan_at)}
                                    </p>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-text">
                        {rupiah(subtotalItem)}
                      </TableCell>

                      {/* Modal & Laba Baris (Khusus Owner) */}
                      {isOwner && (
                        <>
                          <TableCell className="text-right font-mono text-text-muted">
                            {rupiah(modalItem * item.jumlah)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-medium ${
                              labaItem < 0 ? "text-danger" : "text-success"
                            }`}
                          >
                            {rupiah(labaItem)}
                          </TableCell>
                        </>
                      )}

                      {/* Aksi Baris */}
                      {(!isInvoiceTerbit || bolehKelolaPengerjaan) && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Tombol Sesuaikan Harga (Admin/Owner sebelum invoice terbit) */}
                            {bolehSesuaikanTagihan && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-text-muted hover:text-primary"
                                onClick={() => {
                                  setItemDisesuaikan(item);
                                  setHargaBaruInput(String(item.harga_dipakai));
                                  setAlasanPilihan(ALASAN_PENYESUAIAN_OPTIONS[0]);
                                  setAlasanKustom("");
                                  setBukaSesuaikanHarga(true);
                                }}
                                title="Sesuaikan Harga"
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}

                            {/* Tombol Hapus Baris (Kepala Mekanik / Owner saat dikerjakan) */}
                            {bolehKelolaPengerjaan && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-text-muted hover:text-danger"
                                onClick={() => {
                                  setItemMauDihapus(item);
                                  setBukaHapusItem(true);
                                }}
                                title="Hapus Item"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ringkasan Biaya & Diskon */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Kolom Kiri: Pengaturan Diskon & Alasan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diskon & Catatan Pembayaran</CardTitle>
            <CardDescription>
              Penyesuaian diskon total untuk pelanggan sebelum invoice diterbitkan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-text">Diskon Diberikan</div>
                  <div className="text-2xl font-bold font-mono text-primary">
                    {rupiah(diskonWO)}
                  </div>
                  {wo.alasan_diskon && (
                    <div className="mt-1 text-xs text-text-muted">
                      Alasan: &ldquo;{wo.alasan_diskon}&rdquo;
                    </div>
                  )}
                </div>
                {bolehSesuaikanTagihan && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDiskonInput(diskonWO ? String(diskonWO) : "0");
                      setAlasanDiskonInput(wo.alasan_diskon ?? "");
                      setBukaAturDiskon(true);
                    }}
                  >
                    <Pencil className="mr-1.5 size-3.5" />
                    Atur Diskon
                  </Button>
                )}
              </div>
            </div>

            {/* Riwayat Pembayaran Jika Ada */}
            {invoice && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Riwayat Pembayaran
                </div>
                {invoice.payments && invoice.payments.length > 0 ? (
                  <div className="divide-y rounded-md border text-sm">
                    {invoice.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5">
                        <div>
                          <Badge variant="outline" className="mr-2 uppercase">
                            {p.metode}
                          </Badge>
                          <span className="text-xs text-text-muted">
                            {tanggal(p.created_at)}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-success">
                          +{rupiah(p.jumlah)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Belum ada pembayaran tercatat.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kolom Kanan: Rangkuman Total Tagihan */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base">Ringkasan Tagihan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal ({items.length} item)</span>
              <span className="font-mono font-medium text-text">{rupiah(subtotalTagihan)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Diskon</span>
              <span className="font-mono font-medium text-danger">
                {diskonWO > 0 ? `-${rupiah(diskonWO)}` : rupiah(0)}
              </span>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold text-text">Total Tagihan</span>
                <span className="text-2xl font-bold font-mono text-text">
                  {rupiah(totalTagihan)}
                </span>
              </div>
            </div>

            {/* Modal & Laba Kotor Khusus Owner */}
            {isOwner && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Total Modal Spare Part:</span>
                  <span className="font-mono font-medium text-text">{rupiah(totalModalWO)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-text">Estimasi Laba Kotor:</span>
                  <span className={`font-mono ${totalLabaWO < 0 ? "text-danger" : "text-success"}`}>
                    {rupiah(totalLabaWO)}
                  </span>
                </div>
              </div>
            )}

            {/* Status Terbayar & Sisa Bila Invoice Terbit */}
            {invoice && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                <div className="flex justify-between text-success">
                  <span>Sudah Dibayar</span>
                  <span className="font-mono font-semibold">{rupiah(invoice.terbayar)}</span>
                </div>
                <div className="flex justify-between font-bold text-text">
                  <span>Sisa Tagihan</span>
                  <span className="font-mono text-danger">
                    {rupiah(Math.max(0, invoice.total - invoice.terbayar))}
                  </span>
                </div>
              </div>
            )}
          </CardContent>

          {/* Footer Card: Tombol Pembayaran / Terbitkan */}
          <div className="border-t p-6 pt-3">
            {bolehCatatBayar ? (
              <Button
                className="w-full gap-2 bg-success text-white hover:bg-success/90"
                onClick={() => {
                  setJumlahBayarInput(String(invoice.total - invoice.terbayar));
                  setMetodeBayar("tunai");
                  setBukaCatatBayar(true);
                }}
              >
                <DollarSign className="size-4" />
                Catat Pembayaran
              </Button>
            ) : bolehTerbitkanInvoice ? (
              <Button
                className="w-full gap-2 bg-primary text-white hover:bg-primary-strong"
                onClick={() => setBukaTerbitkanInvoice(true)}
              >
                <Receipt className="size-4" />
                Terbitkan Invoice Resmi
              </Button>
            ) : isInvoiceTerbit && invoice.status_bayar === "lunas" ? (
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 className="size-5" />
                Tagihan Sudah Lunas
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* ================= DIALOGS ================= */}

      {/* 1. Dialog Tambah Spare Part */}
      <Dialog open={bukaTambahPart} onOpenChange={setBukaTambahPart}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Spare Part ke Tagihan</DialogTitle>
            <DialogDescription>
              Stok akan otomatis berkurang dan dicatat di riwayat stok pergerakan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel>Pilih Spare Part</FieldLabel>
              <Select value={pilihanItemId} onValueChange={setPilihanItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih spare part..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {inventoryParts.map((item) => (
                    <SelectItem key={item.id} value={item.id} disabled={item.stok <= 0}>
                      {item.nama} · Stok: {item.stok} · {rupiah(item.harga_jual)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Jumlah (Qty)</FieldLabel>
              <Input
                type="number"
                min={1}
                value={jumlahItem}
                onChange={(e) => setJumlahItem(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaTambahPart(false)} disabled={loadingAksi}>
              Batal
            </Button>
            <Button onClick={() => handleTambahItem("part")} disabled={loadingAksi}>
              {loadingAksi ? "Menyimpan..." : "Tambahkan Part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Dialog Tambah Jasa */}
      <Dialog open={bukaTambahJasa} onOpenChange={setBukaTambahJasa}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Jasa / Layanan ke Tagihan</DialogTitle>
            <DialogDescription>
              Pilih jenis pekerjaan atau servis yang dikerjakan pada kendaraan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel>Pilih Layanan Jasa</FieldLabel>
              <Select value={pilihanItemId} onValueChange={setPilihanItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jasa servis..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {inventoryJasa.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nama} · {rupiah(item.harga_jual)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Jumlah</FieldLabel>
              <Input
                type="number"
                min={1}
                value={jumlahItem}
                onChange={(e) => setJumlahItem(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaTambahJasa(false)} disabled={loadingAksi}>
              Batal
            </Button>
            <Button onClick={() => handleTambahItem("jasa")} disabled={loadingAksi}>
              {loadingAksi ? "Menyimpan..." : "Tambahkan Jasa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Dialog Sesuaikan Harga */}
      <Dialog open={bukaSesuaikanHarga} onOpenChange={setBukaSesuaikanHarga}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sesuaikan Harga Item</DialogTitle>
            <DialogDescription>
              Penyesuaian harga satuan untuk: <strong>{itemDisesuaikan?.nama_item}</strong>.
              Harga master tidak akan berubah.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border p-3 text-xs space-y-1 bg-muted/40">
              <div className="flex justify-between">
                <span className="text-text-muted">Harga Master:</span>
                <span className="font-mono font-medium">{rupiah(itemDisesuaikan?.harga_master ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Harga Dipakai Saat Ini:</span>
                <span className="font-mono font-medium">{rupiah(itemDisesuaikan?.harga_dipakai ?? 0)}</span>
              </div>
            </div>

            <Field>
              <FieldLabel>Harga Baru (Rp)</FieldLabel>
              <Input
                type="number"
                min={0}
                value={hargaBaruInput}
                onChange={(e) => setHargaBaruInput(e.target.value)}
                placeholder="0"
              />
            </Field>

            <Field>
              <FieldLabel>Alasan Penyesuaian (Wajib)</FieldLabel>
              <Select value={alasanPilihan} onValueChange={setAlasanPilihan}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih alasan..." />
                </SelectTrigger>
                <SelectContent>
                  {ALASAN_PENYESUAIAN_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {alasanPilihan === "Lainnya" && (
              <Field>
                <FieldLabel>Keterangan Alasan Lainnya</FieldLabel>
                <Input
                  value={alasanKustom}
                  onChange={(e) => setAlasanKustom(e.target.value)}
                  placeholder="Tuliskan alasan penyesuaian harga..."
                />
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaSesuaikanHarga(false)} disabled={loadingAksi}>
              Batal
            </Button>
            <Button onClick={handleSimpanPenyesuaianHarga} disabled={loadingAksi}>
              {loadingAksi ? "Menyimpan..." : "Simpan Harga"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Dialog Atur Diskon */}
      <Dialog open={bukaAturDiskon} onOpenChange={setBukaAturDiskon}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Diskon Total Work Order</DialogTitle>
            <DialogDescription>
              Subtotal tagihan: {rupiah(subtotalTagihan)}. Diskon tidak boleh melebihi subtotal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel>Nominal Diskon (Rp)</FieldLabel>
              <Input
                type="number"
                min={0}
                max={subtotalTagihan}
                value={diskonInput}
                onChange={(e) => setDiskonInput(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Alasan Diskon (Wajib jika ada diskon)</FieldLabel>
              <Input
                value={alasanDiskonInput}
                onChange={(e) => setAlasanDiskonInput(e.target.value)}
                placeholder="Contoh: Diskon pelanggan setia / Promo akhir pekan"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaAturDiskon(false)} disabled={loadingAksi}>
              Batal
            </Button>
            <Button onClick={handleSimpanDiskon} disabled={loadingAksi}>
              {loadingAksi ? "Menyimpan..." : "Simpan Diskon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Dialog Terbitkan Invoice */}
      <Dialog open={bukaTerbitkanInvoice} onOpenChange={setBukaTerbitkanInvoice}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Terbitkan Invoice</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menerbitkan invoice resmi untuk Work Order ini?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-text-muted">Total Tagihan:</span>
              <span className="font-mono font-bold text-text">{rupiah(totalTagihan)}</span>
            </div>
            <div className="text-xs text-warning flex items-center gap-1.5 pt-1">
              <AlertTriangle className="size-4 shrink-0" />
              Setelah invoice diterbitkan, rincian tagihan akan terkunci permanen.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaTerbitkanInvoice(false)} disabled={loadingAksi}>
              Batal
            </Button>
            <Button onClick={handleTerbitkanInvoice} disabled={loadingAksi} className="bg-primary hover:bg-primary-strong text-white">
              {loadingAksi ? "Menerbitkan..." : "Ya, Terbitkan Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Dialog Catat Pembayaran */}
      <Dialog open={bukaCatatBayar} onOpenChange={setBukaCatatBayar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Invoice</DialogTitle>
            <DialogDescription>
              Invoice: <strong>{invoice?.nomor}</strong> · Sisa Tagihan:{" "}
              <strong>{rupiah((invoice?.total ?? 0) - (invoice?.terbayar ?? 0))}</strong>
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
                {invoice && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => setJumlahBayarInput(String(invoice.total - invoice.terbayar))}
                  >
                    Bayar Lunas ({rupiah(invoice.total - invoice.terbayar)})
                  </button>
                )}
              </div>
              <Input
                type="number"
                min={1}
                max={(invoice?.total ?? 0) - (invoice?.terbayar ?? 0)}
                value={jumlahBayarInput}
                onChange={(e) => setJumlahBayarInput(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaCatatBayar(false)} disabled={loadingAksi}>
              Batal
            </Button>
            <Button onClick={handleCatatPembayaran} disabled={loadingAksi} className="bg-success hover:bg-success/90 text-white">
              {loadingAksi ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Dialog Konfirmasi Hapus Item */}
      <Dialog open={bukaHapusItem} onOpenChange={setBukaHapusItem}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Item Tagihan?</DialogTitle>
            <DialogDescription>
              Item <strong>{itemMauDihapus?.nama_item}</strong> akan dihapus dari tagihan.
              {itemMauDihapus?.jenis === "part" &&
                " Stok spare part akan dikembalikan otomatis."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBukaHapusItem(false)} disabled={loadingAksi}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleHapusItem} disabled={loadingAksi}>
              {loadingAksi ? "Menghapus..." : "Hapus Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
