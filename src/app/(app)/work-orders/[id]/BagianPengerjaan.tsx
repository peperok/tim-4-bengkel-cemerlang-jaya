"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Package,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface InventoryItem {
  id: string;
  kode: string;
  nama: string;
  jenis: "part" | "jasa";
  harga_jual: number;
  stok: number;
}

interface BillingItem {
  id: string;
  item_id: string;
  nama_item: string;
  jenis: "part" | "jasa";
  jumlah: number;
  harga_dipakai: number;
}

interface BagianPengerjaanProps {
  woId: string;
  status: string;
  diagnosis: string | null;
  billingItems: BillingItem[];
  daftarInventory: InventoryItem[];
  bolehPengerjaan: boolean;
}

export function BagianPengerjaan({
  woId,
  status,
  diagnosis,
  billingItems,
  daftarInventory,
  bolehPengerjaan,
}: BagianPengerjaanProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Diagnosis
  const [diagText, setDiagText] = useState(diagnosis || "");
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagSukses, setDiagSukses] = useState(false);

  // Form Tambah Part/Jasa
  const [modeTambah, setModeTambah] = useState<"part" | "jasa" | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [jumlahItem, setJumlahItem] = useState(1);
  const [errorItem, setErrorItem] = useState<string | null>(null);

  // Diagnosis hanya bisa diisi/diubah saat 'dikerjakan' atau 'tertunda' (PRD 6.8 & 9.4)
  const bolehUbahDiagnosis =
    bolehPengerjaan && ["dikerjakan", "tertunda"].includes(status);

  // Item pengerjaan hanya bisa ditambah/dihapus saat status 'dikerjakan' (PRD 7.3 & 9.2)
  const bolehUbahItem = bolehPengerjaan && status === "dikerjakan";

  const handleSimpanDiagnosis = async () => {
    setDiagError(null);
    setDiagSukses(false);
    startTransition(async () => {
      const { error } = await supabase
        .from("work_orders")
        .update({ diagnosis: diagText.trim() || null })
        .eq("id", woId);

      if (error) {
        setDiagError(error.message);
      } else {
        setDiagSukses(true);
        router.refresh();
      }
    });
  };

  const handleTambahItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorItem(null);
    if (!selectedItemId) {
      setErrorItem("Pilih item terlebih dahulu");
      return;
    }

    startTransition(async () => {
      const { error } = await supabase.rpc("tambah_item_tagihan", {
        p_wo: woId,
        p_item: selectedItemId,
        p_jumlah: jumlahItem,
      });

      if (error) {
        setErrorItem(error.message);
      } else {
        setModeTambah(null);
        setSelectedItemId("");
        setJumlahItem(1);
        router.refresh();
      }
    });
  };

  const handleHapusItem = async (billingItemId: string) => {
    if (!confirm("Hapus item ini dari pengerjaan? Stok spare part akan dikembalikan.")) return;
    setErrorItem(null);
    startTransition(async () => {
      const { error } = await supabase.rpc("hapus_item_tagihan", {
        p_billing_item: billingItemId,
      });

      if (error) {
        setErrorItem(error.message);
      } else {
        router.refresh();
      }
    });
  };

  const partItems = daftarInventory.filter((i) => i.jenis === "part");
  const jasaItems = daftarInventory.filter((i) => i.jenis === "jasa");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Wrench className="size-5 text-primary" />
          Bagian C. Pengerjaan (Spare Part & Jasa)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Diagnosis Mekanik */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="diag" className="text-xs font-semibold uppercase text-text-muted">
              Diagnosis Teknis Mekanik
            </Label>
            {diagSukses && (
              <span className="text-xs font-medium text-success">
                ✓ Diagnosis tersimpan
              </span>
            )}
          </div>
          <Textarea
            id="diag"
            rows={2}
            value={diagText}
            disabled={!bolehUbahDiagnosis}
            onChange={(e) => setDiagText(e.target.value)}
            placeholder={
              bolehUbahDiagnosis
                ? "Tuliskan temuan atau diagnosis kerusakan mesin/komponen..."
                : "Diagnosis belum diisi"
            }
          />
          {diagError && <p className="text-xs text-destructive">{diagError}</p>}
          {bolehUbahDiagnosis && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={handleSimpanDiagnosis}
              >
                Simpan Diagnosis
              </Button>
            </div>
          )}
        </div>

        {/* Tabel Pemakaian Spare Part & Jasa */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs font-semibold uppercase text-text-muted">
              Daftar Spare Part & Jasa yang Digunakan
            </Label>
            {bolehUbahItem && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setModeTambah("part");
                    setSelectedItemId("");
                    setJumlahItem(1);
                  }}
                >
                  <Plus className="mr-1 size-3.5" />
                  + Spare Part
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setModeTambah("jasa");
                    setSelectedItemId("");
                    setJumlahItem(1);
                  }}
                >
                  <Plus className="mr-1 size-3.5" />
                  + Jasa
                </Button>
              </div>
            )}
          </div>

          {/* Form Modal Mini Tambah Item */}
          {modeTambah && (
            <form
              onSubmit={handleTambahItem}
              className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-3"
            >
              <div className="flex items-center justify-between font-semibold text-primary">
                <span>
                  {modeTambah === "part" ? "+ Tambah Spare Part" : "+ Tambah Jasa Servis"}
                </span>
                <button
                  type="button"
                  className="text-xs hover:underline"
                  onClick={() => setModeTambah(null)}
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="sm:col-span-3">
                  <Label className="text-xs">
                    Pilih {modeTambah === "part" ? "Part" : "Jasa"}
                  </Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm"
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Item --</option>
                    {(modeTambah === "part" ? partItems : jasaItems).map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.kode} · {it.nama} ({rupiah(it.harga_jual)})
                        {modeTambah === "part" ? ` [Stok: ${it.stok}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Jumlah</Label>
                  <Input
                    type="number"
                    min={1}
                    value={jumlahItem}
                    onChange={(e) => setJumlahItem(Number(e.target.value))}
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              {errorItem && <p className="text-xs text-destructive">{errorItem}</p>}

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 size-3 animate-spin" />}
                  Tambahkan ke WO
                </Button>
              </div>
            </form>
          )}

          {/* Tabel Items Terpasang */}
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Tarif / Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  {bolehUbahItem && <TableHead className="w-12 text-center"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={bolehUbahItem ? 6 : 5}
                      className="py-6 text-center text-xs text-muted-foreground"
                    >
                      Belum ada spare part atau jasa yang dicatat pada pengerjaan ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  billingItems.map((bi) => (
                    <TableRow key={bi.id}>
                      <TableCell className="capitalize text-xs font-medium text-text-muted">
                        {bi.jenis === "part" ? (
                          <span className="flex items-center gap-1">
                            <Package className="size-3.5" /> Part
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Wrench className="size-3.5" /> Jasa
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-text">{bi.nama_item}</TableCell>
                      <TableCell className="text-right">{bi.jumlah}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {rupiah(bi.harga_dipakai)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {rupiah(bi.jumlah * bi.harga_dipakai)}
                      </TableCell>
                      {bolehUbahItem && (
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Hapus ${bi.nama_item}`}
                            className="size-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => handleHapusItem(bi.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
