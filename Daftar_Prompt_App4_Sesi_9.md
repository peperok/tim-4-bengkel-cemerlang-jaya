# Daftar Prompt App 4: Bengkel Cemerlang Jaya Motor

Bootcamp AI Web Programming · Sesi 9 · Kerja kelompok

Dokumen ini berisi semua *prompt* untuk membangun aplikasi Bengkel Cemerlang Jaya Motor di Sesi 9. Isinya sama dengan *prompt* di slide. Langkah lengkapnya ada di dokumen **Petunjuk Pengerjaan App 4**.

## Cara Memakai Daftar Ini

1. Salin *prompt* persis seperti tertulis, lalu kirim ke agen di Antigravity.
2. Ganti hanya bagian yang perlu diganti, misalnya nomor kelompok `k1` atau nama *branch*.
3. Kirim satu *prompt* setiap kali. Tunggu agen selesai dan periksa hasilnya sebelum mengirim *prompt* berikutnya.
4. Bila agen menampilkan SQL, baca dulu dengan daftar periksa SQL (Bagian 7), sampaikan ke kelompok, baru setujui.
5. Jangan pernah menempelkan *secret key* Supabase atau isi `.env.local` ke *chat*.

## Ringkasan Urutan

| Tahap | Siapa | *Prompt* |
|---|---|---|
| Persiapan | Ketua | K1, buat akun uji, K2 |
| Persiapan | Anggota selain ketua | 0, lalu *Branch* |
| Persiapan | Ketua, setelah K2 | *Branch* |
| Fitur | Anggota A | A1, A2, Uji A |
| Fitur | Anggota B | B1, B2 |
| Fitur | Anggota C | C1, C2 |
| Fitur | Anggota D | D1, D2, D3 |
| Penggabungan | Setiap anggota | *Push*, Coba, Tarik Main, Konflik bila perlu |
| Tayang | Ketua | Tayang |

Ganti `cemerlang-jaya-k1` dengan nomor kelompokmu, misalnya `cemerlang-jaya-k3`.

## 1. Persiapan Ketua

### Prompt K1: Menyambungkan Starter dan Memasang Tabel

**Dikirim oleh:** Ketua, setelah membuat repo dari template, membuat proyek Supabase, dan meng-*clone* repo kelompok.

```
Baca AGENTS.md dan docs/PRD.md dulu.
Pakai Supabase MCP untuk mengambil URL dan publishable key proyek cemerlang-jaya-k1. Salin .env.example menjadi .env.local lalu isi kedua nilainya tanpa menampilkannya di chat.
Setelah itu jalankan isi supabase/migrations/01_dasar.sql lewat apply_migration tanpa mengubahnya, lalu jalankan npm install dan npm run dev.
```

### Prompt K2: Peran Akun Uji dan Data Contoh

**Dikirim oleh:** Ketua, setelah membuat empat akun uji di Supabase **Authentication › Users** dengan *Auto Confirm User*.

```
Empat akun uji sudah aku buat. Lewat execute_sql, isi nama, peran, dan aktif = true keempat akun sesuai PRD 15.1. Lalu jalankan supabase/seed.sql tanpa mengubahnya, buat src/types/database.ts lewat generate_typescript_types, dan laporkan jumlah baris work_orders.
```

Setelah K2 selesai, sampaikan ke kelompok: "Database siap."

## 2. Persiapan Anggota

### Prompt 0: Menyambungkan Laptop Anggota

**Dikirim oleh:** Setiap anggota selain ketua, setelah ketua menyampaikan "Database siap".

```
Baca AGENTS.md dan docs/PRD.md dulu.
Pakai Supabase MCP untuk mengambil URL dan publishable key proyek cemerlang-jaya-k1. Salin .env.example menjadi .env.local lalu isi kedua nilainya tanpa menampilkannya di chat. Buat src/types/database.ts lewat generate_typescript_types, lalu jalankan npm install dan npm run dev.
```

### Prompt Branch: Membuat Jalur Kerja Fitur

**Dikirim oleh:** Semua anggota, termasuk ketua.

```
Buat branch baru bernama fitur/tagihan dari main terbaru, lalu pindah ke branch itu. Tunjukkan nama branch yang aktif sekarang.
```

Ganti `fitur/tagihan` dengan *branch* fiturmu: `fitur/work-order`, `fitur/tagihan`, `fitur/inventory`, atau `fitur/dashboard`.

## 3. Fitur A: Work Order

