"use client";

import { useState } from "react";
import { Eye, ArrowRight, CheckCircle2, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Json } from "@/types/database";

export interface LogAuditRow {
  id: number;
  waktu: string;
  pelaku_id: string | null;
  pelaku_nama: string;
  pelaku_peran: string | null;
  aksi: string;
  tabel: string;
  data_id: string | null;
  sebelum: Json | null;
  sesudah: Json | null;
  alasan: string | null;
}

function formatNilai(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function DetailAuditModal({ log }: { log: LogAuditRow }) {
  const [buka, setBuka] = useState(false);
  const [hanyaPerubahan, setHanyaPerubahan] = useState(true);

  const objSebelum = (typeof log.sebelum === "object" && log.sebelum !== null && !Array.isArray(log.sebelum)
    ? (log.sebelum as Record<string, unknown>)
    : null);

  const objSesudah = (typeof log.sesudah === "object" && log.sesudah !== null && !Array.isArray(log.sesudah)
    ? (log.sesudah as Record<string, unknown>)
    : null);

  // Kumpulkan seluruh kunci field dari sebelum dan sesudah
  const semuaKunci = Array.from(
    new Set([...Object.keys(objSebelum || {}), ...Object.keys(objSesudah || {})])
  ).sort();

  // Cari field yang nilainya berubah
  const kunciBerubah = semuaKunci.filter((k) => {
    const s1 = JSON.stringify(objSebelum?.[k]);
    const s2 = JSON.stringify(objSesudah?.[k]);
    return s1 !== s2;
  });

  const kunciDitampilkan = hanyaPerubahan && log.aksi === "UPDATE" && kunciBerubah.length > 0
    ? kunciBerubah
    : semuaKunci;

  const varianAksi =
    log.aksi === "INSERT"
      ? "default"
      : log.aksi === "DELETE"
      ? "destructive"
      : "secondary";

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Eye className="size-3.5" />
          Bandingkan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant={varianAksi}>{log.aksi}</Badge>
            <DialogTitle className="text-lg">
              Perubahan pada {log.tabel} ({log.data_id || `#${log.id}`})
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-muted space-y-1 pt-1">
            <div>
              <span className="font-medium text-text">Pelaku:</span> {log.pelaku_nama}{" "}
              {log.pelaku_peran && `(${log.pelaku_peran})`} ·{" "}
              <span className="font-medium text-text">Waktu:</span>{" "}
              {new Date(log.waktu).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              WIB
            </div>
            {log.alasan && (
              <div className="mt-2 rounded-md bg-muted/60 p-2 text-text">
                <span className="font-semibold text-text-muted">Alasan:</span> {log.alasan}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="perbandingan" className="mt-3">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="perbandingan">Perbandingan Nilai</TabsTrigger>
              <TabsTrigger value="mentah">JSON Mentah</TabsTrigger>
            </TabsList>

            {log.aksi === "UPDATE" && kunciBerubah.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setHanyaPerubahan(!hanyaPerubahan)}
              >
                {hanyaPerubahan ? `Tampilkan Semua (${semuaKunci.length})` : `Hanya Berubah (${kunciBerubah.length})`}
              </Button>
            )}
          </div>

          <TabsContent value="perbandingan" className="mt-3">
            {kunciDitampilkan.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                Tidak ada data kolom yang dapat dibandingkan.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-1/3">Kolom</TableHead>
                      <TableHead className="w-1/3">Nilai Sebelum</TableHead>
                      <TableHead className="w-1/3">Nilai Sesudah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kunciDitampilkan.map((k) => {
                      const vSebelum = objSebelum?.[k];
                      const vSesudah = objSesudah?.[k];
                      const berubah = JSON.stringify(vSebelum) !== JSON.stringify(vSesudah);

                      return (
                        <TableRow
                          key={k}
                          className={berubah && log.aksi === "UPDATE" ? "bg-primary-soft/20" : undefined}
                        >
                          <TableCell className="font-mono text-xs font-medium text-text">
                            {k}
                            {berubah && log.aksi === "UPDATE" && (
                              <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-text-body break-all">
                            {log.aksi === "INSERT" ? (
                              <span className="text-text-muted italic">—</span>
                            ) : berubah && log.aksi === "UPDATE" ? (
                              <span className="text-danger font-medium line-through">
                                {formatNilai(vSebelum)}
                              </span>
                            ) : (
                              formatNilai(vSebelum)
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-text-body break-all">
                            {log.aksi === "DELETE" ? (
                              <span className="text-text-muted italic">— (dihapus)</span>
                            ) : berubah && log.aksi === "UPDATE" ? (
                              <span className="text-success font-medium">
                                {formatNilai(vSesudah)}
                              </span>
                            ) : (
                              formatNilai(vSesudah)
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mentah" className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-text-muted mb-1">Sebelum:</p>
              <pre className="rounded-md bg-muted p-3 text-[11px] font-mono overflow-x-auto text-text max-h-48">
                {JSON.stringify(log.sebelum, null, 2) || "null"}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted mb-1">Sesudah:</p>
              <pre className="rounded-md bg-muted p-3 text-[11px] font-mono overflow-x-auto text-text max-h-48">
                {JSON.stringify(log.sesudah, null, 2) || "null"}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
