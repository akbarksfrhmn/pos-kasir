import React, { useState, useMemo } from 'react';
import {
  FulfillmentStatus,
  OrderItem,
  PaymentMethod,
  Product,
  ProductCategory,
  StoreSettings,
  Transaction,
  UserRole,
} from '../types';
import { formatIDR, formatDateTimeID } from '../utils/storage';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Printer,
  RotateCcw,
  QrCode,
} from 'lucide-react';

interface PosViewProps {
  products: Product[];
  transactions: Transaction[];
  activeRole: UserRole;
  settings: StoreSettings;
  onCompleteTransaction: (trxData: {
    customerName: string;
    tableNumber: string;
    items: OrderItem[];
    subtotal: number;
    discount: number;
    total: number;
    totalCost: number;
    paymentMethod: PaymentMethod;
    cashReceived: number;
    changeAmount: number;
    note: string;
  }) => Transaction;
  onUpdateFulfillmentStatus: (trxId: string, status: FulfillmentStatus) => void;
  onNavigateToCatalog: () => void;
}

const CATEGORIES: ('Semua' | ProductCategory)[] = [
  'Semua',
  'Kopi',
  'Non-Kopi',
  'Makanan & Kue',
  'Biji Kopi & Retail',
];

export const PosView: React.FC<PosViewProps> = ({
  products,
  transactions,
  activeRole,
  settings,
  onCompleteTransaction,
  onUpdateFulfillmentStatus,
  onNavigateToCatalog,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | ProductCategory>('Semua');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('Meja 01');
  const [orderNote, setOrderNote] = useState('');
  const [discountInput, setDiscountInput] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TUNAI');
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<Transaction | null>(null);

  const tableOptions = useMemo(() => {
    const count = Math.max(1, settings.tableCount || 12);
    const list = Array.from({ length: count }, (_, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      return `Meja ${num}`;
    });
    list.unshift('Bawa Pulang (Takeaway)');
    return list;
  }, [settings.tableCount]);

  // Active incoming self-orders from Table QR that are BARU or DIPROSES
  const activeTableOrders = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.orderSource === 'MEJA_QR' &&
        (t.fulfillmentStatus === 'BARU' || t.fulfillmentStatus === 'DIPROSES')
    );
  }, [transactions]);

  const activeProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  const getCartQuantity = (productId: string): number => {
    const found = cart.find((item) => item.productId === productId);
    return found ? found.quantity : 0;
  };

  const handleAddToCart = (product: Product) => {
    setValidationError(null);
    const currentQty = getCartQuantity(product.id);
    if (currentQty + 1 > product.stock) {
      setValidationError(
        `Stok "${product.name}" tidak mencukupi. Tersisa ${product.stock} ${product.unit}.`
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
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

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setValidationError(null);
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty > product.stock) {
            setValidationError(
              `Maksimal stok tersedia untuk "${product.name}" adalah ${product.stock} ${product.unit}.`
            );
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleClearCart = () => {
    setCart([]);
    setCustomerName('');
    setOrderNote('');
    setDiscountInput('0');
    setCashReceivedInput('');
    setValidationError(null);
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const totalCost = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitCost * item.quantity, 0),
    [cart]
  );

  const parsedDiscount = Math.max(0, Number(discountInput) || 0);
  const validDiscount = Math.min(parsedDiscount, subtotal);
  const finalTotal = Math.max(0, subtotal - validDiscount);

  const parsedCash =
    paymentMethod === 'TUNAI'
      ? cashReceivedInput === ''
        ? finalTotal
        : Number(cashReceivedInput) || 0
      : finalTotal;

  const changeAmount = paymentMethod === 'TUNAI' ? parsedCash - finalTotal : 0;

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (cart.length === 0) {
      setValidationError('Pilih minimal satu produk ke dalam pesanan sebelum memproses pembayaran.');
      return;
    }

    if (parsedDiscount > subtotal) {
      setValidationError('Potongan diskon tidak boleh melebihi subtotal pesanan.');
      return;
    }

    for (const item of cart) {
      const liveProduct = products.find((p) => p.id === item.productId);
      if (!liveProduct || liveProduct.stock < item.quantity) {
        setValidationError(
          `Stok "${item.productName}" telah berubah. Sisa stok saat ini: ${liveProduct?.stock ?? 0}.`
        );
        return;
      }
    }

    if (paymentMethod === 'TUNAI' && parsedCash < finalTotal) {
      setValidationError(
        `Nominal uang tunai diterima (${formatIDR(parsedCash)}) kurang dari total tagihan (${formatIDR(finalTotal)}).`
      );
      return;
    }

    const trx = onCompleteTransaction({
      customerName: customerName.trim() || 'Pelanggan Umum',
      tableNumber,
      items: cart,
      subtotal,
      discount: validDiscount,
      total: finalTotal,
      totalCost,
      paymentMethod,
      cashReceived: parsedCash,
      changeAmount: Math.max(0, changeAmount),
      note: orderNote.trim(),
    });

    setCompletedReceipt(trx);
    handleClearCart();
  };

  return (
    <div className="space-y-8">
      {/* Live Queue of Incoming Self-Service Table QR Orders */}
      {activeTableOrders.length > 0 && (
        <section
          aria-label="Antrean Pesanan Mandiri QR Meja"
          className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-3">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#24634b]" />
              <h2 className="text-base font-bold text-zinc-900">
                Pesanan Masuk dari QR Meja ({activeTableOrders.length} Aktif)
              </h2>
            </div>
            <span className="text-xs text-zinc-500">
              Sudah dibayar langsung via QRIS oleh pelanggan dari meja masing-masing
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTableOrders.map((order) => (
              <div
                key={order.id}
                className="border border-zinc-200 rounded-xl p-4 flex flex-col justify-between bg-[#FAF9F6] space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-[#24634b]">
                      {order.tableNumber || 'Meja QR'} · {order.customerName}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
                      LUNAS {order.paymentMethod}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500 font-mono tabular-nums">
                    {order.receiptNumber} · {formatDateTimeID(order.createdAt)}
                  </div>

                  <div className="border-t border-zinc-200 pt-2 space-y-1 text-xs text-zinc-800">
                    {order.items.map((item) => (
                      <div key={item.productId} className="flex justify-between">
                        <span className="font-medium">
                          {item.quantity}x {item.productName}
                        </span>
                        <span className="font-mono tabular-nums text-zinc-600">
                          {formatIDR(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.note && (
                    <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200 rounded px-2.5 py-1.5">
                      Catatan: {order.note}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-200 flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-600">
                    Status:{' '}
                    <strong className="text-zinc-900">
                      {order.fulfillmentStatus === 'BARU' ? 'Pesanan Baru' : 'Sedang Disiapkan'}
                    </strong>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {order.fulfillmentStatus === 'BARU' && (
                      <button
                        type="button"
                        onClick={() => onUpdateFulfillmentStatus(order.id, 'DIPROSES')}
                        className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Siapkan Pesanan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onUpdateFulfillmentStatus(order.id, 'SELESAI')}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#24634b] text-white hover:bg-[#1d503d] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Selesai Diantar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Menu Selection (7 cols on desktop) */}
        <section aria-label="Daftar Menu Produk" className="lg:col-span-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Kasir & Pesanan</h1>
              <p className="text-sm text-zinc-600 mt-1">
                Catat pesanan langsung di kasir atau pantau pesanan mandiri dari QR meja pelanggan di atas.
              </p>
            </div>
            <div className="text-xs text-zinc-500 font-mono tabular-nums">
              {activeProducts.length} produk ditampilkan
            </div>
          </div>

          {/* Search and Category Filter Controls */}
          <div className="space-y-4">
            <div className="relative">
              <label htmlFor="pos-search-input" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Cari Nama Produk atau Kode SKU
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="pos-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik misal: Kopi Susu, Croissant, atau KOP-001..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#24634b] focus:border-transparent"
                />
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Filter Kategori Produk"
              className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-200/70 rounded-lg"
            >
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    role="tab"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[38px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24634b] ${
                      isSelected
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product List Grid */}
          {activeProducts.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center space-y-3">
              <p className="text-base font-medium text-zinc-900">Tidak ada produk yang cocok</p>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                Produk yang Anda cari mungkin belum ditambahkan ke katalog atau sedang dinonaktifkan.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                {(searchQuery || selectedCategory !== 'Semua') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('Semua');
                    }}
                    className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    Reset Pencarian
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNavigateToCatalog}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#24634b] rounded-lg hover:bg-[#1d503d] transition-colors whitespace-nowrap shrink-0"
                >
                  Kelola Katalog Produk
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {activeProducts.map((product) => {
                const inCartQty = getCartQuantity(product.id);
                const remainingStock = product.stock - inCartQty;
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= product.minStock;

                return (
                  <div
                    key={product.id}
                    className={`bg-white border rounded-xl p-4 flex flex-col justify-between transition-colors ${
                      inCartQty > 0
                        ? 'border-[#24634b] bg-[#24634b]/[0.02]'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2 text-xs text-zinc-500">
                        <span>{product.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{product.sku}</span>
                      </div>
                      <h2 className="text-base font-semibold text-zinc-900 mt-1 leading-snug">
                        {product.name}
                      </h2>
                      {product.description && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-100 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold font-mono tabular-nums text-zinc-900">
                          {formatIDR(product.price)}
                        </div>
                        <div className="text-xs mt-0.5 font-mono tabular-nums">
                          {isOutOfStock ? (
                            <span className="text-red-700 font-medium">
                              Stok habis (0 {product.unit})
                            </span>
                          ) : isLowStock ? (
                            <span className="text-amber-700 font-medium">
                              Stok menipis: {remainingStock} {product.unit}
                            </span>
                          ) : (
                            <span className="text-zinc-500">
                              Tersedia: {remainingStock} {product.unit}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock || remainingStock <= 0}
                        onClick={() => handleAddToCart(product)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[40px] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24634b] ${
                          isOutOfStock || remainingStock <= 0
                            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                            : 'bg-[#24634b] text-white hover:bg-[#1d503d]'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{inCartQty > 0 ? `Tambah (${inCartQty})` : 'Pilih'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Order Cart & Payment Panel (5 cols on desktop) */}
        <aside
          aria-label="Ringkasan Pesanan dan Pembayaran"
          className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Keranjang Kasir</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Peran aktif: {activeRole} · {cart.reduce((s, i) => s + i.quantity, 0)} item dipilih
              </p>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kosongkan</span>
              </button>
            )}
          </div>

          {validationError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="py-10 text-center space-y-2 border-b border-zinc-100">
              <p className="text-sm font-medium text-zinc-700">Belum ada produk dipilih</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Klik tombol "Pilih" pada daftar menu di samping untuk mencatat pesanan langsung di kasir.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.productId} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900 truncate">
                      {item.productName}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono tabular-nums mt-0.5">
                      {formatIDR(item.unitPrice)} × {item.quantity} {item.unit}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`Kurangi ${item.productName}`}
                      onClick={() => handleUpdateQuantity(item.productId, -1)}
                      className="w-8 h-8 rounded-md border border-zinc-300 flex items-center justify-center text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="w-7 text-center text-sm font-mono tabular-nums font-semibold text-zinc-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Tambah ${item.productName}`}
                      onClick={() => handleUpdateQuantity(item.productId, 1)}
                      className="w-8 h-8 rounded-md border border-zinc-300 flex items-center justify-center text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-24 text-right text-sm font-mono tabular-nums font-semibold text-zinc-900 shrink-0">
                    {formatIDR(item.unitPrice * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Order Details & Payment Form */}
          <form onSubmit={handleCheckout} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="customer-name" className="block text-xs font-medium text-zinc-700 mb-1">
                  Nama Pelanggan
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Misal: Budi"
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                />
              </div>
              <div>
                <label htmlFor="pos-table-select" className="block text-xs font-medium text-zinc-700 mb-1">
                  Nomor Meja / Layanan
                </label>
                <select
                  id="pos-table-select"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                >
                  {tableOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="discount-input" className="block text-xs font-medium text-zinc-700 mb-1">
                  Potongan Diskon (Rp)
                </label>
                <input
                  id="discount-input"
                  type="number"
                  min={0}
                  step={500}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                />
              </div>
              <div>
                <label htmlFor="order-note" className="block text-xs font-medium text-zinc-700 mb-1">
                  Catatan Pesanan
                </label>
                <input
                  id="order-note"
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Kurangi gula..."
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <span className="block text-xs font-medium text-zinc-700 mb-1.5">Metode Pembayaran</span>
              <div className="grid grid-cols-3 gap-2">
                {(['TUNAI', 'QRIS', 'TRANSFER'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                      paymentMethod === method
                        ? 'bg-[#24634b] text-white border-[#24634b]'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'TUNAI' && (
              <div className="space-y-2 pt-1">
                <label htmlFor="cash-received" className="block text-xs font-medium text-zinc-700">
                  Uang Tunai Diterima (Rp)
                </label>
                <input
                  id="cash-received"
                  type="number"
                  min={0}
                  step={1000}
                  value={cashReceivedInput}
                  onChange={(e) => setCashReceivedInput(e.target.value)}
                  placeholder={finalTotal > 0 ? String(finalTotal) : '0'}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                />
                {finalTotal > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[finalTotal, 20000, 50000, 100000]
                      .filter((v, idx, arr) => v >= finalTotal && arr.indexOf(v) === idx)
                      .map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCashReceivedInput(String(preset))}
                          className="px-2.5 py-1 text-xs font-mono tabular-nums bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          {preset === finalTotal ? 'Uang Pas' : formatIDR(preset)}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Totals Breakdown */}
            <div className="border-t border-zinc-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatIDR(subtotal)}</span>
              </div>
              {validDiscount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Potongan Diskon</span>
                  <span className="font-mono tabular-nums">-{formatIDR(validDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-zinc-900 pt-1 border-t border-zinc-100">
                <span>Total Tagihan</span>
                <span className="font-mono tabular-nums">{formatIDR(finalTotal)}</span>
              </div>
              {paymentMethod === 'TUNAI' && cart.length > 0 && (
                <div className="flex justify-between text-xs pt-1 text-zinc-600">
                  <span>Kembalian Tunai</span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      changeAmount < 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {changeAmount < 0
                      ? `Kurang ${formatIDR(Math.abs(changeAmount))}`
                      : formatIDR(changeAmount)}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={cart.length === 0}
              className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors min-h-[44px] whitespace-nowrap shrink-0 ${
                cart.length === 0
                  ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                  : 'bg-[#24634b] text-white hover:bg-[#1d503d]'
              }`}
            >
              Selesaikan & Simpan Transaksi ({formatIDR(finalTotal)})
            </button>
          </form>
        </aside>
      </div>

      {/* Receipt Modal on Completion */}
      {completedReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-dialog-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <h3 id="receipt-dialog-title" className="text-base font-bold text-zinc-900">
                    Transaksi Berhasil Disimpan
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono tabular-nums">
                    {completedReceipt.receiptNumber} · {formatDateTimeID(completedReceipt.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#FAF9F6] border border-zinc-200 rounded-lg p-4 space-y-3 text-xs">
              <div className="text-center border-b border-dashed border-zinc-300 pb-3">
                <div className="font-bold text-sm text-zinc-900">{settings.storeName}</div>
                <div className="text-zinc-500 mt-0.5">{settings.storeAddress}</div>
              </div>

              <div className="space-y-1 text-zinc-600 border-b border-dashed border-zinc-300 pb-2">
                <div className="flex justify-between">
                  <span>Pelanggan / Meja:</span>
                  <span className="font-medium text-zinc-900">
                    {completedReceipt.customerName} ({completedReceipt.tableNumber || 'Kasir'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pembayaran:</span>
                  <span className="font-mono tabular-nums font-medium text-zinc-900">
                    {completedReceipt.paymentMethod}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-2">
                {completedReceipt.items.map((item) => (
                  <div key={item.productId} className="flex justify-between gap-2">
                    <span className="text-zinc-800">
                      {item.quantity}x {item.productName}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-900 shrink-0">
                      {formatIDR(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatIDR(completedReceipt.subtotal)}</span>
                </div>
                {completedReceipt.discount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Diskon</span>
                    <span className="font-mono tabular-nums">-{formatIDR(completedReceipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-zinc-900 pt-1">
                  <span>Total Bayar</span>
                  <span className="font-mono tabular-nums">{formatIDR(completedReceipt.total)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Dibayar ({completedReceipt.paymentMethod})</span>
                  <span className="font-mono tabular-nums">{formatIDR(completedReceipt.cashReceived)}</span>
                </div>
                {completedReceipt.paymentMethod === 'TUNAI' && (
                  <div className="flex justify-between font-medium text-zinc-800">
                    <span>Kembalian</span>
                    <span className="font-mono tabular-nums">{formatIDR(completedReceipt.changeAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