*Branch*: `fitur/work-order` · Halaman: `/work-orders`, `/work-orders/baru`, `/work-orders/[id]`

### Prompt A1: Database Function Work Order

**Dikirim oleh:** Anggota A. Sampaikan ke kelompok sebelum menyetujui SQL.

```
Fitur A. Lewat Supabase MCP, buat fungsi buat_work_order, tugaskan_mekanik, dan ubah_status_wo sesuai PRD 9.2 dan aturan perpindahan PRD 7.2, trigger jaga_wo (PRD 9.4), serta bucket foto-wo beserta policy-nya (PRD Bab 11). Setiap fungsi memeriksa peran dan tim di awal dan mengunci baris dengan for update. Tampilkan SQL dulu dan tunggu persetujuanku. Setelah aku setujui dan berhasil dijalankan, simpan SQL-nya ke supabase/migrations/fitur_a_work_order.sql dan perbarui src/types/database.ts.
```

### Prompt A2: Halaman Work Order

**Dikirim oleh:** Anggota A, setelah A1 berhasil.

```
Lengkapi kerangka /work-orders, /work-orders/baru, dan /work-orders/[id] sesuai PRD 6.6, 6.7, dan 6.8 bagian A sampai C. Tombol status, termasuk Serahkan Mobil, hanya tampil untuk perpindahan yang sah bagi peran yang login dan memanggil ubah_status_wo lewat supabase.rpc(). Foto diperkecil sebelum diunggah dan memakai thumbnail (PRD 11.3 dan 11.4). Jangan mengubah folder tagihan dan invoice milik fitur B.
```

### Prompt Uji A: Serangan Lewat Database

**Dikirim oleh:** Anggota A, setelah uji lewat tampilan selesai.

```
Lewat execute_sql, tiru login Pak Joko lalu panggil ubah_status_wo untuk satu WO Tim B, dan untuk lompatan menunggu ke siap_diambil di WO Tim A. Jangan ubah data lain. Laporkan pesan error kedua uji.
```

Hasil yang benar: kedua panggilan ditolak dengan pesan berbahasa Indonesia.

## 4. Fitur B: Tagihan dan Invoice

*Branch*: `fitur/tagihan` · Halaman: `/work-orders/[id]/tagihan`, `/work-orders/[id]/invoice`

### Prompt B1: Database Function Tagihan

**Dikirim oleh:** Anggota B. Sampaikan ke kelompok sebelum menyetujui SQL.

```
Fitur B. Lewat Supabase MCP, buat fungsi tambah_item_tagihan, hapus_item_tagihan, sesuaikan_harga_item, atur_diskon, terbitkan_invoice, dan catat_pembayaran sesuai PRD 9.2. Fungsi yang mengubah stok dan nomor invoice wajib mengunci baris dengan for update. Penyesuaian harga wajib beralasan. Tampilkan SQL dulu dan tunggu persetujuanku. Setelah aku setujui dan berhasil dijalankan, simpan SQL-nya ke supabase/migrations/fitur_b_tagihan.sql dan perbarui src/types/database.ts.
```

### Prompt B2: Halaman Tagihan dan Invoice

**Dikirim oleh:** Anggota B, setelah B1 berhasil.

```
Lengkapi kerangka /work-orders/[id]/tagihan dan /work-orders/[id]/invoice sesuai PRD 6.8 bagian D dan 6.9: Kepala Mekanik menambah dan menghapus item saat dikerjakan; Admin menyesuaikan harga dengan alasan wajib, dengan peringatan bila di bawah modal, dan mengatur diskon; Terbitkan Invoice; Catat Pembayaran sebagian atau lunas; invoice rapi saat dicetak. Semua aksi lewat supabase.rpc(). Jangan mengubah halaman milik fitur A.
```

## 5. Fitur C: Inventory dan Pengguna

*Branch*: `fitur/inventory` · Halaman: `/inventory`, `/pengguna`, `/setelan`

### Prompt C1: Database Function Stok

**Dikirim oleh:** Anggota C. Sampaikan ke kelompok sebelum menyetujui SQL.

```
Fitur C. Lewat Supabase MCP, buat fungsi catat_stok_masuk dan sesuaikan_stok sesuai PRD 9.2, serta bucket publik beserta policy-nya (PRD Bab 11). Fungsi mengunci baris item dengan for update. Tampilkan SQL dulu dan tunggu persetujuanku. Setelah aku setujui dan berhasil dijalankan, simpan SQL-nya ke supabase/migrations/fitur_c_inventory.sql dan perbarui src/types/database.ts.
```

