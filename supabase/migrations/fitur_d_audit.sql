-- =============================================================
-- App 4 Cemerlang Jaya Motor · Fitur D (Audit Log & Trigger)
-- Trigger catat_audit (PRD 9.4) & Proteksi audit_logs
-- =============================================================

-- 1. Fungsi trigger untuk mencatat audit log otomatis
create or replace function private.catat_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_pelaku_id uuid := auth.uid();
  v_pelaku_peran text := private.peran_saya();
  v_sebelum jsonb := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  v_sesudah jsonb := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  v_data_id text;
  v_alasan text;
begin
  -- Bila peran belum terisi dari peran_saya (misal konteks auth), ambil dari tabel profiles
  if v_pelaku_peran is null and v_pelaku_id is not null then
    select role into v_pelaku_peran from public.profiles where id = v_pelaku_id;
  end if;

  -- Ambil data_id (nomor data, kode, atau primary key UUID)
  v_data_id := coalesce(
    v_sesudah->>'nomor',
    v_sesudah->>'kode',
    v_sesudah->>'id',
    v_sesudah->>'item_id',
    v_sesudah->>'billing_item_id',
    v_sebelum->>'nomor',
    v_sebelum->>'kode',
    v_sebelum->>'id',
    v_sebelum->>'item_id',
    v_sebelum->>'billing_item_id'
  );

  -- Ambil alasan perubahan bila ada kolom alasan
  v_alasan := coalesce(
    v_sesudah->>'alasan',
    v_sesudah->>'alasan_penyesuaian',
    v_sesudah->>'alasan_diskon',
    v_sesudah->>'keterangan',
    v_sebelum->>'alasan',
    v_sebelum->>'alasan_penyesuaian',
    v_sebelum->>'alasan_diskon',
    v_sebelum->>'keterangan'
  );

  -- Tulis ke audit_logs
  insert into public.audit_logs (
    pelaku_id,
    pelaku_peran,
    aksi,
    tabel,
    data_id,
    sebelum,
    sesudah,
    alasan
  ) values (
    v_pelaku_id,
    v_pelaku_peran,
    TG_OP,
    TG_TABLE_NAME,
    v_data_id,
    v_sebelum,
    v_sesudah,
    v_alasan
  );

  return coalesce(NEW, OLD);
end $$;

-- 2. Pasang trigger catat_audit di 9 tabel PRD 9.4
drop trigger if exists catat_audit on public.work_orders;
create trigger catat_audit
after insert or update or delete on public.work_orders
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.billing_items;
create trigger catat_audit
after insert or update or delete on public.billing_items
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.billing_item_costs;
create trigger catat_audit
after insert or update or delete on public.billing_item_costs
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.inventory_items;
create trigger catat_audit
after insert or update or delete on public.inventory_items
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.inventory_costs;
create trigger catat_audit
after insert or update or delete on public.inventory_costs
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.invoices;
create trigger catat_audit
after insert or update or delete on public.invoices
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.payments;
create trigger catat_audit
after insert or update or delete on public.payments
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.stock_movements;
create trigger catat_audit
after insert or update or delete on public.stock_movements
for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.profiles;
create trigger catat_audit
after insert or update or delete on public.profiles
for each row execute function private.catat_audit();

-- 3. Proteksi tabel audit_logs agar tidak bisa diubah atau dihapus siapa pun
revoke update, delete on public.audit_logs from public, anon, authenticated;

create or replace function private.jaga_audit_logs()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'Data audit log tidak boleh diubah atau dihapus';
end $$;

drop trigger if exists jaga_audit_logs on public.audit_logs;
create trigger jaga_audit_logs
before update or delete on public.audit_logs
for each row execute function private.jaga_audit_logs();
