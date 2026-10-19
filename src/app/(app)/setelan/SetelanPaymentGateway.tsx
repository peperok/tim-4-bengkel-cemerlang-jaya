"use client";

import { useState } from "react";
import { Check, Copy, Globe, Key, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tanggal } from "@/lib/format";
import type { Tables } from "@/types/database";

interface SetelanMayarProps {
  terhubung: boolean;
  modeSandbox: boolean;
  webhookUrl: string;
  logs: Tables<"mayar_webhook_log">[];
}

export function SetelanPaymentGateway({
  terhubung,
  modeSandbox,
  webhookUrl,
  logs,
}: SetelanMayarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success("URL webhook berhasil disalin ke clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin URL webhook");
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-text">Payment Gateway (Mayar)</CardTitle>
            <CardDescription>
              Konfigurasi pembayaran online via Mayar Headless API V2 dan pemantauan riwayat webhook.
            </CardDescription>
          </div>
          <Badge
            variant={terhubung ? "default" : "outline"}
            className={
              terhubung
                ? "bg-success text-white hover:bg-success"
                : "border-danger text-danger"
            }
          >
            {terhubung ? (
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5" /> Terhubung
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ShieldAlert className="size-3.5" /> Belum Terhubung
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Koneksi & Environment */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              <Key className="size-4" /> Status Kredensial API
            </div>
            <div className="mt-2 text-sm font-medium text-text">
              {terhubung ? (
                <span className="text-success font-semibold">Tersedia di server (.env)</span>
              ) : (
                <span className="text-danger font-semibold">MAYAR_API_KEY belum disetel</span>
              )}
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Kunci API disimpan dengan aman di server dan tidak pernah ditampilkan ke browser.
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              <Globe className="size-4" /> Mode Lingkungan
            </div>
            <div className="mt-2 text-sm font-medium text-text">
              <Badge variant="outline" className={modeSandbox ? "border-amber-500 text-amber-500 font-semibold" : "border-primary text-primary"}>
                {modeSandbox ? "Sandbox (Uji Coba)" : "Production (Tayang)"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {modeSandbox
                ? "Transaksi disimulasikan menggunakan Mayar Sandbox."
                : "Menggunakan sistem transaksi nyata Mayar."}
            </p>
          </div>
        </div>

        {/* URL Webhook */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            URL Webhook Mayar
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs text-text select-all">
              {webhookUrl}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyWebhook}
              className="gap-1.5 shrink-0"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              {copied ? "Tersalin" : "Salin URL"}
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Salin tautan ini dan pasang pada menu <strong>Integrasi &gt; Webhook</strong> di dashboard Mayar Anda.
          </p>
        </div>

        {/* 10 Baris Terakhir Log Webhook */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Riwayat Webhook Terbaru (10 Baris Terakhir)
            </div>
          </div>

          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[140px] text-xs">Waktu</TableHead>
                  <TableHead className="text-xs">Event</TableHead>
                  <TableHead className="text-xs">ID Invoice Mayar</TableHead>
                  <TableHead className="w-[90px] text-center text-xs">Status</TableHead>
                  <TableHead className="text-xs">Catatan Pemeriksaan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-text-muted">
                      Belum ada pesan webhook yang diterima.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-text-muted whitespace-nowrap">
                        {tanggal(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-text">{log.event}</TableCell>
                      <TableCell className="font-mono text-text-body">
                        {log.mayar_invoice_id || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            log.status_proses === "sukses"
                              ? "border-success text-success"
                              : log.status_proses === "abaikan"
                              ? "border-warning text-warning"
                              : "border-danger text-danger"
                          }
                        >
                          {log.status_proses.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-text-muted max-w-[280px] truncate" title={log.catatan || ""}>
                        {log.catatan || "-"}
                      </TableCell>
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
