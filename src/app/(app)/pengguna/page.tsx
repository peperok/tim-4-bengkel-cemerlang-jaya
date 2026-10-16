import Link from "next/link";
import { Info, ShieldAlert } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormPengguna, type PenggunaItem } from "./FormPengguna";

const PER_HALAMAN = 20;

export default async function HalamanPengguna({
  searchParams,
}: {
  searchParams: Promise<{ hal?: string }>;
}) {
  const { hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);

  const profil = await ambilProfilSaya();

  // PRD 6.10 & 2.3: Menu Pengguna hanya untuk Owner
  if (profil.peran !== "owner") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-text">Pengguna</h1>
        <Card className="border-danger/30 bg-danger/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <ShieldAlert className="size-6 text-danger" />
            <CardTitle className="text-danger">Akses Dibatasi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Halaman manajemen pengguna hanya dapat diakses oleh peran <strong>Owner</strong>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  // Hanya ambil kolom yang ditampilkan: id, nama, email, role, aktif, created_at
  const { data: rawUsers, count, error } = await supabase
    .from("profiles")
    .select("id, nama, email, role, aktif, created_at", { count: "exact" })
    .order("role")
    .order("nama")
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  const users: PenggunaItem[] = (rawUsers as unknown as PenggunaItem[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Pengguna & Peran</h1>
          <p className="text-sm text-muted-foreground">
            Kelola hak akses dan peran staf bengkel Cemerlang Jaya Motor.
          </p>
        </div>
      </div>

      {/* Kotak Petunjuk Sesuai PRD 6.10 */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 py-4 text-sm text-blue-900 dark:text-blue-200">
          <Info className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-medium">Langkah Menambah Pengguna Baru (PRD 6.10):</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs opacity-90">
              <li>
                Buka Supabase Dashboard › <strong>Authentication</strong> › <strong>Users</strong> › <strong>Add user</strong> (isi email dan kata sandi sementara, centang <em>Auto Confirm User</em>).
              </li>
              <li>Akun baru akan otomatis dibuatkan profil dengan peran awal <code>kepala_mekanik</code> dan status nonaktif.</li>
              <li>Klik tombol <strong>Edit</strong> pada tabel di bawah untuk mengatur nama, peran, dan mengaktifkan akun tersebut.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Tabel Pengguna */}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead className="pr-4 text-right">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-danger">
                  Gagal memuat data pengguna. Muat ulang halaman ini.
                </TableCell>
              </TableRow>
            )}
            {!error && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Belum ada data pengguna.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => {
              const labelPeran =
                u.role === "owner"
                  ? "Owner"
                  : u.role === "admin"
                    ? "Admin"
                    : "Kepala Mekanik";

              const badgePeranClass =
                u.role === "owner"
                  ? "bg-purple-600 text-white"
                  : u.role === "admin"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-600 text-white";

              return (
                <TableRow key={u.id}>
                  <TableCell className="pl-4 font-medium text-text">
                    {u.nama}
                    {u.id === profil.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge className={badgePeranClass}>{labelPeran}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.aktif ? (
                      <Badge className="bg-emerald-600 text-white">Aktif</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Nonaktif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {tanggal(u.created_at)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <FormPengguna pengguna={u} profilSayaId={profil.id} />
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
        params={{}}
      />
    </div>
  );
}
