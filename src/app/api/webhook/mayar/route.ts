import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export async function POST(request: Request) {
  // 4. Klien Supabase dengan SUPABASE_SECRET_KEY hanya dibuat di file ini, tanpa NEXT_PUBLIC_
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    // 5. Selalu balas 200 dengan cepat
    return NextResponse.json({
      status: "ok",
      pesan: "Konfigurasi server webhook belum lengkap.",
    });
  }

  const adminClient = createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Baca payload webhook
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({
      status: "ok",
      pesan: "Payload JSON tidak valid.",
    });
  }

  const payload = (rawBody && typeof rawBody === "object" ? rawBody : {}) as Record<string, unknown>;
  const event = typeof payload.event === "string" ? payload.event : "unknown";
  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;

  // Ekstrak ID invoice Mayar dari payload
  const mayarInvoiceId =
    typeof data.id === "string"
      ? data.id
      : typeof data.invoiceId === "string"
        ? data.invoiceId
        : typeof payload.id === "string"
          ? payload.id
          : null;

  // 1. Catat setiap pesan ke mayar_webhook_log di awal
  let logId: string | null = null;
  try {
    const { data: insertedLog } = await adminClient
      .from("mayar_webhook_log")
      .insert({
        event,
        mayar_invoice_id: mayarInvoiceId,
        payload: payload as unknown as Json,
        status_proses: "sukses",
        catatan: "Pesan webhook diterima, memulai verifikasi.",
      })
      .select("id")
      .single();

    if (insertedLog) {
      logId = insertedLog.id;
    }
  } catch (err: unknown) {
    console.error("Gagal mencatat log webhook awal:", err);
  }

  // Helper untuk memperbarui hasil pemeriksaan di log
  const updateLog = async (
    statusProses: "sukses" | "abaikan" | "gagal",
    catatan: string,
  ) => {
    if (!logId) return;
    try {
      await adminClient
        .from("mayar_webhook_log")
        .update({
          status_proses: statusProses,
          catatan,
        })
        .eq("id", logId);
    } catch (err: unknown) {
      console.error("Gagal memperbarui log webhook:", err);
    }
  };

  // 2. Jangan percaya isi pesan. Ambil id tagihan, lalu tanya ulang detailnya ke Mayar dengan MAYAR_API_KEY
  if (!mayarInvoiceId) {
    await updateLog("abaikan", "ID invoice Mayar tidak ditemukan dalam payload webhook.");
    return NextResponse.json({
      status: "ok",
      pesan: "ID invoice tidak ditemukan.",
    });
  }

  const mayarApiKey = process.env.MAYAR_API_KEY;
  const mayarBaseUrl = (process.env.MAYAR_BASE_URL || "https://api.mayar.club").replace(/\/+$/, "");

  if (!mayarApiKey) {
    await updateLog("gagal", "MAYAR_API_KEY belum disetel di server.");
    return NextResponse.json({
      status: "ok",
      pesan: "MAYAR_API_KEY belum disetel.",
    });
  }

  // Panggil endpoint invoice detail Mayar V2
  let mayarDetailData: Record<string, unknown> | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const mayarRes = await fetch(`${mayarBaseUrl}/hl/v2/invoices/${encodeURIComponent(mayarInvoiceId)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mayarApiKey}`,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!mayarRes.ok) {
      await updateLog("gagal", `Gagal menanyakan detail invoice ke Mayar (HTTP ${mayarRes.status}).`);
      return NextResponse.json({
        status: "ok",
        pesan: "Gagal memverifikasi ke Mayar.",
      });
    }

    const jsonRes = await mayarRes.json();
    mayarDetailData = (jsonRes?.data && typeof jsonRes.data === "object" ? jsonRes.data : jsonRes) as Record<string, unknown>;
  } catch {
    await updateLog("gagal", "Koneksi ke Mayar saat verifikasi detail mengalami kegagalan / timeout.");
    return NextResponse.json({
      status: "ok",
      pesan: "Koneksi ke Mayar gagal.",
    });
  }

  // 3. Periksa status pembayaran dari data resmi Mayar
  const statusMayar = String(
    mayarDetailData?.status ||
      mayarDetailData?.transactionStatus ||
      "",
  ).toLowerCase();

  const isPaid = statusMayar === "paid" || statusMayar === "success" || statusMayar === "settled";

  if (!isPaid) {
    await updateLog("abaikan", `Status invoice di Mayar bukan lunas (status saat ini: ${statusMayar || "tidak diketahui"}).`);
    return NextResponse.json({
      status: "ok",
      pesan: "Tagihan belum berstatus dibayar di Mayar.",
    });
  }

  // Cek apakah invoice ada di database invoices kita
  const { data: invoiceDb, error: invError } = await adminClient
    .from("invoices")
    .select("id, mayar_invoice_id, mayar_jumlah, total, terbayar, status_bayar")
    .eq("mayar_invoice_id", mayarInvoiceId)
    .single();

  if (invError || !invoiceDb) {
    await updateLog("gagal", `Tagihan dengan mayar_invoice_id '${mayarInvoiceId}' tidak ditemukan di tabel invoices.`);
    return NextResponse.json({
      status: "ok",
      pesan: "Invoice tidak ditemukan di database.",
    });
  }

  // Cek kecocokan jumlah tagihan
  const amountMayar = Number(
    mayarDetailData?.amount ||
      mayarDetailData?.total ||
      mayarDetailData?.grandTotal ||
      0,
  );

  if (invoiceDb.mayar_jumlah && amountMayar > 0 && Number(invoiceDb.mayar_jumlah) !== amountMayar) {
    await updateLog(
      "gagal",
      `Jumlah bayar dari Mayar (Rp${amountMayar}) berbeda dengan mayar_jumlah di database (Rp${invoiceDb.mayar_jumlah}).`,
    );
    return NextResponse.json({
      status: "ok",
      pesan: "Jumlah pembayaran tidak sesuai.",
    });
  }

  // Panggil database function tandai_lunas_mayar dengan secret key (service_role)
  try {
    const { error: rpcError } = await adminClient.rpc("tandai_lunas_mayar", {
      p_mayar_invoice_id: mayarInvoiceId,
      p_payload: payload as unknown as Json,
    });

    if (rpcError) {
      await updateLog("gagal", `Gagal memanggil tandai_lunas_mayar: ${rpcError.message}`);
      return NextResponse.json({
        status: "ok",
        pesan: "Gagal menandai lunas invoice.",
      });
    }

    await updateLog("sukses", `Pembayaran invoice ${mayarInvoiceId} terverifikasi lunas dan berhasil dicatat.`);
  } catch {
    await updateLog("gagal", "Terjadi kesalahan saat memanggil fungsi tandai_lunas_mayar.");
    return NextResponse.json({
      status: "ok",
      pesan: "Kesalahan internal pada RPC tandai_lunas_mayar.",
    });
  }

  // 5. Selalu balas 200 dengan cepat
  return NextResponse.json({
    status: "ok",
    pesan: "Webhook berhasil diproses.",
  });
}
