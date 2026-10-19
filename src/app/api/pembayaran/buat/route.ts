import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifikasi autentikasi & peran: Hanya Admin atau Owner
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau belum masuk." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, aktif")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.aktif) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan atau akun sedang nonaktif." },
        { status: 403 },
      );
    }

    if (profile.role !== "admin" && profile.role !== "owner") {
      return NextResponse.json(
        { error: "Hanya Admin atau Owner yang diizinkan membuat pembayaran Mayar." },
        { status: 403 },
      );
    }

    // 2. Terima dan validasi ID invoice
    let body: { invoice_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Format permintaan tidak valid." },
        { status: 400 },
      );
    }

    const invoiceId = body.invoice_id;
    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json(
        { error: "ID invoice wajib disertakan." },
        { status: 400 },
      );
    }

    // Ambil data invoice dari database
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, work_order_id, nomor, total, terbayar, status_bayar, mayar_link, mayar_jumlah")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice tidak ditemukan." },
        { status: 404 },
      );
    }

    // Hitung sisa tagihan dari database
    const sisaTagihan = Number(invoice.total) - Number(invoice.terbayar);

    if (invoice.status_bayar === "lunas" || sisaTagihan <= 0) {
      return NextResponse.json(
        { error: "Invoice sudah lunas, tidak dapat membuat tautan pembayaran baru." },
        { status: 400 },
      );
    }

    // Ambil data pelanggan dan item tagihan lewat relasi database
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        customer_id,
        customers (
          nama,
          email,
          telepon
        )
      `)
      .eq("id", invoice.work_order_id)
      .single();

    if (woError || !workOrder || !workOrder.customers) {
      return NextResponse.json(
        { error: "Data pelanggan untuk invoice ini tidak ditemukan." },
        { status: 404 },
      );
    }

    const customer = workOrder.customers as {
      nama: string;
      email: string | null;
      telepon: string;
    };

    if (!customer.email || customer.email.trim() === "") {
      return NextResponse.json(
        { error: "Email pelanggan kosong. Silakan lengkapi email pelanggan terlebih dahulu." },
        { status: 400 },
      );
    }

    // 3. Bila invoice sudah punya mayar_link dan mayar_jumlah sama dengan sisa tagihan, kembalikan tautan itu
    if (
      invoice.mayar_link &&
      Number(invoice.mayar_jumlah) === sisaTagihan
    ) {
      return NextResponse.json({
        tautan: invoice.mayar_link,
        mayar_invoice_id: null,
        sudah_ada: true,
      });
    }

    // 4. Bila belum ada atau jumlahnya berbeda, ambil item dan buat invoice baru di Mayar
    const { data: billingItems, error: itemsError } = await supabase
      .from("billing_items")
      .select("nama_item, jumlah, harga_dipakai")
      .eq("work_order_id", invoice.work_order_id);

    if (itemsError) {
      return NextResponse.json(
        { error: "Gagal memuat rincian item tagihan dari database." },
        { status: 500 },
      );
    }

    // Siapkan items untuk Mayar API
    // Bila terdapat pembayaran sebagian, kirim 1 baris akumulasi sisa tagihan agar total sesuai sisaTagihan
    let mayarItems: Array<{ quantity: number; rate: number; description?: string }>;

    if (Number(invoice.terbayar) > 0 || !billingItems || billingItems.length === 0) {
      mayarItems = [
        {
          quantity: 1,
          rate: sisaTagihan,
          description: `Sisa tagihan invoice ${invoice.nomor}`,
        },
      ];
    } else {
      mayarItems = billingItems.map((item) => ({
        quantity: item.jumlah,
        rate: Number(item.harga_dipakai),
        description: item.nama_item,
      }));
    }

    // Ambil konfigurasi API Mayar dari environment
    const mayarApiKey = process.env.MAYAR_API_KEY;
    const mayarBaseUrl = (process.env.MAYAR_BASE_URL || "https://api.mayar.club").replace(/\/+$/, "");

    if (!mayarApiKey) {
      return NextResponse.json(
        { error: "Konfigurasi pembayaran online Mayar belum disetel di server." },
        { status: 500 },
      );
    }

    // Format nomor telepon (minimal 10 digit angka)
    let mobilePhone = customer.telepon.replace(/\D/g, "");
    if (mobilePhone.startsWith("0")) {
      mobilePhone = "62" + mobilePhone.slice(1);
    }

    // Tentukan URL redirect setelah pembayaran selesai
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    const redirectUrl = `${appBaseUrl.replace(/\/+$/, "")}/work-orders/${invoice.work_order_id}/tagihan`;

    // 5. Kirim request ke Mayar API V2 dengan batas waktu (timeout) 10 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let mayarResponse: Response;
    try {
      mayarResponse = await fetch(`${mayarBaseUrl}/hl/v2/invoice/create`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mayarApiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          name: customer.nama,
          email: customer.email.trim(),
          mobile: mobilePhone,
          description: `Tagihan bengkel invoice ${invoice.nomor}`,
          redirectUrl,
          items: mayarItems,
        }),
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Koneksi ke layanan pembayaran Mayar melampaui batas waktu 10 detik." },
          { status: 504 },
        );
      }
      return NextResponse.json(
        { error: "Gagal terhubung ke layanan pembayaran Mayar." },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!mayarResponse.ok) {
      let pesan = "Gagal membuat invoice di Mayar.";
      try {
        const errorJson = await mayarResponse.json();
        if (errorJson?.messages && typeof errorJson.messages === "string") {
          pesan = errorJson.messages;
        } else if (errorJson?.message && typeof errorJson.message === "string") {
          pesan = errorJson.message;
        }
      } catch {
        // Abaikan parse error, pakai pesan default
      }
      return NextResponse.json({ error: pesan }, { status: mayarResponse.status });
    }

    const mayarData = await mayarResponse.json();
    const mayarInvoiceId =
      mayarData?.data?.id || mayarData?.data?.invoiceId || mayarData?.id;
    const mayarLink =
      mayarData?.data?.url ||
      mayarData?.data?.paymentUrl ||
      mayarData?.data?.link ||
      mayarData?.url;

    if (!mayarLink || !mayarInvoiceId) {
      return NextResponse.json(
        { error: "Respon dari Mayar tidak memuat tautan pembayaran yang sah." },
        { status: 502 },
      );
    }

    // Simpan id, tautan, dan jumlahnya lewat database function simpan_link_mayar
    const { error: simpanError } = await supabase.rpc("simpan_link_mayar", {
      p_invoice: invoice.id,
      p_mayar_invoice_id: String(mayarInvoiceId),
      p_mayar_link: String(mayarLink),
      p_mayar_jumlah: sisaTagihan,
    });

    if (simpanError) {
      return NextResponse.json(
        { error: `Gagal memperbarui tautan pembayaran di database: ${simpanError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tautan: mayarLink,
      mayar_invoice_id: mayarInvoiceId,
      mayar_jumlah: sisaTagihan,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server saat memproses pembayaran." },
      { status: 500 },
    );
  }
}
