-- =============================================================
-- App 4 Cemerlang Jaya Motor · Fitur A: Work Order
-- Sesuai PRD Bab 7.2, 9.2, 9.4, dan Bab 11
-- =============================================================

-- -------------------------------------------------------------
-- 1. Trigger jaga_wo (PRD 9.4)
-- Ditulis tanpa security definer (security invoker) agar memeriksa
-- current_user dan peran pemanggil saat UPDATE langsung dari aplikasi.
-- -------------------------------------------------------------
create or replace function private.jaga_wo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_peran text;
begin
  -- Hanya periksa jika update dipanggil langsung oleh user aplikasi (authenticated)
  if current_user = 'authenticated' then
    v_peran := private.peran_saya();

    -- Kolom status tidak boleh diubah langsung oleh siapa pun (harus via ubah_status_wo)
    if new.status is distinct from old.status then
      raise exception 'Status WO hanya boleh diubah melalui fungsi ubah_status_wo';
    end if;

    -- Kolom sensitif lain tidak boleh diubah langsung
    if new.nomor is distinct from old.nomor or
       new.vehicle_id is distinct from old.vehicle_id or
       new.customer_id is distinct from old.customer_id or
       new.diskon is distinct from old.diskon or
       new.alasan_diskon is distinct from old.alasan_diskon or
       new.selesai_at is distinct from old.selesai_at or
       new.diambil_at is distinct from old.diambil_at or
       new.dibuat_oleh is distinct from old.dibuat_oleh then
      raise exception 'Perubahan kolom ini tidak diizinkan secara langsung';
    end if;

    -- Admin atau Owner dapat mengubah keluhan, odometer, kepala_mekanik_id saat status 'menunggu'
    if (new.keluhan is distinct from old.keluhan or
        new.odometer is distinct from old.odometer or
        new.kepala_mekanik_id is distinct from old.kepala_mekanik_id) then
      if old.status <> 'menunggu' then
        raise exception 'Keluhan, odometer, dan tim hanya dapat diubah saat status menunggu';
      end if;
      if v_peran not in ('admin', 'owner') then
        raise exception 'Hanya Admin atau Owner yang boleh mengubah data masuk WO';
      end if;
    end if;

    -- Kepala Mekanik tim WO atau Owner dapat mengisi diagnosis saat 'dikerjakan' atau 'tertunda'
    if new.diagnosis is distinct from old.diagnosis then
      if old.status not in ('dikerjakan', 'tertunda') then
        raise exception 'Diagnosis hanya dapat diisi saat pengerjaan atau tertunda';
      end if;
      if v_peran = 'kepala_mekanik' and old.kepala_mekanik_id <> auth.uid() then
        raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh mengisi diagnosis';
      end if;
      if v_peran not in ('kepala_mekanik', 'owner') then
        raise exception 'Anda tidak memiliki hak untuk mengisi diagnosis';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_wo on public.work_orders;
create trigger jaga_wo
  before update on public.work_orders
  for each row execute function private.jaga_wo();


