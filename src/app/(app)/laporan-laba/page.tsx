import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, DollarSign, Package, Percent, TrendingUp, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

export default async function HalamanLaporanLaba({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>;
}) {
  const profil = await ambilProfilSaya();
  // PRD 6.12 & PRD 4: Hanya untuk Owner
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { dari: paramDari, sampai: paramSampai } = await searchParams;

  // Tanggal default: bulan berjalan (1 sampai akhir bulan ini)
  const sekarang = new Date();
  const y = sekarang.getFullYear();
  const m = String(sekarang.getMonth() + 1).padStart(2, "0");
  const d = String(sekarang.getDate()).padStart(2, "0");
  const awalBulan = `${y}-${m}-01`;
  const akhirBulan = new Date(y, sekarang.getMonth() + 1, 0).toISOString().split("T")[0];

  const dari = paramDari || awalBulan;
  const sampai = paramSampai || akhirBulan;

  const supabase = await createClient();

  // Angka dihitung oleh fungsi laporan_laba(p_dari, p_sampai) di database (PRD 6.12)
  const { data: laporan, error } = await supabase.rpc("laporan_laba", {
    p_dari: dari,
    p_sampai: sampai,
  });

  if (error) {
    console.error("Gagal mengambil laporan laba:", error);
  }

  const daftar = laporan ?? [];

  // Hitung total ringkasan dari hasil kueri periode terpilih
  const totalPendapatan = daftar.reduce((acc, row) => acc + (row.pendapatan || 0), 0);
  const totalModal = daftar.reduce((acc, row) => acc + (row.modal || 0), 0);
  const totalLaba = daftar.reduce((acc, row) => acc + (row.laba || 0), 0);
  const marginPersen = totalPendapatan > 0 ? Math.round((totalLaba / totalPendapatan) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Laporan Laba</h1>
          <p className="text-sm text-text-muted">
            Laba kotor per Work Order terbitan invoice pada periode {tanggal(dari)} – {tanggal(sampai)}
          </p>
        </div>
      </div>

      {/* Penyaring Periode */}
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-end gap-3 px-6 py-0">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="input-dari" className="text-xs font-medium text-text-muted">
                Tanggal Dari
              </label>
              <Input
                id="input-dari"
                name="dari"
                type="date"
                defaultValue={dari}
                className="w-40"
                required
              />
            </div>
            <div>
              <label htmlFor="input-sampai" className="text-xs font-medium text-text-muted">
                Tanggal Sampai
              </label>
              <Input
                id="input-sampai"
                name="sampai"
                type="date"
                defaultValue={sampai}
                className="w-40"
                required
              />
            </div>
            <Button type="submit" variant="default" className="gap-2">
              <Filter className="size-4" />
              Saring
            </Button>
          </form>

          {/* Tombol Pintas Periode */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`?dari=${awalBulan}&sampai=${akhirBulan}`}>
              <Button
                variant={dari === awalBulan && sampai === akhirBulan ? "secondary" : "outline"}
                size="sm"
              >
                Bulan Ini
              </Button>
            </Link>
            {(() => {
              const dLalu = new Date(y, sekarang.getMonth() - 1, 1);
              const yLalu = dLalu.getFullYear();
              const mLalu = String(dLalu.getMonth() + 1).padStart(2, "0");
              const awalLalu = `${yLalu}-${mLalu}-01`;
              const akhirLalu = new Date(yLalu, dLalu.getMonth() + 1, 0).toISOString().split("T")[0];
              return (
                <Link href={`?dari=${awalLalu}&sampai=${akhirLalu}`}>
                  <Button
                    variant={dari === awalLalu && sampai === akhirLalu ? "secondary" : "outline"}
                    size="sm"
                  >
                    Bulan Lalu
                  </Button>
                </Link>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Kartu Ringkasan KPI (PRD 6.12) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Pendapatan</CardTitle>
            <DollarSign className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text">{rupiah(totalPendapatan)}</div>
            <p className="text-xs text-text-muted mt-1">{daftar.length} invoice terbit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Modal Spare Part</CardTitle>
            <Package className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text">{rupiah(totalModal)}</div>
            <p className="text-xs text-text-muted mt-1">Total harga modal part</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Laba Kotor</CardTitle>
            <TrendingUp className={`size-4 ${totalLaba >= 0 ? "text-success" : "text-danger"}`} />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalLaba >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {rupiah(totalLaba)}
            </div>
            <p className="text-xs text-text-muted mt-1">Pendapatan dikurangi modal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Margin Laba</CardTitle>
            <Percent className="size-4 text-primary-strong" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                marginPersen >= 0 ? "text-text" : "text-danger"
              }`}
            >
              {marginPersen}%
            </div>
            <p className="text-xs text-text-muted mt-1">Rasio laba kotor terhadap pendapatan</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Rincian per WO (PRD 6.12) */}
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. WO</TableHead>
                <TableHead>No. Invoice</TableHead>
                <TableHead>Tanggal Invoice</TableHead>
                <TableHead>Plat</TableHead>
                <TableHead className="text-right">Pendapatan</TableHead>
                <TableHead className="text-right">Modal Part</TableHead>
                <TableHead className="text-right">Laba</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-text-muted">
                    Tidak ada transaksi invoice pada periode yang dipilih.
                  </TableCell>
                </TableRow>
              ) : (
                daftar.map((row) => {
                  const minus = row.laba < 0;
                  return (
                    <TableRow key={row.work_order_id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/work-orders/${row.work_order_id}`}
                          className="text-primary hover:underline"
                        >
                          {row.nomor_wo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-text-body">{row.nomor_invoice}</TableCell>
                      <TableCell className="text-text-body">{tanggal(row.tanggal)}</TableCell>
                      <TableCell className="font-medium text-text">{row.plat}</TableCell>
                      <TableCell className="text-right font-medium text-text">
                        {rupiah(row.pendapatan)}
                      </TableCell>
                      <TableCell className="text-right text-text-body">
                        {rupiah(row.modal)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          minus ? "text-danger" : "text-success"
                        }`}
                      >
                        {rupiah(row.laba)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          minus ? "text-danger" : "text-text"
                        }`}
                      >
                        {row.margin_persen}%
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
