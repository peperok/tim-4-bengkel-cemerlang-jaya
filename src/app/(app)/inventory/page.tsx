import Link from "next/link";
import { Search } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormSparePart, type SparePartItem } from "./FormSparePart";
import { FormJasa, type JasaItem } from "./FormJasa";
import { DialogStokMasuk } from "./DialogStokMasuk";
import { DialogSesuaikanStok } from "./DialogSesuaikanStok";

const PER_HALAMAN = 20;

export default async function HalamanInventory({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    status?: string;
    jenis?: string;
    hal?: string;
  }>;
}) {
  const { tab = "part", q = "", status = "semua", jenis = "semua", hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  const isOwner = profil.peran === "owner";
  const bolehKelola = profil.peran === "admin" || profil.peran === "owner";

  // Tab 1: Spare Part
  if (tab === "part") {
    // PRD 6.4 & 10.2: Kolom harga_modal dari inventory_costs hanya di-query bila pemanggil adalah Owner
    const kolomPart = isOwner
      ? "id, kode, nama, stok, stok_minimum, harga_jual, inventory_costs(harga_modal)"
      : "id, kode, nama, stok, stok_minimum, harga_jual";

    let kueriPart = supabase
      .from("inventory_items")
      .select(kolomPart, { count: "exact" })
      .eq("jenis", "part");

    if (cari) {
      kueriPart = kueriPart.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
    }

    if (status === "habis") {
      kueriPart = kueriPart.eq("stok", 0);
    }

    const { data: rawParts, count, error } = await kueriPart
      .order("nama")
      .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

    // Filter status menipis dan aman dilakukan di client memory jika PostgREST tidak mendukung perbandingan antar-kolom stok vs stok_minimum
    let parts: SparePartItem[] = (rawParts as unknown as SparePartItem[]) ?? [];

    if (status === "menipis") {
      parts = parts.filter((p) => p.stok > 0 && p.stok <= p.stok_minimum);
    } else if (status === "aman") {
      parts = parts.filter((p) => p.stok > p.stok_minimum);
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-text">Inventory</h1>
          {bolehKelola && <FormSparePart isOwner={isOwner} />}
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-border">
          <Link
            href="/inventory?tab=part"
            className="border-b-2 border-primary px-4 py-2 font-medium text-primary"
          >
            Spare Part
          </Link>
          <Link
            href="/inventory?tab=jasa"
            className="border-b-2 border-transparent px-4 py-2 text-muted-foreground hover:text-text"
          >
            Jasa
          </Link>
          <Link
            href="/inventory?tab=riwayat"
            className="border-b-2 border-transparent px-4 py-2 text-muted-foreground hover:text-text"
          >
            Riwayat Stok
          </Link>
        </div>

        {/* Filter Pencarian dan Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex w-full max-w-sm gap-2" role="search">
            <input type="hidden" name="tab" value="part" />
            <input type="hidden" name="status" value={status} />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari SKU atau nama spare part"
              aria-label="Cari spare part"
            />
            <Button type="submit" variant="outline">
              <Search className="size-4" />
              Cari
            </Button>
          </form>

          {/* Penyaring Status */}
          <div className="flex flex-wrap gap-1.5 text-sm">
            {[
              { id: "semua", label: "Semua" },
              { id: "habis", label: "Habis" },
              { id: "menipis", label: "Menipis" },
              { id: "aman", label: "Aman" },
            ].map((st) => (
              <Link
                key={st.id}
                href={`/inventory?tab=part&status=${st.id}${cari ? `&q=${encodeURIComponent(cari)}` : ""}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  status === st.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {st.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Tabel Spare Part */}
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">SKU</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                {isOwner && <TableHead className="text-right">Harga Modal</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 8 : 7}
                    className="py-10 text-center text-danger"
                  >
                    Data spare part gagal dimuat. Muat ulang halaman ini.
                  </TableCell>
                </TableRow>
              )}
              {!error && parts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 8 : 7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {cari ? `Tidak ada spare part yang cocok dengan "${cari}".` : "Belum ada spare part."}
                  </TableCell>
                </TableRow>
              )}
              {parts.map((p) => {
                const habis = p.stok === 0;
                const menipis = p.stok > 0 && p.stok <= p.stok_minimum;
                const modal = p.inventory_costs?.harga_modal;

                return (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 font-mono text-xs">{p.kode}</TableCell>
                    <TableCell className="font-medium text-text">
                      {p.nama}
                      {isOwner && modal === undefined && (
                        <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          Modal belum diisi
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {p.stok}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {p.stok_minimum}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rupiah(p.harga_jual)}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {modal !== undefined && modal !== null ? rupiah(modal) : "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      {habis ? (
                        <Badge variant="destructive">Habis</Badge>
                      ) : menipis ? (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-600">Menipis</Badge>
                      ) : (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Aman</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {bolehKelola && (
                          <DialogStokMasuk
                            itemId={p.id}
                            namaItem={p.nama}
                            stokSekarang={p.stok}
                          />
                        )}
                        {isOwner && (
                          <>
                            <DialogSesuaikanStok
                              itemId={p.id}
                              namaItem={p.nama}
                              stokSekarang={p.stok}
                            />
                            <FormSparePart item={p} isOwner={isOwner} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <Paginasi
          halaman={halaman}
          totalBaris={count ?? 0}
          perHalaman={PER_HALAMAN}
          params={{ tab: "part", q: cari, status }}
        />
      </div>
    );
  }

  // Tab 2: Jasa
  if (tab === "jasa") {
    let kueriJasa = supabase
      .from("inventory_items")
      .select("id, kode, nama, harga_jual", { count: "exact" })
      .eq("jenis", "jasa");

    if (cari) {
      kueriJasa = kueriJasa.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
    }

    const { data: jasaList, count, error } = await kueriJasa
      .order("nama")
      .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

    const items: JasaItem[] = (jasaList as unknown as JasaItem[]) ?? [];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-text">Inventory</h1>
          {bolehKelola && <FormJasa />}
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-border">
          <Link
            href="/inventory?tab=part"
            className="border-b-2 border-transparent px-4 py-2 text-muted-foreground hover:text-text"
          >
            Spare Part
          </Link>
          <Link
            href="/inventory?tab=jasa"
            className="border-b-2 border-primary px-4 py-2 font-medium text-primary"
          >
            Jasa
          </Link>
          <Link
            href="/inventory?tab=riwayat"
            className="border-b-2 border-transparent px-4 py-2 text-muted-foreground hover:text-text"
          >
            Riwayat Stok
          </Link>
        </div>

        {/* Filter Pencarian Jasa */}
        <div className="flex max-w-sm gap-2">
          <form className="flex w-full gap-2" role="search">
            <input type="hidden" name="tab" value="jasa" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari kode atau nama jasa"
              aria-label="Cari jasa"
            />
            <Button type="submit" variant="outline">
              <Search className="size-4" />
              Cari
            </Button>
          </form>
        </div>

        {/* Tabel Jasa */}
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Kode</TableHead>
                <TableHead>Nama Jasa</TableHead>
                <TableHead className="text-right">Tarif</TableHead>
                {bolehKelola && <TableHead className="pr-4 text-right">Tindakan</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-danger">
                    Data jasa gagal dimuat. Muat ulang halaman ini.
                  </TableCell>
                </TableRow>
              )}
              {!error && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    {cari ? `Tidak ada jasa yang cocok dengan "${cari}".` : "Belum ada data jasa."}
                  </TableCell>
                </TableRow>
              )}
              {items.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="pl-4 font-mono text-xs">{j.kode}</TableCell>
                  <TableCell className="font-medium text-text">{j.nama}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {rupiah(j.harga_jual)}
                  </TableCell>
                  {bolehKelola && (
                    <TableCell className="pr-4 text-right">
                      <FormJasa jasa={j} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Paginasi
          halaman={halaman}
          totalBaris={count ?? 0}
          perHalaman={PER_HALAMAN}
          params={{ tab: "jasa", q: cari }}
        />
      </div>
    );
  }

  // Tab 3: Riwayat Stok
  let kueriRiwayat = supabase
    .from("stock_movements")
    .select(
      "id, created_at, jenis, jumlah, stok_sesudah, keterangan, inventory_items(id, kode, nama), work_orders(id, nomor), profiles(id, nama)",
      { count: "exact" }
    );

  if (jenis !== "semua") {
    kueriRiwayat = kueriRiwayat.eq("jenis", jenis);
  }

  const { data: riwayatList, count, error } = await kueriRiwayat
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  interface RiwayatRow {
    id: number;
    created_at: string;
    jenis: "masuk" | "keluar" | "kembali" | "penyesuaian";
    jumlah: number;
    stok_sesudah: number;
    keterangan: string | null;
    inventory_items: { id: string; kode: string; nama: string } | null;
    work_orders: { id: string; nomor: string } | null;
    profiles: { id: string; nama: string } | null;
  }

  const riwayat: RiwayatRow[] = (riwayatList as unknown as RiwayatRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">Inventory</h1>
      </div>

      {/* Tab Navigasi */}
      <div className="flex border-b border-border">
        <Link
          href="/inventory?tab=part"
          className="border-b-2 border-transparent px-4 py-2 text-muted-foreground hover:text-text"
        >
          Spare Part
        </Link>
        <Link
          href="/inventory?tab=jasa"
          className="border-b-2 border-transparent px-4 py-2 text-muted-foreground hover:text-text"
        >
          Jasa
        </Link>
        <Link
          href="/inventory?tab=riwayat"
          className="border-b-2 border-primary px-4 py-2 font-medium text-primary"
        >
          Riwayat Stok
        </Link>
      </div>

      {/* Filter Jenis Riwayat */}
      <div className="flex flex-wrap gap-1.5 text-sm">
        {[
          { id: "semua", label: "Semua" },
          { id: "masuk", label: "Masuk" },
          { id: "keluar", label: "Keluar" },
          { id: "penyesuaian", label: "Penyesuaian" },
          { id: "kembali", label: "Kembali" },
        ].map((j) => (
          <Link
            key={j.id}
            href={`/inventory?tab=riwayat&jenis=${j.id}`}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              jenis === j.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {j.label}
          </Link>
        ))}
      </div>

      {/* Tabel Riwayat Stok */}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tanggal</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead className="text-right">Perubahan</TableHead>
              <TableHead className="text-right">Stok Akhir</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>No. WO</TableHead>
              <TableHead className="pr-4">Dicatat Oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-danger">
                  Riwayat stok gagal dimuat. Muat ulang halaman ini.
                </TableCell>
              </TableRow>
            )}
            {!error && riwayat.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Belum ada catatan riwayat stok.
                </TableCell>
              </TableRow>
            )}
            {riwayat.map((r) => {
              const warnaBadge =
                r.jenis === "masuk"
                  ? "bg-emerald-600 text-white"
                  : r.jenis === "keluar"
                    ? "bg-blue-600 text-white"
                    : r.jenis === "penyesuaian"
                      ? "bg-purple-600 text-white"
                      : "bg-amber-600 text-white";

              return (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 text-xs tabular-nums text-muted-foreground">
                    {tanggal(r.created_at)}
                  </TableCell>
                  <TableCell className="font-medium text-text">
                    {r.inventory_items ? `${r.inventory_items.nama} (${r.inventory_items.kode})` : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={warnaBadge}>
                      {r.jenis.charAt(0).toUpperCase() + r.jenis.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${
                      r.jumlah > 0 ? "text-success" : r.jumlah < 0 ? "text-danger" : "text-muted-foreground"
                    }`}
                  >
                    {r.jumlah > 0 ? `+${r.jumlah}` : r.jumlah}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {r.stok_sesudah}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {r.keterangan || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.work_orders ? (
                      <Link
                        href={`/work-orders/${r.work_orders.id}`}
                        className="text-primary hover:underline"
                      >
                        {r.work_orders.nomor}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-xs text-muted-foreground">
                    {r.profiles?.nama || "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Paginasi
        halaman={halaman}
        totalBaris={count ?? 0}
        perHalaman={PER_HALAMAN}
        params={{ tab: "riwayat", jenis }}
      />
    </div>
  );
}
