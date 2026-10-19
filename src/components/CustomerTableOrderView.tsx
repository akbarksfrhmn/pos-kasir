import React, { useState, useMemo } from 'react';
import {
  OrderItem,
  PaymentMethod,
  Product,
  ProductCategory,
  StoreSettings,
  Transaction,
} from '../types';
import { formatIDR, formatDateTimeID } from '../utils/storage';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Search,
  ArrowLeft,
  Printer,
  ShoppingBag,
} from 'lucide-react';

interface CustomerTableOrderViewProps {
  products: Product[];
  settings: StoreSettings;
  initialTable: string;
  onPlaceTableOrder: (orderData: {
    customerName: string;
    tableNumber: string;
    items: OrderItem[];
    subtotal: number;
    total: number;
    totalCost: number;
    paymentMethod: PaymentMethod;
    paymentReference: string;
    note: string;
  }) => Transaction;
  onExitToStaffMode?: () => void;
}

const CATEGORIES: ('Semua' | ProductCategory)[] = [
  'Semua',
  'Kopi',
  'Non-Kopi',
  'Makanan & Kue',
  'Biji Kopi & Retail',
];

export const CustomerTableOrderView: React.FC<CustomerTableOrderViewProps> = ({
  products,
  settings,
  initialTable,
  onPlaceTableOrder,
  onExitToStaffMode,
}) => {
  const [selectedTable, setSelectedTable] = useState<string>(initialTable || 'Meja 01');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | ProductCategory>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');

  // Checkout & QRIS Payment Step: 'MENU' | 'PAYMENT_QR' | 'RECEIPT'
  const [step, setStep] = useState<'MENU' | 'PAYMENT_QR' | 'RECEIPT'>('MENU');
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'TRANSFER'>('QRIS');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedTrx, setCompletedTrx] = useState<Transaction | null>(null);

  const tableOptions = useMemo(() => {
    const count = Math.max(1, settings.tableCount || 12);
    const list = Array.from({ length: count }, (_, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      return `Meja ${num}`;
    });
    list.push('Bawa Pulang (Takeaway)');
    return list;
  }, [settings.tableCount]);

  const activeProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      const matchesCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q));
      return matchesCat && matchesQ;
    });
  }, [products, selectedCategory, searchQuery]);

  const getCartQuantity = (productId: string): number => {
    const item = cart.find((i) => i.productId === productId);
    return item ? item.quantity : 0;
  };

  const handleAddItem = (product: Product) => {
    setErrorMsg(null);
    const currentQty = getCartQuantity(product.id);
    if (currentQty + 1 > product.stock) {
      setErrorMsg(`Stok "${product.name}" hanya tersisa ${product.stock} ${product.unit}.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          unitCost: product.cost,
          unit: product.unit,
        },
      ];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setErrorMsg(null);
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const next = item.quantity + delta;
          if (next > product.stock) {
            setErrorMsg(`Stok maksimal "${product.name}" adalah ${product.stock} ${product.unit}.`);
            return item;
          }
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cart]);
  const totalCost = useMemo(() => cart.reduce((s, i) => s + i.unitCost * i.quantity, 0), [cart]);

  // Dynamic QRIS payload string for the customer's exact order total and table
  const qrisPayload = useMemo(() => {
    const refId = `QRIS-${selectedTable.replace(/\s+/g, '').toUpperCase()}-${subtotal}`;
    return `00020101021226580016ID.CO.QRIS.WWW0118${settings.qrisNmid}520458125303360540${subtotal}5802ID5925${settings.qrisMerchantName.slice(0, 24)}6007BANDUNG62180114${refId}6304A1B2`;
  }, [selectedTable, subtotal, settings.qrisNmid, settings.qrisMerchantName]);

  const handleProceedToPaymentQr = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Pilih minimal 1 menu untuk melanjutkan ke pembayaran QR.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMsg('Silakan isi Nama Pemesan agar barista dapat memanggil atau mengantar pesanan ke meja Anda.');
      return;
    }

    // Re-check live stock
    for (const item of cart) {
      const live = products.find((p) => p.id === item.productId);
      if (!live || live.stock < item.quantity) {
        setErrorMsg(`Maaf, stok "${item.productName}" baru saja habis atau berkurang.`);
        return;
      }
    }

    setStep('PAYMENT_QR');
  };

  const handleConfirmQrPaymentSuccess = () => {
    const refCode = `QRIS-${String(Date.now()).slice(-6)}`;
    const trx = onPlaceTableOrder({
      customerName: customerName.trim(),
      tableNumber: selectedTable,
      items: cart,
      subtotal,
      total: subtotal,
      totalCost,
      paymentMethod,
      paymentReference: refCode,
      note: orderNote.trim(),
    });

    setCompletedTrx(trx);
    setCart([]);
    setStep('RECEIPT');
  };

  // STEP 3: DIGITAL RECEIPT & ORDER STATUS
  if (step === 'RECEIPT' && completedTrx) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 my-4">
        <div className="flex items-start gap-3 border-b border-zinc-200 pb-5">
          <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-emerald-700">
              Pembayaran QR Berhasil Dikonfirmasi
            </div>
            <h1 className="text-xl font-bold text-zinc-900 mt-0.5">
              Pesanan Anda Sedang Disiapkan
            </h1>
            <p className="text-xs text-zinc-600 mt-1">
              Tidak perlu antre di kasir. Barista kami telah menerima pesanan untuk{' '}
              <strong>{completedTrx.tableNumber}</strong> atas nama{' '}
              <strong>{completedTrx.customerName}</strong>.
            </p>
          </div>
        </div>

        {/* Receipt Box */}
        <div className="bg-[#FAF9F6] border border-zinc-200 rounded-xl p-5 space-y-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-dashed border-zinc-300 pb-3">
            <div>
              <div className="font-bold text-sm text-zinc-900">{settings.storeName}</div>
              <div className="text-zinc-500">{settings.storeAddress}</div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="font-bold text-zinc-900">{completedTrx.tableNumber}</div>
              <div className="text-zinc-500">{completedTrx.receiptNumber}</div>
            </div>
          </div>

          <div className="space-y-1 text-zinc-600 border-b border-dashed border-zinc-300 pb-2.5">
            <div className="flex justify-between">
              <span>Nama Pemesan</span>
              <span className="font-semibold text-zinc-900">{completedTrx.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu Pesan</span>
              <span className="font-mono tabular-nums text-zinc-800">
                {formatDateTimeID(completedTrx.createdAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Metode & Ref</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-700">
                LUNAS ({completedTrx.paymentMethod} · {completedTrx.paymentReference})
              </span>
            </div>
          </div>

          <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-2.5">
            {completedTrx.items.map((item) => (
              <div key={item.productId} className="flex justify-between gap-2">
                <span className="text-zinc-800">
                  {item.quantity}x {item.productName}
                </span>
                <span className="font-mono tabular-nums text-zinc-900 font-medium shrink-0">
                  {formatIDR(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1">
            <span>Total Dibayar</span>
            <span className="font-mono tabular-nums">{formatIDR(completedTrx.total)}</span>
          </div>

          {completedTrx.note && (
            <div className="pt-2 border-t border-dashed border-zinc-300 text-zinc-600">
              Catatan Barista: {completedTrx.note}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Simpan / Cetak Bukti</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCompletedTrx(null);
              setOrderNote('');
              setStep('MENU');
            }}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Pesan Menu Tambahan di {selectedTable}
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: DIRECT QRIS PAYMENT AT TABLE
  if (step === 'PAYMENT_QR') {
    return (
      <div className="max-w-lg mx-auto bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 my-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <button
            type="button"
            onClick={() => setStep('MENU')}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ubah Pesanan</span>
          </button>
          <span className="text-xs font-mono font-semibold text-[#24634b]">
            {selectedTable} · {customerName}
          </span>
        </div>

        <div className="text-center space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#24634b]">
            Pembayaran Mandiri Tanpa Antre
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Pindai QRIS untuk Membayar</h1>
          <p className="text-xs text-zinc-500">
            Mendukung semua aplikasi Mobile Banking & E-Wallet (GoPay, OVO, Dana, ShopeePay, BCA, Mandiri, BRI)
          </p>
        </div>

        {/* QRIS Box */}
        <div className="bg-[#FAF9F6] border border-zinc-200 rounded-2xl p-6 text-center space-y-4">
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-zinc-900">{settings.qrisMerchantName}</div>
            <div className="text-xs font-mono text-zinc-500">NMID: {settings.qrisNmid}</div>
          </div>

          <div className="p-4 bg-white border border-zinc-200 rounded-xl inline-block">
            <QRCodeSVG
              value={qrisPayload}
              size={210}
              bgColor="#FFFFFF"
              fgColor="#18181B"
              level="M"
            />
          </div>

          <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm">
            <span className="text-zinc-600">Total Nominal Otomatis</span>
            <span className="text-lg font-bold font-mono tabular-nums text-zinc-900">
              {formatIDR(subtotal)}
            </span>
          </div>
        </div>

        {/* Order Summary Snippet */}
        <div className="border border-zinc-200 rounded-xl p-4 space-y-2 text-xs">
          <div className="font-semibold text-zinc-900">
            Ringkasan Pesanan ({totalItems} item — {selectedTable})
          </div>
          <div className="divide-y divide-zinc-100">
            {cart.map((item) => (
              <div key={item.productId} className="py-1.5 flex justify-between text-zinc-700">
                <span>
                  {item.quantity}x {item.productName}
                </span>
                <span className="font-mono tabular-nums">{formatIDR(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleConfirmQrPaymentSuccess}
            className="w-full py-3.5 px-4 bg-[#24634b] hover:bg-[#1d503d] text-white text-sm font-semibold rounded-xl transition-colors min-h-[46px] flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Saya Sudah Bayar — Kirim Pesanan ke Dapur ({formatIDR(subtotal)})</span>
          </button>
          <p className="text-[11px] text-center text-zinc-500">
            Pesanan akan otomatis masuk ke layar Kasir & Barista beserta nomor meja Anda setelah tombol di atas ditekan.
          </p>
        </div>
      </div>
    );
  }

  // STEP 1: SELF-ORDER MENU AT TABLE
  return (
    <div className="space-y-6">
      {/* Customer Store & Table Banner */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#24634b] font-semibold">
            <QrCode className="w-3.5 h-3.5" />
            <span>Pesan & Bayar Langsung dari Meja (Self-Order QR)</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mt-1">{settings.storeName}</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {settings.storeTagline} · {settings.storeAddress}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="customer-table-select" className="block text-[11px] font-medium text-zinc-500 mb-1">
              Lokasi Meja Anda
            </label>
            <select
              id="customer-table-select"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="px-3 py-2 bg-[#FAF9F6] border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
            >
              {tableOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {onExitToStaffMode && (
            <button
              type="button"
              onClick={onExitToStaffMode}
              className="px-3 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors self-end whitespace-nowrap shrink-0"
            >
              Kembali ke Layar Staf
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Menu Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Search & Category Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Cari menu"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kopi, matcha, croissant..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-200/70 rounded-lg">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeProducts.map((product) => {
              const qtyInCart = getCartQuantity(product.id);
              const remaining = product.stock - qtyInCart;
              const isOut = product.stock <= 0;

              return (
                <div
                  key={product.id}
                  className={`bg-white border rounded-xl p-4 flex flex-col justify-between transition-colors ${
                    qtyInCart > 0
                      ? 'border-[#24634b] bg-[#24634b]/[0.02]'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div>
                    <div className="text-xs text-zinc-500">{product.category}</div>
                    <h2 className="text-base font-semibold text-zinc-900 mt-0.5">
                      {product.name}
                    </h2>
                    {product.description && (
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-base font-bold font-mono tabular-nums text-zinc-900">
                        {formatIDR(product.price)}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono tabular-nums mt-0.5">
                        {isOut ? (
                          <span className="text-red-700 font-medium">Habis Terjual</span>
                        ) : (
                          <span>Tersedia: {remaining} {product.unit}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isOut || remaining <= 0}
                      onClick={() => handleAddItem(product)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[38px] whitespace-nowrap shrink-0 ${
                        isOut || remaining <= 0
                          ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                          : 'bg-[#24634b] text-white hover:bg-[#1d503d]'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{qtyInCart > 0 ? `Tambah (${qtyInCart})` : 'Pesan'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Customer Table Cart & Direct QR Checkout (5 cols) */}
        <aside className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 space-y-5 sticky top-20">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3.5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#24634b]" />
              <div>
                <h2 className="text-base font-bold text-zinc-900">Pesanan {selectedTable}</h2>
                <p className="text-xs text-zinc-500">{totalItems} item dipilih</p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="py-8 text-center space-y-1.5 border-b border-zinc-100">
              <p className="text-sm font-medium text-zinc-700">Keranjang meja masih kosong</p>
              <p className="text-xs text-zinc-500">
                Pilih makanan atau minuman untuk memesan langsung dari {selectedTable} tanpa antre di kasir.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-64 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900 truncate">{item.productName}</div>
                    <div className="text-xs text-zinc-500 font-mono tabular-nums">
                      {formatIDR(item.unitPrice)} × {item.quantity}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.productId, -1)}
                      className="w-7 h-7 rounded border border-zinc-300 flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="w-6 text-center text-xs font-mono tabular-nums font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.productId, 1)}
                      className="w-7 h-7 rounded border border-zinc-300 flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-20 text-right text-xs font-mono tabular-nums font-semibold text-zinc-900 shrink-0">
                    {formatIDR(item.unitPrice * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleProceedToPaymentQr} className="space-y-3.5 pt-1">
            <div>
              <label htmlFor="self-cust-name" className="block text-xs font-medium text-zinc-700 mb-1">
                Nama Pemesan *
              </label>
              <input
                id="self-cust-name"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama Anda..."
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
              />
            </div>

            <div>
              <label htmlFor="self-order-note" className="block text-xs font-medium text-zinc-700 mb-1">
                Catatan Pesanan (Opsional)
              </label>
              <input
                id="self-order-note"
                type="text"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Misal: Less sugar, es dipisah..."
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
              />
            </div>

            <div className="border-t border-zinc-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-600">Total Pembayaran</span>
              <span className="text-lg font-bold font-mono tabular-nums text-zinc-900">
                {formatIDR(subtotal)}
              </span>
            </div>

            <button
              type="submit"
              disabled={cart.length === 0}
              className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px] ${
                cart.length === 0
                  ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                  : 'bg-[#24634b] text-white hover:bg-[#1d503d]'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Lanjut Bayar via QRIS ({formatIDR(subtotal)})</span>
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
};
