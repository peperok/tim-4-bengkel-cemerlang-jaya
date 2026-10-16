-- =============================================================
-- App 4 Cemerlang Jaya Motor · Fitur B: Tagihan dan Invoice
-- PRD Bab 9.2: Fungsi Bisnis Tagihan & Invoice
-- =============================================================

-- 1. Tambah item tagihan (spare part / jasa)
-- Dipanggil oleh: Kepala Mekanik tim WO atau Owner saat status WO 'dikerjakan'
create or replace function public.tambah_item_tagihan(
  p_wo uuid,
  p_item uuid,
  p_jumlah int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_item record;
  v_harga_modal bigint := 0;
  v_billing_id uuid;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak terautentikasi atau akun nonaktif';
  end if;
  if v_peran not in ('owner', 'kepala_mekanik') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menambah item tagihan';
  end if;

  -- Periksa WO
  select * into v_wo from public.work_orders where id = p_wo;
  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Periksa hubungan tim jika Kepala Mekanik
  if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani WO ini yang boleh menambah item tagihan';
  end if;

  -- Periksa status WO harus 'dikerjakan'
  if v_wo.status <> 'dikerjakan' then
    raise exception 'Item tagihan hanya bisa ditambah saat status WO dikerjakan (status saat ini: %)', v_wo.status;
  end if;

  -- Periksa jumlah
  if coalesce(p_jumlah, 0) < 1 then
    raise exception 'Jumlah item harus minimal 1';
  end if;

  -- Kunci baris item inventory
  select * into v_item from public.inventory_items where id = p_item for update;
  if not found then
    raise exception 'Item inventory tidak ditemukan';
  end if;
  if not v_item.aktif then
    raise exception 'Item inventory sudah tidak aktif';
  end if;

  -- Jika spare part: periksa dan kurangi stok, catat pergerakan stok
  if v_item.jenis = 'part' then
    if v_item.stok < p_jumlah then
      raise exception 'Stok % hanya %', v_item.nama, v_item.stok;
    end if;

    update public.inventory_items
    set stok = stok - p_jumlah
    where id = p_item;

    insert into public.stock_movements (
      item_id, jenis, jumlah, stok_sesudah, keterangan, work_order_id, dicatat_oleh
    ) values (
      p_item, 'keluar', -p_jumlah, v_item.stok - p_jumlah, 'Dipakai untuk WO ' || v_wo.nomor, p_wo, auth.uid()
    );

    -- Ambil harga modal spare part saat ini
    select coalesce(harga_modal, 0) into v_harga_modal
    from public.inventory_costs
    where item_id = p_item;
  else
    -- Untuk jasa: harga modal adalah 0
    v_harga_modal := 0;
  end if;

  -- Simpan ke baris tagihan
  insert into public.billing_items (
    work_order_id, item_id, nama_item, jenis, jumlah,
    harga_master, harga_dipakai, alasan_penyesuaian, ditambah_oleh
  ) values (
    p_wo, p_item, v_item.nama, v_item.jenis, p_jumlah,
    v_item.harga_jual, v_item.harga_jual, null, auth.uid()
  ) returning id into v_billing_id;

  -- Simpan ke tabel rahasia harga modal tagihan
  insert into public.billing_item_costs (
    billing_item_id, harga_modal
  ) values (
    v_billing_id, v_harga_modal
  );

  return v_billing_id;
end $$;


-- 2. Hapus item tagihan
-- Dipanggil oleh: Kepala Mekanik tim WO atau Owner saat status WO 'dikerjakan'
create or replace function public.hapus_item_tagihan(
  p_billing_item uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_bi record;
  v_wo record;
  v_item record;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak terautentikasi atau akun nonaktif';
  end if;
  if v_peran not in ('owner', 'kepala_mekanik') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menghapus item tagihan';
  end if;

  -- Kunci dan ambil baris tagihan
  select * into v_bi from public.billing_items where id = p_billing_item for update;
  if not found then
    raise exception 'Baris tagihan tidak ditemukan';
  end if;

  -- Ambil WO
  select * into v_wo from public.work_orders where id = v_bi.work_order_id;
  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Periksa hubungan tim jika Kepala Mekanik
  if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani WO ini yang boleh menghapus item tagihan';
  end if;

  -- Periksa status WO harus 'dikerjakan'
  if v_wo.status <> 'dikerjakan' then
    raise exception 'Item tagihan hanya bisa dihapus saat status WO dikerjakan (status saat ini: %)', v_wo.status;
  end if;

  -- Pastikan invoice belum terbit
  if exists (select 1 from public.invoices where work_order_id = v_bi.work_order_id) then
    raise exception 'Item tagihan tidak dapat dihapus karena invoice sudah terbit';
  end if;

  -- Jika part: kembalikan stok dan catat pergerakan stok
  if v_bi.jenis = 'part' then
    select * into v_item from public.inventory_items where id = v_bi.item_id for update;
    if found then
      update public.inventory_items
      set stok = stok + v_bi.jumlah
      where id = v_bi.item_id;

      insert into public.stock_movements (
        item_id, jenis, jumlah, stok_sesudah, keterangan, work_order_id, dicatat_oleh
      ) values (
        v_bi.item_id, 'kembali', v_bi.jumlah, v_item.stok + v_bi.jumlah,
        'Pengembalian item tagihan dari WO ' || v_wo.nomor, v_wo.id, auth.uid()
      );
    end if;
  end if;

  -- Hapus baris tagihan (billing_item_costs terhapus otomatis via on delete cascade)
  delete from public.billing_items where id = p_billing_item;
end $$;


-- 3. Sesuaikan harga item tagihan
-- Dipanggil oleh: Admin atau Owner sebelum invoice terbit
-- Mengembalikan true jika harga disesuaikan di bawah harga modal (tanpa membocorkan modal ke Admin)
create or replace function public.sesuaikan_harga_item(
  p_billing_item uuid,
  p_harga bigint,
  p_alasan text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_bi record;
  v_modal bigint := 0;
  v_di_bawah_modal boolean := false;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak terautentikasi atau akun nonaktif';
  end if;
  if v_peran not in ('owner', 'admin') then
    raise exception 'Hanya Admin atau Owner yang boleh menyesuaikan harga item';
  end if;

  -- Kunci dan ambil baris tagihan
  select * into v_bi from public.billing_items where id = p_billing_item for update;
  if not found then
    raise exception 'Baris tagihan tidak ditemukan';
  end if;

  -- Pastikan invoice belum terbit
  if exists (select 1 from public.invoices where work_order_id = v_bi.work_order_id) then
    raise exception 'Harga tidak bisa disesuaikan karena invoice sudah terbit';
  end if;

  -- Validasi alasan penyesuaian (wajib diisi)
  if p_alasan is null or trim(p_alasan) = '' then
    raise exception 'Alasan penyesuaian harga wajib diisi';
  end if;

  -- Validasi harga baru
  if p_harga is null or p_harga < 0 then
    raise exception 'Harga baru harus lebih besar atau sama dengan 0';
  end if;

  -- Periksa apakah harga di bawah modal
  select coalesce(harga_modal, 0) into v_modal
  from public.billing_item_costs
  where billing_item_id = p_billing_item;
  if not found then
    v_modal := 0;
  end if;

  v_di_bawah_modal := (p_harga < v_modal);

  -- Perbarui harga dipakai dan alasan
  update public.billing_items
  set harga_dipakai = p_harga,
      alasan_penyesuaian = trim(p_alasan),
      disesuaikan_oleh = auth.uid(),
      disesuaikan_at = now()
  where id = p_billing_item;

  return v_di_bawah_modal;
end $$;


-- 4. Atur diskon Work Order
-- Dipanggil oleh: Admin atau Owner sebelum invoice terbit
create or replace function public.atur_diskon(
  p_wo uuid,
  p_diskon bigint,
  p_alasan text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_subtotal bigint := 0;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak terautentikasi atau akun nonaktif';
  end if;
  if v_peran not in ('owner', 'admin') then
    raise exception 'Hanya Admin atau Owner yang boleh mengatur diskon';
  end if;

  -- Kunci WO
  select * into v_wo from public.work_orders where id = p_wo for update;
  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Pastikan invoice belum terbit
  if exists (select 1 from public.invoices where work_order_id = p_wo) then
    raise exception 'Diskon tidak bisa diubah karena invoice sudah terbit';
  end if;

  -- Validasi nominal diskon
  if p_diskon is null or p_diskon < 0 then
    raise exception 'Nominal diskon harus lebih besar atau sama dengan 0';
  end if;

  -- Hitung subtotal tagihan
  select coalesce(sum(jumlah * harga_dipakai), 0) into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if p_diskon > v_subtotal then
    raise exception 'Diskon tidak boleh melebihi subtotal tagihan (Rp%)', to_char(v_subtotal, 'FM999,999,999,999');
  end if;

  -- Jika ada diskon, alasan wajib diisi
  if p_diskon > 0 and (p_alasan is null or trim(p_alasan) = '') then
    raise exception 'Alasan diskon wajib diisi jika memberikan diskon';
  end if;

  -- Perbarui diskon pada work_orders
  update public.work_orders
  set diskon = p_diskon,
      alasan_diskon = case when p_diskon > 0 then trim(p_alasan) else null end
  where id = p_wo;
end $$;


-- 5. Terbitkan invoice
-- Dipanggil oleh: Admin atau Owner saat status WO 'siap_diambil'
create or replace function public.terbitkan_invoice(
  p_wo uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_subtotal bigint := 0;
  v_diskon bigint := 0;
  v_total bigint := 0;
  v_periode text;
  v_nomor_urut int;
  v_nomor_inv text;
  v_invoice_id uuid;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak terautentikasi atau akun nonaktif';
  end if;
  if v_peran not in ('owner', 'admin') then
    raise exception 'Hanya Admin atau Owner yang boleh menerbitkan invoice';
  end if;

  -- Kunci WO
  select * into v_wo from public.work_orders where id = p_wo for update;
  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Periksa status WO harus 'siap_diambil'
  if v_wo.status <> 'siap_diambil' then
    raise exception 'Invoice hanya bisa diterbitkan saat status WO siap diambil (status saat ini: %)', v_wo.status;
  end if;

  -- Pastikan belum ada invoice untuk WO ini
  if exists (select 1 from public.invoices where work_order_id = p_wo) then
    raise exception 'Invoice untuk Work Order ini sudah pernah diterbitkan';
  end if;

  -- Hitung subtotal dan diskon
  select coalesce(sum(jumlah * harga_dipakai), 0) into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if v_subtotal <= 0 then
    raise exception 'Tagihan masih kosong atau berjumlah Rp0, invoice tidak dapat diterbitkan';
  end if;

  v_diskon := coalesce(v_wo.diskon, 0);
  if v_diskon > v_subtotal then
    v_diskon := v_subtotal;
  end if;
  v_total := v_subtotal - v_diskon;

  -- Penomoran invoice otomatis tanpa ganda: format INV-YYYYMM-0001
  v_periode := to_char(now(), 'YYYYMM');
  v_nomor_urut := private.nomor_berikut('INV', v_periode);
  v_nomor_inv := 'INV-' || v_periode || '-' || lpad(v_nomor_urut::text, 4, '0');

  -- Buat baris invoice
  insert into public.invoices (
    work_order_id, nomor, subtotal, diskon, total, terbayar, status_bayar, diterbitkan_oleh, diterbitkan_at
  ) values (
    p_wo, v_nomor_inv, v_subtotal, v_diskon, v_total, 0, 'belum_bayar', auth.uid(), now()
  ) returning id into v_invoice_id;

  return v_invoice_id;
end $$;


-- 6. Catat pembayaran
-- Dipanggil oleh: Admin atau Owner setelah invoice terbit
create or replace function public.catat_pembayaran(
  p_invoice uuid,
  p_metode text,
  p_jumlah bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_inv record;
  v_sisa bigint;
  v_terbayar_baru bigint;
  v_status_baru text;
  v_payment_id uuid;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak terautentikasi atau akun nonaktif';
  end if;
  if v_peran not in ('owner', 'admin') then
    raise exception 'Hanya Admin atau Owner yang boleh mencatat pembayaran';
  end if;

  -- Kunci invoice
  select * into v_inv from public.invoices where id = p_invoice for update;
  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  -- Validasi metode pembayaran
  if p_metode not in ('tunai', 'transfer', 'qris') then
    raise exception 'Metode pembayaran tidak sah (pilihan: tunai, transfer, qris)';
  end if;

  -- Validasi jumlah
  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah pembayaran harus lebih dari Rp0';
  end if;

  -- Hitung sisa tagihan
  v_sisa := v_inv.total - v_inv.terbayar;
  if v_sisa <= 0 then
    raise exception 'Invoice ini sudah lunas';
  end if;
  if p_jumlah > v_sisa then
    raise exception 'Jumlah pembayaran (Rp%) melebihi sisa tagihan (Rp%)',
      to_char(p_jumlah, 'FM999,999,999,999'), to_char(v_sisa, 'FM999,999,999,999');
  end if;

  -- Catat baris pembayaran
  insert into public.payments (
    invoice_id, metode, jumlah, dicatat_oleh
  ) values (
    p_invoice, p_metode, p_jumlah, auth.uid()
  ) returning id into v_payment_id;

  -- Perbarui akumulasi terbayar dan status pembayaran invoice
  v_terbayar_baru := v_inv.terbayar + p_jumlah;
  if v_terbayar_baru >= v_inv.total then
    v_status_baru := 'lunas';
  else
    v_status_baru := 'sebagian';
  end if;

  update public.invoices
  set terbayar = v_terbayar_baru,
      status_bayar = v_status_baru
  where id = p_invoice;

  return v_payment_id;
end $$;


-- ---------- Hak eksekusi fungsi ----------
revoke all on function public.tambah_item_tagihan(uuid, uuid, int) from public, anon;
grant execute on function public.tambah_item_tagihan(uuid, uuid, int) to authenticated;

revoke all on function public.hapus_item_tagihan(uuid) from public, anon;
grant execute on function public.hapus_item_tagihan(uuid) to authenticated;

revoke all on function public.sesuaikan_harga_item(uuid, bigint, text) from public, anon;
grant execute on function public.sesuaikan_harga_item(uuid, bigint, text) to authenticated;

revoke all on function public.atur_diskon(uuid, bigint, text) from public, anon;
grant execute on function public.atur_diskon(uuid, bigint, text) to authenticated;

revoke all on function public.terbitkan_invoice(uuid) from public, anon;
grant execute on function public.terbitkan_invoice(uuid) to authenticated;

revoke all on function public.catat_pembayaran(uuid, text, bigint) from public, anon;
grant execute on function public.catat_pembayaran(uuid, text, bigint) to authenticated;
