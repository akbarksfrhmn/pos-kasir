# Aplikasi Kasir Kedai & Toko Kecil

Aplikasi kasir (Point of Sale) berbasis web yang ringan dan responsif untuk kedai kopi atau toko kecil. Mengintegrasikan pencatatan transaksi kasir, pembuatan katalog QR untuk pelanggan, pengelolaan stok produk harian otomatis, dan laporan laba rugi sederhana dalam satu antarmuka yang tenang dan terstruktur.

## Tinjauan Pengguna & Keputusan Utama

> [!IMPORTANT]
> Berikut adalah rangkuman keputusan produk yang telah dikonfirmasi dari sesi klarifikasi dan penetapan spesifikasi teknis untuk MVP:

- **Cakupan Transaksi Kasir (POS) Lengkap**: Tersedia layar kasir interaktif untuk memilih produk, mengatur jumlah pesanan, memilih metode pembayaran (Tunai / QRIS / Transfer), menghitung kembalian, dan mencetak/menyimpan struk digital.
- **Mekanisme Stok Produk Jadi Otomatis**: Stok dihitung per unit produk jadi. Setiap transaksi yang selesai otomatis memotong stok produk terkait. Tim Produksi dapat mencatat penambahan stok harian (*restock*) atau barang rusak/terbuang (*waste*).
- **Penyimpanan Lokal & Pencadangan Mandiri**: Seluruh data disimpan secara persisten di perangkat (`localStorage` dengan validasi skema) dilengkapi fitur **Ekspor JSON/CSV** dan **Impor Data Cadangan** agar mudah dipulihkan atau dipindahkan.
- **Kontrol Akses Peran & PIN Sederhana**: Tersedia pemilih peran cepat (**Staff Kasir**, **Tim Produksi**, **Pemilik Toko**). Akses ke menu sensitif milik Pemilik Toko (seperti perubahan HPP/modal, biaya operasional, dan laporan laba rugi) dilindungi dengan PIN sederhana (default: `1234`, dapat diubah).

---

## 1. Gambaran Umum & Konsep Inti

- **Apa yang Dilakukan Aplikasi Ini**: Menyediakan sistem operasional harian terpadu mulai dari transaksi pesanan di meja kasir, pembaruan stok harian di dapur/produksi, tampilan menu QR untuk pelanggan, hingga perhitungan laba bersih secara otomatis.
- **Pengguna Utama (Personas)**:
  - **Staff Kasir**: Memproses pesanan pelanggan dengan cepat di layar kasir dan memantau ketersediaan stok menu saat transaksi.
  - **Tim Produksi**: Mencatat stok masuk harian (*restock*), stok rusak/kedaluwarsa (*waste*), serta memantau peringatan stok menipis.
  - **Pemilik Toko**: Mengelola katalog produk beserta Harga Pokok Penjualan (HPP), mencetak kode QR katalog, mencatat beban operasional harian, meninjau laporan laba rugi, dan mencadangkan data.
- **Nilai Utama & Kriteria Keberhasilan**:
  - Waktu pencatatan pesanan pelanggan di bawah 15 detik dengan pemotongan stok otomatis.
  - Perhitungan Laba Bersih (`Omzet Penjualan - HPP Produk Terjual - Kerugian Stok Terbuang - Biaya Operasional`) langsung terbarui secara akurat tanpa rekapitulasi manual.

---

## 2. Pengalaman Pengguna & Desain Visual

### Alur Pengguna Utama (Key User Flows)
1. **Alur Transaksi Kasir**:
   - Memilih produk dari daftar menu (dapat difilter per kategori atau dicari melalui kata kunci/pintasan keyboard).
   - Menyesuaikan kuantitas di keranjang pesanan (sistem menolak jika melebihi sisa stok).
   - Memilih metode pembayaran (Tunai dengan kalkulator uang diterima & kembalian otomatis, atau Non-Tunai/QRIS), lalu menyelesaikan pesanan.
