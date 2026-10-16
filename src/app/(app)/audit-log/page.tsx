import Link from "next/link";
import { redirect } from "next/navigation";
import { Filter, History, RotateCcw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Paginasi } from "@/components/Paginasi";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { DetailAuditModal, type LogAuditRow } from "./DetailAuditModal";

const PER_HALAMAN = 20;

const DAFTAR_TABEL = [
  { value: "work_orders", label: "Work Order (work_orders)" },
  { value: "billing_items", label: "Item Tagihan (billing_items)" },
  { value: "billing_item_costs", label: "Modal Tagihan (billing_item_costs)" },
  { value: "inventory_items", label: "Item Inventory (inventory_items)" },
  { value: "inventory_costs", label: "Modal Inventory (inventory_costs)" },
  { value: "invoices", label: "Invoice (invoices)" },
  { value: "payments", label: "Pembayaran (payments)" },
  { value: "stock_movements", label: "Pergerakan Stok (stock_movements)" },
  { value: "profiles", label: "Akun Pengguna (profiles)" },
];

const DAFTAR_AKSI = ["INSERT", "UPDATE", "DELETE"];

function formatWaktu(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export default async function HalamanAuditLog({
  searchParams,
}: {
  searchParams: Promise<{
    tabel?: string;
    pelaku?: string;
    aksi?: string;
    dari?: string;
    sampai?: string;
    hal?: string;
  }>;
}) {
  const profil = await ambilProfilSaya();
  // PRD 6.13 & PRD 4: Hanya untuk Owner
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { tabel = "", pelaku = "", aksi = "", dari = "", sampai = "", hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);

  const supabase = await createClient();

  // Ambil daftar pengguna untuk penyaring pelaku
  const { data: daftarPengguna } = await supabase
    .from("profiles")
    .select("id, nama, role")
    .order("nama");

  const namaPelakuMap = new Map<string, string>();
  daftarPengguna?.forEach((p) => namaPelakuMap.set(p.id, p.nama));

  // Ambil data audit log (PRD 6.13: tabel terbaru di atas, 20 baris per halaman)
  let kueri = supabase
    .from("audit_logs")
    .select("id, waktu, pelaku_id, pelaku_peran, aksi, tabel, data_id, sebelum, sesudah, alasan", {
      count: "exact",
    });

  if (tabel) {
    kueri = kueri.eq("tabel", tabel);
  }
  if (pelaku) {
    kueri = kueri.eq("pelaku_id", pelaku);
  }
  if (aksi) {
    kueri = kueri.eq("aksi", aksi);
  }
  if (dari) {
    kueri = kueri.gte("waktu", `${dari}T00:00:00+07:00`);
  }
  if (sampai) {
    kueri = kueri.lte("waktu", `${sampai}T23:59:59+07:00`);
  }

  const { data: logs, count, error } = await kueri
    .order("waktu", { ascending: false })
    .order("id", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  if (error) {
    console.error("Gagal mengambil audit log:", error);
  }

  const totalBaris = count ?? 0;
  const daftarLogs = logs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-text">Audit Log</h1>
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
              <ShieldCheck className="size-3" />
              Hanya Owner
            </Badge>
          </div>
          <p className="text-sm text-text-muted">
            Catatan riwayat perubahan otomatis data bengkel. Tidak dapat diubah atau dihapus siapa pun.
          </p>
        </div>
      </div>

      {/* Panel Penyaring (PRD 6.13: penyaring tabel, pelaku, periode, aksi) */}
      <Card className="py-4">
        <CardContent className="px-6 py-0">
          <form method="GET" className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-end">
            <div>
              <label htmlFor="filter-tabel" className="text-xs font-medium text-text-muted">
                Tabel
              </label>
              <select
                id="filter-tabel"
                name="tabel"
                defaultValue={tabel}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Semua Tabel</option>
                {DAFTAR_TABEL.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-pelaku" className="text-xs font-medium text-text-muted">
                Pelaku
              </label>
              <select
                id="filter-pelaku"
                name="pelaku"
                defaultValue={pelaku}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Semua Pelaku</option>
                {daftarPengguna?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-aksi" className="text-xs font-medium text-text-muted">
                Aksi
              </label>
              <select
                id="filter-aksi"
                name="aksi"
                defaultValue={aksi}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Semua Aksi</option>
                {DAFTAR_AKSI.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-dari" className="text-xs font-medium text-text-muted">
                Dari Tanggal
              </label>
              <Input
                id="filter-dari"
                name="dari"
                type="date"
                defaultValue={dari}
                className="h-9"
              />
            </div>

            <div>
              <label htmlFor="filter-sampai" className="text-xs font-medium text-text-muted">
                Sampai Tanggal
              </label>
              <Input
                id="filter-sampai"
                name="sampai"
                type="date"
                defaultValue={sampai}
                className="h-9"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="default" className="flex-1 h-9 gap-1.5">
                <Filter className="size-3.5" />
                Saring
              </Button>
              {(tabel || pelaku || aksi || dari || sampai) && (
                <Link href="/audit-log">
                  <Button variant="outline" type="button" className="h-9 px-2.5" title="Reset filter">
                    <RotateCcw className="size-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tabel Audit Log (PRD 6.13: Waktu, Pelaku, Peran, Aksi, Data, Sebelum, Sesudah, Alasan) */}
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Waktu</TableHead>
                <TableHead>Pelaku</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead className="w-24">Aksi</TableHead>
                <TableHead>Data (Tabel & Nomor)</TableHead>
                <TableHead className="w-32">Perubahan</TableHead>
                <TableHead>Alasan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftarLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-text-muted">
                    <History className="mx-auto size-8 text-text-muted/60 mb-2" />
                    Belum ada rekaman audit log yang sesuai dengan penyaring.
                  </TableCell>
                </TableRow>
              ) : (
                daftarLogs.map((log) => {
                  const namaPelaku =
                    (log.pelaku_id && namaPelakuMap.get(log.pelaku_id)) ||
                    (log.pelaku_id ? "Pengguna" : "Sistem");

                  const logRow: LogAuditRow = {
                    ...log,
                    pelaku_nama: namaPelaku,
                  };

                  const badgeAksi =
                    log.aksi === "INSERT"
                      ? "default"
                      : log.aksi === "DELETE"
                      ? "destructive"
                      : "secondary";

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-text-muted whitespace-nowrap">
                        {formatWaktu(log.waktu)}
                      </TableCell>
                      <TableCell className="font-medium text-text text-sm">
                        {namaPelaku}
                      </TableCell>
                      <TableCell className="text-xs text-text-body">
                        {log.pelaku_peran ? (
                          <Badge variant="outline" className="capitalize text-[11px] font-normal">
                            {log.pelaku_peran.replace("_", " ")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeAksi} className="text-[11px]">
                          {log.aksi}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs font-semibold text-text">
                          {log.tabel}
                        </span>
                        {log.data_id && (
                          <span className="ml-1.5 text-xs text-text-muted font-mono">
                            ({log.data_id})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DetailAuditModal log={logRow} />
                      </TableCell>
                      <TableCell className="text-xs text-text-body max-w-xs truncate" title={log.alasan || ""}>
                        {log.alasan || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Navigasi Paginasi 20 baris per halaman */}
      <Paginasi
        halaman={halaman}
        totalBaris={totalBaris}
        perHalaman={PER_HALAMAN}
        params={{ tabel, pelaku, aksi, dari, sampai }}
      />
    </div>
  );
}
