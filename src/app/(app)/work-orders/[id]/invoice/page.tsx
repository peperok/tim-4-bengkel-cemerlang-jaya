import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { InvoiceClient } from "./InvoiceClient";

export default async function InvoiceWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // 1. Ambil data Work Order
  const { data: wo, error: errWO } = await supabase
    .from("work_orders")
    .select(`
      *,
      customer:customers(nama, telepon, alamat),
      vehicle:vehicles(plat, merek_model, tahun)
    `)
    .eq("id", id)
    .maybeSingle();

  if (errWO || !wo) {
    notFound();
  }

  // Hak akses Kepala Mekanik: hanya boleh melihat WO timnya (PRD 2.3)
  if (profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id !== profil.id) {
    redirect("/work-orders");
  }

  // 2. Ambil data Invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *,
      payments(*)
    `)
    .eq("work_order_id", id)
    .maybeSingle();

  // Jika invoice belum diterbitkan untuk WO ini, tampilkan pesan ramah
  if (!invoice) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link href={`/work-orders/${id}/tagihan`}>
            <ArrowLeft className="mr-1.5 size-4" />
            Kembali ke Tagihan
          </Link>
        </Button>

        <Card className="p-8 text-center">
          <CardContent className="flex flex-col items-center justify-center space-y-3 pt-6">
            <div className="rounded-full bg-muted p-4 text-text-muted">
              <FileQuestion className="size-8" />
            </div>
            <h2 className="text-xl font-bold text-text">Invoice Belum Diterbitkan</h2>
            <p className="max-w-md text-sm text-text-muted">
              Work Order <strong>{wo.nomor}</strong> belum memiliki invoice resmi.
              Invoice dapat diterbitkan oleh Admin atau Owner dari tab Tagihan saat status WO sudah Siap Diambil.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/work-orders/${id}/tagihan`}>Buka Tagihan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Ambil baris billing_items untuk rincian invoice
  const { data: items } = await supabase
    .from("billing_items")
    .select("id, nama_item, jenis, jumlah, harga_dipakai")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  // 4. Ambil setelan bengkel (kop surat & logo)
  const { data: bengkel } = await supabase
    .from("workshop_settings")
    .select("nama, alamat, telepon, logo_path")
    .eq("id", 1)
    .maybeSingle();

  const logoUrl = bengkel?.logo_path
    ? supabase.storage.from("publik").getPublicUrl(bengkel.logo_path).data.publicUrl
    : null;

  return (
    <InvoiceClient
      wo={wo}
      invoice={invoice}
      items={items ?? []}
      bengkel={{
        nama: bengkel?.nama ?? "Cemerlang Jaya Motor",
        alamat: bengkel?.alamat ?? "",
        telepon: bengkel?.telepon ?? "",
        logo_path: bengkel?.logo_path ?? null,
        logo_url: logoUrl,
      }}
      peran={profil.peran}
    />
  );
}
