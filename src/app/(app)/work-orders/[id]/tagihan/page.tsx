import { notFound, redirect } from "next/navigation";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { TagihanClient } from "./TagihanClient";

export default async function TagihanWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // 1. Ambil data Work Order beserta relasi kendaraan, pelanggan, dan kepala mekanik
  const { data: wo, error: errWO } = await supabase
    .from("work_orders")
    .select(`
      *,
      customer:customers(nama, telepon),
      vehicle:vehicles(plat, merek_model, tahun),
      kepala_mekanik:profiles!work_orders_kepala_mekanik_id_fkey(nama)
    `)
    .eq("id", id)
    .maybeSingle();

  if (errWO || !wo) {
    notFound();
  }

  // Hak akses Kepala Mekanik: hanya boleh melihat WO timnya sendiri (PRD 2.3 & 6.8 D)
  if (profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id !== profil.id) {
    redirect("/work-orders");
  }

  // 2. Ambil baris tagihan (jika Owner, billing_item_costs akan terisi; jika Admin/Mekanik, disaring RLS)
  const { data: rawItems } = await supabase
    .from("billing_items")
    .select(`
      *,
      billing_item_costs(harga_modal),
      penyesuai:profiles!billing_items_disesuaikan_oleh_fkey(nama),
      penambah:profiles!billing_items_ditambah_oleh_fkey(nama)
    `)
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  // Normalisasi billing_item_costs jika berupa array atau objek
  const items = (rawItems ?? []).map((it) => {
    const rawCost = it.billing_item_costs as unknown;
    let costObj: { harga_modal: number } | null = null;
    if (Array.isArray(rawCost) && rawCost.length > 0) {
      costObj = rawCost[0] as { harga_modal: number };
    } else if (rawCost && typeof rawCost === "object" && "harga_modal" in rawCost) {
      costObj = rawCost as { harga_modal: number };
    }
    return {
      ...it,
      billing_item_costs: costObj,
    };
  });

  // 3. Ambil invoice resmi jika sudah terbit beserta riwayat pembayaran
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *,
      payments(*)
    `)
    .eq("work_order_id", id)
    .maybeSingle();

  // 4. Ambil daftar spare part dan jasa aktif untuk dialog penambahan item (hanya item aktif)
  const { data: parts } = await supabase
    .from("inventory_items")
    .select("id, kode, nama, jenis, harga_jual, stok")
    .eq("jenis", "part")
    .eq("aktif", true)
    .order("nama", { ascending: true });

  const { data: jasa } = await supabase
    .from("inventory_items")
    .select("id, kode, nama, jenis, harga_jual, stok")
    .eq("jenis", "jasa")
    .eq("aktif", true)
    .order("nama", { ascending: true });

  return (
    <div className="space-y-6">
      <TabWorkOrder id={id} />

      <TagihanClient
        wo={wo}
        items={items}
        invoice={invoice ?? null}
        inventoryParts={parts ?? []}
        inventoryJasa={jasa ?? []}
        peran={profil.peran}
        userId={profil.id}
      />
    </div>
  );
}