### Prompt C2: Halaman Inventory, Pengguna, dan Setelan

**Dikirim oleh:** Anggota C, setelah C1 berhasil.

```
Lengkapi kerangka /inventory, /pengguna, dan /setelan sesuai PRD 6.4, 6.10, dan 6.11:
1. Inventory dengan tab Spare Part, Jasa, dan Riwayat Stok. Kolom harga modal dari inventory_costs hanya diambil dan ditampilkan untuk Owner. Tombol Stok Masuk untuk Admin dan Owner, Penyesuaian Stok untuk Owner.
2. Pengguna: Owner mengubah peran dan status aktif akun.
3. Setelan: Owner mengubah data bengkel, logo, dan galeri di bucket publik.
Daftar berhalaman 20 baris dan hanya mengambil kolom yang ditampilkan.
```

## 6. Fitur D: Dashboard dan Audit Log

*Branch*: `fitur/dashboard` · Halaman: `/dashboard`, `/audit-log`, `/laporan-laba`

### Prompt D1: Fungsi Dashboard dan Trigger Audit

**Dikirim oleh:** Anggota D. Sampaikan ke kelompok sebelum menyetujui SQL.

```
Fitur D. Lewat Supabase MCP:
1. Jalankan isi supabase/dashboard.sql tanpa mengubahnya.
2. Buat trigger catat_audit di tabel PRD 9.4. Pastikan audit_logs tidak bisa diubah atau dihapus siapa pun.
Tampilkan SQL trigger dulu dan tunggu persetujuanku. Setelah aku setujui dan berhasil dijalankan, simpan SQL-nya ke supabase/migrations/fitur_d_audit.sql dan perbarui src/types/database.ts.
```

### Prompt D2: Halaman Audit Log dan Laporan Laba

**Dikirim oleh:** Anggota D, setelah D1 berhasil.

```
Lengkapi kerangka /audit-log dan /laporan-laba sesuai PRD 6.12 dan 6.13. Audit Log: 20 baris per halaman, penyaring tabel dan pelaku, serta perbandingan nilai sebelum dan sesudah. Laporan Laba memakai fungsi laporan_laba lewat supabase.rpc(). Keduanya hanya untuk Owner.
```

### Prompt D3: Tampilan Dashboard

**Dikirim oleh:** Anggota D, setelah D2.

```
Lengkapi kerangka /dashboard sesuai PRD Bab 12 untuk tiga peran. Semua angka dan grafik diambil dari fungsi dashboard_* lewat supabase.rpc(), tidak dihitung dari seluruh baris.
1. Pilihan periode (Hari ini, 7 hari, 30 hari, Bulan ini) yang mengubah semua kartu dan grafik.
2. Kartu KPI dengan ikon, angka besar, dan perubahan dibanding periode sebelumnya (naik hijau, turun merah).
3. Grafik Recharts lewat komponen chart shadcn/ui: area untuk tren harian, batang untuk beban mekanik dan item terlaris, donat untuk WO per status dengan warna status PRD 7.1.
4. Setiap grafik punya judul, keterangan singkat, tooltip, dan tampilan kosong. Klik bagian grafik membuka daftar sumbernya.
5. Skeleton saat memuat, grid rapi di laptop dan tablet, warna dari globals.css.
```

## 7. Daftar Periksa SQL

Sebelum menyetujui SQL dari agen, cari empat hal ini:

1. **Fungsi aman:** ada `security definer` dan `set search_path = ''`.
2. **Peran diperiksa di awal:** lewat `private.peran_saya()`, sebelum mengubah apa pun.
3. **Baris dikunci:** ada `for update` pada data yang bisa direbut, misalnya stok, WO, dan nomor *invoice*.
4. **Nama sama dengan PRD:** nama fungsi dan parameternya persis PRD 9.2.

Tolak SQL yang membuat, mengubah, atau menghapus tabel. Tabel sudah lengkap di starter.

## 8. Penggabungan

### Prompt Push: Menyimpan dan Mengirim Branch

**Dikirim oleh:** Setiap anggota, setelah semua uji fiturnya lolos.

```
Tarik main terbaru ke branch-ku. Bila ada merge conflict, berhenti dan tunjukkan dulu. Bila aman, commit semua perubahan dengan pesan yang menjelaskan isinya, lalu push branch-ku ke GitHub. Tuliskan juga ringkasan perubahan dan cara mengujinya untuk deskripsi pull request.
```