-- -------------------------------------------------------------
-- 2. Fungsi Bisnis: buat_work_order (PRD 9.2)
-- Dipanggil oleh: Admin, Owner
-- Format nomor WO: WO-YYMM-XXXX
-- -------------------------------------------------------------
create or replace function public.buat_work_order(
  p_vehicle_id uuid,
  p_kepala_mekanik_id uuid,
  p_odometer int,
  p_keluhan text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_customer_id uuid;
  v_periode text;
  v_nomor_urut int;
  v_nomor_wo text;
  v_wo_id uuid;
begin
  -- 1. Periksa peran di awal
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh membuat Work Order';
  end if;

  -- 2. Validasi parameter
  if p_odometer is null or p_odometer < 0 then
    raise exception 'Odometer harus berupa angka positif';
  end if;
  if p_keluhan is null or trim(p_keluhan) = '' then
    raise exception 'Keluhan wajib diisi';
  end if;

  -- 3. Dapatkan customer_id pemilik kendaraan
  select customer_id into v_customer_id
  from public.vehicles
  where id = p_vehicle_id;

  if v_customer_id is null then
    raise exception 'Kendaraan tidak ditemukan';
  end if;

  -- 4. Validasi kepala mekanik aktif
  if not exists (
    select 1 from public.profiles
    where id = p_kepala_mekanik_id and role = 'kepala_mekanik' and aktif = true
  ) then
    raise exception 'Kepala mekanik tidak valid atau tidak aktif';
  end if;

  -- 5. Generate nomor WO berurutan tanpa ganda (format WO-YYMM-XXXX)
  v_periode := to_char(now(), 'YYMM');
  v_nomor_urut := private.nomor_berikut('WO', v_periode);
  v_nomor_wo := 'WO-' || v_periode || '-' || lpad(v_nomor_urut::text, 4, '0');

  -- 6. Insert ke tabel work_orders
  insert into public.work_orders (
    nomor,
    vehicle_id,
    customer_id,
    kepala_mekanik_id,
    odometer,
    keluhan,
    status,
    dibuat_oleh
  ) values (
    v_nomor_wo,
    p_vehicle_id,
    v_customer_id,
    p_kepala_mekanik_id,
    p_odometer,
    trim(p_keluhan),
    'menunggu',
    auth.uid()
  ) returning id into v_wo_id;

  -- 7. Catat ke riwayat status WO
  insert into public.wo_status_history (
    work_order_id,
    dari_status,
    ke_status,
    catatan,
    oleh
  ) values (
    v_wo_id,
    null,
    'menunggu',
    'Work Order dibuat',
    auth.uid()
  );

  return v_wo_id;
end;
$$;

revoke all on function public.buat_work_order(uuid, uuid, int, text) from public, anon;
grant execute on function public.buat_work_order(uuid, uuid, int, text) to authenticated;


-- -------------------------------------------------------------
-- 3. Fungsi Bisnis: tugaskan_mekanik (PRD 9.2)
-- Dipanggil oleh: Kepala Mekanik tim WO, Owner
-- -------------------------------------------------------------
create or replace function public.tugaskan_mekanik(
  p_wo uuid,
  p_mekanik uuid[],
  p_estimasi date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo_status text;
  v_kepala_mekanik_id uuid;
  v_mekanik_id uuid;
begin
  -- 1. Periksa peran di awal
  v_peran := private.peran_saya();
  if v_peran not in ('kepala_mekanik', 'owner') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menugaskan mekanik';
  end if;

  -- 2. Kunci baris WO dengan for update
  select status, kepala_mekanik_id
  into v_wo_status, v_kepala_mekanik_id
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- 3. Validasi hubungan tim (Kepala mekanik hanya untuk timnya)
  if v_peran = 'kepala_mekanik' and v_kepala_mekanik_id <> auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh menugaskan mekanik';
  end if;

  -- 4. Status harus 'menunggu'
  if v_wo_status <> 'menunggu' then
    raise exception 'Penugasan mekanik hanya dapat dilakukan saat status menunggu';
  end if;

  -- 5. Validasi estimasi dan daftar mekanik
  if p_estimasi is null or p_estimasi < current_date then
    raise exception 'Estimasi selesai tidak boleh sebelum hari ini';
  end if;
  if p_mekanik is null or array_length(p_mekanik, 1) is null or array_length(p_mekanik, 1) < 1 then
    raise exception 'Minimal 1 mekanik harus ditugaskan';
  end if;

  -- 6. Validasi setiap mekanik harus aktif dan milik tim kepala mekanik WO ini
  foreach v_mekanik_id in array p_mekanik loop
    if not exists (
      select 1 from public.mekanik
      where id = v_mekanik_id
        and kepala_mekanik_id = v_kepala_mekanik_id
        and aktif = true
    ) then
      raise exception 'Satu atau lebih mekanik tidak valid atau bukan anggota tim ini';
    end if;
  end loop;

  -- 7. Perbarui estimasi selesai di WO
  update public.work_orders
  set estimasi_selesai = p_estimasi,
      updated_at = now()
  where id = p_wo;

  -- 8. Simpan ke work_order_mekanik
  delete from public.work_order_mekanik where work_order_id = p_wo;
  foreach v_mekanik_id in array p_mekanik loop
    insert into public.work_order_mekanik (work_order_id, mekanik_id)
    values (p_wo, v_mekanik_id);
  end loop;

end;
$$;

revoke all on function public.tugaskan_mekanik(uuid, uuid[], date) from public, anon;
grant execute on function public.tugaskan_mekanik(uuid, uuid[], date) to authenticated;


-- -------------------------------------------------------------
-- 4. Fungsi Bisnis: ubah_status_wo (PRD 9.2 & 7.2)
-- Dipanggil oleh: Sesuai Matriks PRD 7.2
-- Mengunci baris WO dengan for update
-- -------------------------------------------------------------
create or replace function public.ubah_status_wo(
  p_wo uuid,
  p_status text,
  p_catatan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_old_status text;
  v_kepala_mekanik_id uuid;
  v_estimasi date;
  v_item record;
  v_stok_lama int;
  v_stok_baru int;
begin
  -- 1. Periksa peran di awal
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak aktif atau tidak memiliki hak akses';
  end if;

  -- 2. Kunci baris WO dengan for update
  select status, kepala_mekanik_id, estimasi_selesai
  into v_old_status, v_kepala_mekanik_id, v_estimasi
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- 3. Evaluasi State Machine sesuai PRD Bab 7.2
  -- Kasus A: menunggu -> dikerjakan
  if v_old_status = 'menunggu' and p_status = 'dikerjakan' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik atau Owner yang boleh memulai pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh mengubah status ini';
    end if;
    if v_estimasi is null then
      raise exception 'Estimasi selesai harus diisi sebelum memulai pengerjaan';
    end if;
    if not exists (select 1 from public.work_order_mekanik where work_order_id = p_wo) then
      raise exception 'Minimal 1 mekanik harus ditugaskan sebelum memulai pengerjaan';
    end if;

  -- Kasus B: dikerjakan -> tertunda
  elsif v_old_status = 'dikerjakan' and p_status = 'tertunda' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menunda pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh mengubah status ini';
    end if;
    if p_catatan is null or trim(p_catatan) = '' then
      raise exception 'Catatan penundaan wajib diisi';
    end if;

  -- Kasus C: tertunda -> dikerjakan
  elsif v_old_status = 'tertunda' and p_status = 'dikerjakan' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik atau Owner yang boleh melanjutkan pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh mengubah status ini';
    end if;

  -- Kasus D: dikerjakan -> selesai
  elsif v_old_status = 'dikerjakan' and p_status = 'selesai' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menyelesaikan pengerjaan';
    end if;
    if v_peran = 'kepala_mekanik' and v_kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh mengubah status ini';
    end if;
    if not exists (select 1 from public.billing_items where work_order_id = p_wo) then
      raise exception 'Catat minimal 1 jasa atau spare part sebelum menyelesaikan pengerjaan';
    end if;

  -- Kasus E: selesai -> siap_diambil (QC Lulus)
  elsif v_old_status = 'selesai' and p_status = 'siap_diambil' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik atau Owner yang boleh melakukan QC';
    end if;
    if v_peran = 'kepala_mekanik' and v_kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh mengubah status ini';
    end if;

  -- Kasus F: selesai -> dikerjakan (QC Gagal)
  elsif v_old_status = 'selesai' and p_status = 'dikerjakan' then
    if v_peran not in ('kepala_mekanik', 'owner') then
      raise exception 'Hanya Kepala Mekanik atau Owner yang boleh melakukan QC';
    end if;
    if v_peran = 'kepala_mekanik' and v_kepala_mekanik_id <> auth.uid() then
      raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh mengubah status ini';
    end if;
    if p_catatan is null or trim(p_catatan) = '' then
      raise exception 'Catatan QC gagal wajib diisi';
    end if;

  -- Kasus G: siap_diambil -> diambil (Penyerahan Mobil)
  elsif v_old_status = 'siap_diambil' and p_status = 'diambil' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh menyerahkan mobil';
    end if;
    -- Syarat: invoice lunas
    if not exists (
      select 1 from public.invoices
      where work_order_id = p_wo and status_bayar = 'lunas'
    ) then
      raise exception 'Mobil hanya dapat diserahkan bila invoice sudah lunas';
    end if;
    -- Syarat: minimal 1 foto kondisi akhir
    if not exists (
      select 1 from public.work_order_photos
      where work_order_id = p_wo and jenis = 'kondisi_akhir'
    ) then
      raise exception 'Unggah minimal 1 foto kondisi akhir sebelum menyerahkan mobil';
    end if;

  -- Kasus H: (menunggu, dikerjakan, tertunda) -> dibatalkan
  elsif v_old_status in ('menunggu', 'dikerjakan', 'tertunda') and p_status = 'dibatalkan' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh membatalkan Work Order';
    end if;
    if p_catatan is null or trim(p_catatan) = '' then
      raise exception 'Alasan pembatalan wajib diisi';
    end if;

    -- Kembalikan semua stok spare part yang tercatat di billing_items
    for v_item in
      select b.item_id, b.jumlah, i.nama
      from public.billing_items b
      join public.inventory_items i on i.id = b.item_id
      where b.work_order_id = p_wo and b.jenis = 'part'
    loop
      select stok into v_stok_lama
      from public.inventory_items
      where id = v_item.item_id
      for update;

      v_stok_baru := v_stok_lama + v_item.jumlah;

      update public.inventory_items
      set stok = v_stok_baru, updated_at = now()
      where id = v_item.item_id;

      insert into public.stock_movements (
        item_id,
        jenis,
        jumlah,
        stok_sesudah,
        keterangan,
        work_order_id,
        dicatat_oleh
      ) values (
        v_item.item_id,
        'kembali',
        v_item.jumlah,
        v_stok_baru,
        'Pengembalian stok dari pembatalan WO: ' || coalesce(p_catatan, ''),
        p_wo,
        auth.uid()
      );
    end loop;

  else
    raise exception 'Perpindahan status dari % ke % tidak diizinkan', v_old_status, p_status;
  end if;

  -- 4. Update status dan timestamp WO
  update public.work_orders
  set status = p_status,
      catatan_status = case when p_catatan is not null and trim(p_catatan) <> '' then trim(p_catatan) else catatan_status end,
      selesai_at = case when p_status = 'selesai' and selesai_at is null then now() else selesai_at end,
      diambil_at = case when p_status = 'diambil' then now() else diambil_at end,
      updated_at = now()
  where id = p_wo;

  -- 5. Catat ke wo_status_history
  insert into public.wo_status_history (
    work_order_id,
    dari_status,
    ke_status,
    catatan,
    oleh
  ) values (
    p_wo,
    v_old_status,
    p_status,
    trim(p_catatan),
    auth.uid()
  );

end;
$$;

revoke all on function public.ubah_status_wo(uuid, text, text) from public, anon;
grant execute on function public.ubah_status_wo(uuid, text, text) to authenticated;


-- -------------------------------------------------------------
-- 5. Storage Bucket: foto-wo dan Policy (PRD Bab 11)
-- -------------------------------------------------------------
-- Buat bucket privat 'foto-wo'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-wo',
  'foto-wo',
  false,
  1048576, -- 1 MB
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg'];

-- Hapus policy lama jika ada untuk menghindari konflik
drop policy if exists "foto_wo_lihat" on storage.objects;
drop policy if exists "foto_wo_unggah_admin_owner" on storage.objects;
drop policy if exists "foto_wo_unggah_kondisi_akhir" on storage.objects;
drop policy if exists "foto_wo_unggah_pengerjaan" on storage.objects;
drop policy if exists "foto_wo_hapus" on storage.objects;

-- Policy 1: Lihat foto-wo oleh semua pengguna login yang aktif
create policy "foto_wo_lihat" on storage.objects
for select to authenticated
using (
  bucket_id = 'foto-wo' and (select private.peran_saya()) is not null
);

-- Policy 2: Unggah stnk & kondisi_awal oleh Admin dan Owner saat WO 'menunggu'
create policy "foto_wo_unggah_admin_owner" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('admin', 'owner')
  and (storage.foldername(name))[2] in ('stnk', 'kondisi_awal')
  and exists (
    select 1 from public.work_orders w
    where w.id::text = (storage.foldername(name))[1]
      and w.status = 'menunggu'
  )
);

-- Policy 3: Unggah kondisi_akhir oleh Admin dan Owner saat WO 'siap_diambil'
create policy "foto_wo_unggah_kondisi_akhir" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('admin', 'owner')
  and (storage.foldername(name))[2] = 'kondisi_akhir'
  and exists (
    select 1 from public.work_orders w
    where w.id::text = (storage.foldername(name))[1]
      and w.status = 'siap_diambil'
  )
);

-- Policy 4: Unggah pengerjaan oleh Kepala Mekanik tim WO saat 'dikerjakan'
create policy "foto_wo_unggah_pengerjaan" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('kepala_mekanik', 'owner')
  and (storage.foldername(name))[2] = 'pengerjaan'
  and exists (
    select 1 from public.work_orders w
    where w.id::text = (storage.foldername(name))[1]
      and w.status = 'dikerjakan'
      and (
        (select private.peran_saya()) = 'owner'
        or w.kepala_mekanik_id = (select auth.uid())
      )
  )
);

-- Policy 5: Hapus foto-wo hanya oleh Owner
create policy "foto_wo_hapus" on storage.objects
for delete to authenticated
using (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) = 'owner'
);
