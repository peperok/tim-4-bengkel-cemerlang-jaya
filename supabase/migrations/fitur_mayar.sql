-- Migrasi Fitur Mayar Payment Gateway
-- Dibuat sesuai PRD 9.2 & aturan keamanan App 4

-- 1. Tambah kolom Mayar ke tabel invoices
alter table public.invoices
  add column if not exists mayar_invoice_id text,
  add column if not exists mayar_link text,
  add column if not exists mayar_jumlah bigint,
  add column if not exists dibayar_online_at timestamptz;

-- 2. Perbarui check constraint metode pembayaran di tabel payments agar mendukung 'mayar'
alter table public.payments drop constraint if exists payments_metode_check;
alter table public.payments add constraint payments_metode_check
  check (metode in ('tunai', 'transfer', 'qris', 'mayar'));

-- 3. Tabel log webhook Mayar
create table if not exists public.mayar_webhook_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  mayar_invoice_id text,
  payload jsonb not null,
  status_proses text not null default 'sukses' check (status_proses in ('sukses', 'abaikan', 'gagal')),
  catatan text,
  created_at timestamptz not null default now()
);

-- Index untuk mempermudah pencarian log
create index if not exists idx_mayar_webhook_log_created_at on public.mayar_webhook_log (created_at desc);
create index if not exists idx_mayar_webhook_log_invoice_id on public.mayar_webhook_log (mayar_invoice_id);

-- RLS untuk mayar_webhook_log
alter table public.mayar_webhook_log enable row level security;
revoke all on public.mayar_webhook_log from anon, authenticated;

-- Hanya Owner yang boleh membaca tabel log
create policy "mayar_webhook_log_owner_baca" on public.mayar_webhook_log
  for select to authenticated
  using ((select private.peran_saya()) = 'owner');

grant select on public.mayar_webhook_log to authenticated;

-- 4. Fungsi simpan_link_mayar
-- Dipanggil oleh Admin atau Owner saat membuat payment link via API Mayar
create or replace function public.simpan_link_mayar(
  p_invoice uuid,
  p_mayar_invoice_id text,
  p_mayar_link text,
  p_mayar_jumlah bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak terautentikasi atau akun nonaktif';
  end if;
  if v_peran not in ('owner', 'admin') then
    raise exception 'Hanya Admin atau Owner yang boleh menyimpan link pembayaran Mayar';
  end if;

  -- 2. Validasi input
  if p_mayar_invoice_id is null or trim(p_mayar_invoice_id) = '' then
    raise exception 'ID invoice Mayar tidak boleh kosong';
  end if;
  if p_mayar_link is null or trim(p_mayar_link) = '' then
    raise exception 'Link pembayaran Mayar tidak boleh kosong';
  end if;
  if p_mayar_jumlah is null or p_mayar_jumlah <= 0 then
    raise exception 'Jumlah tagihan Mayar harus lebih dari Rp0';
  end if;

  -- 3. Kunci invoice dan update
  perform 1 from public.invoices where id = p_invoice for update;
  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  update public.invoices
  set
    mayar_invoice_id = p_mayar_invoice_id,
    mayar_link = p_mayar_link,
    mayar_jumlah = p_mayar_jumlah
  where id = p_invoice;
end;
$$;

revoke all on function public.simpan_link_mayar(uuid, text, text, bigint) from public, anon;
grant execute on function public.simpan_link_mayar(uuid, text, text, bigint) to authenticated;

-- 5. Fungsi tandai_lunas_mayar
-- Hanya bisa dijalankan oleh service_role (secret key backend) saat webhook Mayar diterima
create or replace function public.tandai_lunas_mayar(
  p_mayar_invoice_id text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_payment_id uuid;
  v_terbayar_baru bigint;
  v_status_baru text;
  v_jumlah_bayar bigint;
begin
  -- 1. Validasi pemanggil: Hanya service_role (secret key)
  if current_user <> 'service_role' and auth.role() <> 'service_role' then
    raise exception 'Fungsi ini hanya dapat dijalankan oleh sistem menggunakan secret key';
  end if;

  if p_mayar_invoice_id is null or trim(p_mayar_invoice_id) = '' then
    raise exception 'ID invoice Mayar tidak boleh kosong';
  end if;

  -- 2. Kunci baris invoice dengan FOR UPDATE
  select * into v_inv
  from public.invoices
  where mayar_invoice_id = p_mayar_invoice_id
  for update;

  if not found then
    -- Catat log webhook sebagai gagal menemukan invoice
    insert into public.mayar_webhook_log (event, mayar_invoice_id, payload, status_proses, catatan)
    values ('payment.received', p_mayar_invoice_id, p_payload, 'gagal', 'Invoice dengan ID Mayar tersebut tidak ditemukan');
    raise exception 'Invoice dengan ID Mayar % tidak ditemukan', p_mayar_invoice_id;
  end if;

  -- 3. Cek apakah invoice sudah lunas
  if v_inv.status_bayar = 'lunas' then
    -- Idempoten: Jangan dobel bayar, catat di log dan kembalikan null
    insert into public.mayar_webhook_log (event, mayar_invoice_id, payload, status_proses, catatan)
    values ('payment.received', p_mayar_invoice_id, p_payload, 'abaikan', 'Invoice sudah dalam status lunas sebelumnya');
    return null;
  end if;

  -- Tentukan jumlah yang dibayar (menggunakan mayar_jumlah atau sisa tagihan jika mayar_jumlah tidak tercatat)
  v_jumlah_bayar := coalesce(v_inv.mayar_jumlah, v_inv.total - v_inv.terbayar);
  if v_jumlah_bayar <= 0 then
    v_jumlah_bayar := v_inv.total - v_inv.terbayar;
  end if;

  -- 4. Catat pembayaran sebesar mayar_jumlah dengan metode 'mayar'
  insert into public.payments (
    invoice_id,
    metode,
    jumlah,
    dicatat_oleh
  ) values (
    v_inv.id,
    'mayar',
    v_jumlah_bayar,
    null
  ) returning id into v_payment_id;

  -- 5. Perbarui status invoice dan waktu dibayar_online_at
  v_terbayar_baru := v_inv.terbayar + v_jumlah_bayar;
  if v_terbayar_baru >= v_inv.total then
    v_status_baru := 'lunas';
  else
    v_status_baru := 'sebagian';
  end if;

  update public.invoices
  set
    terbayar = v_terbayar_baru,
    status_bayar = v_status_baru,
    dibayar_online_at = now()
  where id = v_inv.id;

  -- 6. Simpan log webhook sukses
  insert into public.mayar_webhook_log (event, mayar_invoice_id, payload, status_proses, catatan)
  values ('payment.received', p_mayar_invoice_id, p_payload, 'sukses', 'Pembayaran berhasil dicatat. ID Payment: ' || v_payment_id::text);

  return v_payment_id;
end;
$$;

-- Cabut akses fungsi tandai_lunas_mayar dari publik, anon, dan authenticated
revoke all on function public.tandai_lunas_mayar(text, jsonb) from public, anon, authenticated;
-- Hanya service_role yang memiliki hak execute
grant execute on function public.tandai_lunas_mayar(text, jsonb) to service_role;