Setelah itu buka repo kelompok di GitHub, klik **Compare & pull request**, tempel ringkasan dari agen ke deskripsi, pilih satu teman sebagai *reviewer*, lalu klik **Create pull request**.

### Prompt Coba: Mencoba Fitur Teman

**Dikirim oleh:** *Reviewer*, sebelum menyetujui *pull request*.

```
Simpan dulu pekerjaanku dengan commit. Lalu ambil branch fitur/tagihan dari GitHub dan pindah ke branch itu supaya aku bisa mencoba fitur temanku. Setelah selesai, kembalikan aku ke branch-ku sendiri.
```

Ganti `fitur/tagihan` dengan *branch* yang sedang kamu *review*.

### Prompt Tarik Main: Mengambil Versi Terbaru

**Dikirim oleh:** Semua anggota, setiap kali ketua menyampaikan ada *pull request* yang masuk main.

```
Tarik main terbaru dari GitHub ke branch-ku. Bila ada merge conflict, berhenti dan tunjukkan dulu.
```

### Prompt Konflik: Menyelesaikan Merge Conflict

**Dikirim oleh:** Anggota yang mengalami *merge conflict*.

```
Ada merge conflict. Untuk setiap file yang bentrok:
1. Tunjukkan bagian yang bentrok dan jelaskan isi kedua versinya dengan bahasa sederhana.
2. Usulkan penyelesaian yang mempertahankan pekerjaan kedua fitur.
3. Tunggu persetujuanku sebelum mengubah file.
Khusus src/types/database.ts, jangan digabung manual. Buat ulang lewat generate_typescript_types.
Setelah selesai, jalankan npm run build untuk memastikan tidak ada error.
```

Bila konflik ada di file milik fitur lain, putuskan bersama pemilik fiturnya.

## 9. Tayang

### Prompt Tayang: Menayangkan ke Netlify

**Dikirim oleh:** Ketua, setelah semua *pull request* masuk main dan uji alur lengkap lolos.

```
Pindah ke branch main dan tarik versi terbaru. Tayangkan aplikasi ke Netlify lewat Netlify CLI dengan nama situs cemerlang-jaya-k1. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dari .env.local ke environment variable Netlify tanpa menampilkan nilainya. Setelah selesai, beri aku URL-nya.
```

Setelah itu buka Supabase **Authentication › URL Configuration** dan ganti **Site URL** dengan URL Netlify.

## 10. Prompt Bantuan

*Prompt* berikut tidak ada di slide. Pakai bila diperlukan.

### Prompt Uji C: Data Rahasia dan Peran

**Dikirim oleh:** Anggota C, setelah uji lewat tampilan selesai.

```
Lewat execute_sql, jalankan dua uji tanpa mengubah data lain:
1. Tiru login Rina, lalu baca tabel inventory_costs. Laporkan jumlah baris yang terbaca.
2. Tiru login Pak Joko, lalu ubah kolom role miliknya menjadi owner. Laporkan pesan error-nya.
```

Hasil yang benar: uji 1 membaca 0 baris, uji 2 ditolak dengan pesan "Hanya Owner yang boleh mengubah peran atau status akun".

### Prompt Uji D: Audit Log Tidak Bisa Dihapus

**Dikirim oleh:** Anggota D, setelah uji lewat tampilan selesai.

```
Lewat execute_sql, tiru login Rina lalu coba hapus satu baris audit_logs. Setelah itu tiru login Pak Darto dan coba hal yang sama. Jangan ubah data lain. Laporkan hasil kedua uji.
```

Hasil yang benar: kedua percobaan ditolak.

### Prompt Mencari Penyebab Error

**Dikirim oleh:** Siapa saja, bila halaman atau fungsi menampilkan error.

```
Halaman ini menampilkan error berikut: [tempel pesan error]. Telusuri penyebabnya dengan membaca kode halaman, log Supabase lewat MCP, dan PRD. Jelaskan penyebabnya dengan bahasa sederhana dan usulkan perbaikannya. Jangan mengubah tabel dan jangan mengubah file milik fitur lain. Tunggu persetujuanku sebelum mengubah apa pun.
```

### Prompt Memperbarui Tipe

**Dikirim oleh:** Siapa saja, bila editor menandai nama fungsi atau kolom sebagai error setelah ada perubahan database.

```
Buat ulang src/types/database.ts lewat generate_typescript_types, lalu jalankan npx tsc --noEmit dan laporkan hasilnya.
```