2. **Alur Pencatatan Stok Harian (Tim Produksi)**:
   - Membuka tab **Stok Harian**, melihat daftar produk dengan indikator stok aman, menipis, atau habis.
   - Mencatat pergerakan stok: **Stok Masuk (+)**, **Stok Terbuang/Rusak (-)**, atau **Koreksi Stok Opname**, disertai catatan alasan.
3. **Alur Katalog & Kode QR**:
   - Menambah/mengubah produk (Nama, SKU, Kategori, Harga Jual, HPP/Modal, Stok Minimum, Status Aktif).
   - Membuka **Generator Katalog QR** untuk menampilkan kode QR siap cetak dan pratinjau halaman **Menu Pelanggan** (hanya menampilkan nama produk, kategori, harga jual, dan status ketersediaan tanpa menampilkan HPP).
4. **Alur Laporan Laba Rugi & Cadangan Data (Pemilik Toko)**:
   - Memilih rentang waktu (Hari Ini, 7 Hari Terakhir, Bulan Ini, atau Semua).
   - Meninjau ringkasan Omzet Kotor, Total HPP Terjual, Laba Kotor, Beban Operasional/Stok Rusak, dan Laba Bersih, lengkap dengan rincian transaksi dan tombol Ekspor/Impor data.

### Identitas Visual & Tema
- **Arah Estetika**: *Editorial Tenang (Calm Editorial)* — bersih, fungsional, ruang lega (*lapang*), tanpa elemen dekoratif berlebihan.
- **Palet Warna (60-30-10)**:
  - *60% Kanvas Netral*: Putih gading hangat sangat halus (`#FAF9F6`) untuk latar utama dan putih bersih (`#FFFFFF`) untuk permukaan kerja.
  - *30% Permukaan Struktural*: Teks utama arang gelap (`#18181B`), teks sekunder (`#52525B`), dan garis batas tipis (`#E4E4E7`).
  - *10% Aksen Utama*: Hijau cemara teduh (`#24634b`) sesuai arahan desain untuk aksi utama dan status aktif; indikator semantik hijau (`#16A34A`), kuning amber (`#D97706`), dan merah (`#DC2626`) selalu dipasangkan dengan label teks yang jelas.
- **Tipografi & Hierarki**:
  - *Display / Judul*: `Plus Jakarta Sans` (SemiBold 600–Bold 700) untuk struktur navigasi dan judul halaman yang tegas.
  - *Body / Antarmuka*: `DM Sans` (Regular 400–Medium 500) untuk keterbacaan tinggi pada formulir dan daftar katalog.
  - *Angka & Finansial*: `JetBrains Mono` dengan `tabular-nums` wajib untuk seluruh nominal harga, stok, kuantitas, dan tabel laporan laba rugi agar rata kanan secara presisi.
- **Tata Letak & Kepadatan**:
  - Navigasi bilah atas (*Top Bar*) mengikuti kontrak 3 zona bersih: Nama Toko di kiri, 4 tautan navigasi utama di tengah (`Kasir`, `Katalog & QR`, `Stok Harian`, `Laporan`), dan pemilih Peran/Cadangan di kanan.
  - Responsif mengalir dari ponsel/tablet hingga desktop (1440px) dengan target sentuh minimal 44px dan fokus keyboard yang jelas.

---

## 3. Keputusan Produk & Pertimbangan Teknis

- **Keputusan 1: Pembuatan Kode QR Katalog Tanpa Ketergantungan API Eksternal**
  - *Pendekatan*: Menggunakan generator QR SVG mandiri di sisi klien serta mode pratinjau Katalog Pelanggan langsung di dalam aplikasi (dapat diakses juga melalui parameter URL `?view=menu`).
  - *Alasan*: Memastikan kode QR tetap dapat dibuat dan dicetak kapan saja meskipun koneksi internet kedai sedang tidak stabil.
