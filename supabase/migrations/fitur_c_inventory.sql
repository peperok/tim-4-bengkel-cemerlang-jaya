-- =============================================================
-- Fitur C: Inventory & Pengguna
-- 1. Fungsi catat_stok_masuk (Admin, Owner)
-- 2. Fungsi sesuaikan_stok (Owner)
-- 3. Bucket Storage 'publik' dan kebijakan aksesnya
-- =============================================================

-- 1. Fungsi catat_stok_masuk
create or replace function public.catat_stok_masuk(
  p_item uuid,
  p_jumlah int,
  p_keterangan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_jenis text;
  v_stok_lama int;
  v_stok_baru int;
begin
  -- Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh mencatat stok masuk';
  end if;

  -- Validasi jumlah
  if p_jumlah is null or p_jumlah < 1 then
    raise exception 'Jumlah stok masuk minimal 1';
  end if;

  -- Kunci baris item dengan FOR UPDATE
  select jenis, stok into v_jenis, v_stok_lama
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item tidak ditemukan';
  end if;

  if v_jenis <> 'part' then
    raise exception 'Hanya item jenis spare part yang memiliki stok';
  end if;

  v_stok_baru := v_stok_lama + p_jumlah;

  -- Perbarui stok item
  update public.inventory_items
  set stok = v_stok_baru,
      updated_at = now()
  where id = p_item;

  -- Catat riwayat pergerakan stok
  insert into public.stock_movements (
    item_id,
    jenis,
    jumlah,
    stok_sesudah,
    keterangan,
    dicatat_oleh
  ) values (
    p_item,
    'masuk',
    p_jumlah,
    v_stok_baru,
    p_keterangan,
    auth.uid()
  );
end;
$$;

revoke all on function public.catat_stok_masuk(uuid, int, text) from public, anon;
grant execute on function public.catat_stok_masuk(uuid, int, text) to authenticated;


-- 2. Fungsi sesuaikan_stok
create or replace function public.sesuaikan_stok(
  p_item uuid,
  p_stok_fisik int,
  p_alasan text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_jenis text;
  v_stok_lama int;
  v_selisih int;
begin
  -- Periksa peran pemanggil (hanya Owner)
  v_peran := private.peran_saya();
  if v_peran <> 'owner' then
    raise exception 'Hanya Owner yang boleh menyesuaikan stok';
  end if;

  -- Validasi stok fisik dan alasan
  if p_stok_fisik is null or p_stok_fisik < 0 then
    raise exception 'Stok fisik tidak boleh bernilai negatif';
  end if;

  if p_alasan is null or trim(p_alasan) = '' then
    raise exception 'Alasan penyesuaian stok wajib diisi';
  end if;

  -- Kunci baris item dengan FOR UPDATE
  select jenis, stok into v_jenis, v_stok_lama
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item tidak ditemukan';
  end if;

  if v_jenis <> 'part' then
    raise exception 'Hanya item jenis spare part yang memiliki stok';
  end if;

  v_selisih := p_stok_fisik - v_stok_lama;

  -- Perbarui stok item ke stok fisik
  update public.inventory_items
  set stok = p_stok_fisik,
      updated_at = now()
  where id = p_item;

  -- Catat pergerakan penyesuaian di stock_movements
  insert into public.stock_movements (
    item_id,
    jenis,
    jumlah,
    stok_sesudah,
    keterangan,
    dicatat_oleh
  ) values (
    p_item,
    'penyesuaian',
    v_selisih,
    p_stok_fisik,
    p_alasan,
    auth.uid()
  );
end;
$$;

revoke all on function public.sesuaikan_stok(uuid, int, text) from public, anon;
grant execute on function public.sesuaikan_stok(uuid, int, text) to authenticated;


-- 3. Bucket Storage 'publik' (PRD Bab 11)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publik',
  'publik',
  true,
  1048576,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Kebijakan RLS storage.objects untuk bucket 'publik'
drop policy if exists "Publik dapat melihat file di bucket publik" on storage.objects;
create policy "Publik dapat melihat file di bucket publik"
on storage.objects for select
using (bucket_id = 'publik');

drop policy if exists "Owner dapat mengunggah ke bucket publik" on storage.objects;
create policy "Owner dapat mengunggah ke bucket publik"
on storage.objects for insert
with check (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);

drop policy if exists "Owner dapat memperbarui file di bucket publik" on storage.objects;
create policy "Owner dapat memperbarui file di bucket publik"
on storage.objects for update
using (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);

drop policy if exists "Owner dapat menghapus file di bucket publik" on storage.objects;
create policy "Owner dapat menghapus file di bucket publik"
on storage.objects for delete
using (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);