- **Keputusan 2: Perhitungan HPP Historis pada Saat Transaksi**
  - *Pendekatan*: Menyimpan nilai `unitCost` (HPP) dan `unitPrice` (Harga Jual) langsung di setiap item baris transaksi (`OrderItem`) pada saat pesanan dibuat.
  - *Alasan*: Jika pemilik toko mengubah harga jual atau HPP produk di kemudian hari, laporan laba rugi dari transaksi hari-hari sebelumnya tetap akurat dan tidak berubah secara surut.

---

## 4. Arsitektur Teknis & Strategi Data

### Diagram Arsitektur & Komponen

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Top Navigation & Role Bar                         │
│  [Brand Toko]       [Kasir | Katalog & QR | Stok | Laporan]   [Peran]   │
└───────────────┬─────────────────┬──────────────────┬────────────┬───────┘
                │                 │                  │            │
                ▼                 ▼                  ▼            ▼
      ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
      │   Layar Kasir   │ │ Katalog & QR │ │ Stok Harian  │ │  Laporan &  │
      │      (POS)      │ │   Generator  │ │  & Opname    │ │  Cadangan   │
      └────────┬────────┘ └──────┬───────┘ └──────┬───────┘ └──────┬──────┘
               │                 │                │                │
               └─────────────────┴────────┬───────┴────────────────┘
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                State Store & Validation Layer (React State)             │
│  • Validasi Input & Stok   • Kalkulator Laba Rugi   • Otentikasi PIN    │
└─────────────────────────────────────────┬───────────────────────────────┘
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            Local Persistence & Backup Engine (localStorage)             │
│  • Auto-save State         • Ekspor JSON / CSV      • Impor & Validasi  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Model Data Utama
- **`Product` (Produk)**: `id`, `sku`, `name`, `category`, `price` (Harga Jual), `cost` (HPP/Modal), `stock` (Stok Saat Ini), `minStock` (Batas Peringatan), `unit` (cup/pcs/porsi), `isActive`.
- **`Transaction` (Transaksi Penjualan)**: `id`, `createdAt`, `cashierRole`, `items` (`productId`, `productName`, `quantity`, `unitPrice`, `unitCost`), `subtotal`, `discount`, `total`, `paymentMethod` (`TUNAI` | `QRIS` | `TRANSFER`), `cashReceived`, `changeAmount`.
- **`StockLog` (Catatan Pergerakan Stok)**: `id`, `productId`, `productName`, `type` (`IN_RESTOCK` | `OUT_SALE` | `OUT_WASTE` | `ADJUSTMENT`), `quantityChange`, `previousStock`, `newStock`, `unitCostImpact`, `note`, `createdAt`, `actorRole`.
- **`Expense` (Biaya Operasional Harian)**: `id`, `title`, `category` (`Bahan Tambahan` | `Kemasan` | `Utilitas` | `Lainnya`), `amount`, `date`, `note`.
- **`StoreSettings` (Pengaturan Toko)**: `storeName`, `storeAddress`, `storeNote`, `ownerPin`, `currency`.

### Pemetaan Interaksi & Penanganan Keadaan (State Mapping)
- **Keadaan Kosong (Empty States)**: Jika pencarian produk tidak ditemukan, keranjang masih kosong, atau belum ada transaksi pada periode terpilih, tampilkan keterangan yang jelas beserta tombol tindakan pemulihan (misal: *"Reset Filter"* atau *"Tambah Produk Pertama"*).
- **Validasi Masukan & Kesalahan**:
  - Formulir produk menolak harga jual/HPP negatif atau nama kosong dengan pesan petunjuk langsung di bawah kolom input.
  - Tombol tambah ke keranjang otomatis terkunci jika jumlah di keranjang sudah mencapai batas stok tersedia.
  - Impor file cadangan JSON memvalidasi struktur data terlebih dahulu dan menampilkan pesan kesalahan yang aman jika file rusak atau tidak sesuai format.
