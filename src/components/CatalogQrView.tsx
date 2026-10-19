import React, { useState, useMemo } from 'react';
import { Product, ProductCategory, StoreSettings, UserRole } from '../types';
import { formatIDR } from '../utils/storage';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus,
  Edit3,
  Trash2,
  QrCode,
  Eye,
  Printer,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';

interface CatalogQrViewProps {
  products: Product[];
  settings: StoreSettings;
  activeRole: UserRole;
  onSaveProduct: (product: Omit<Product, 'id'>, existingId?: string) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleProductActive: (productId: string) => void;
  onUpdateTableCount: (count: number) => void;
  onOpenCustomerSelfOrder: (tableName: string) => void;
  onRequestOwnerAccess: (reason: string) => void;
}

const CATEGORIES: ProductCategory[] = ['Kopi', 'Non-Kopi', 'Makanan & Kue', 'Biji Kopi & Retail'];

export const CatalogQrView: React.FC<CatalogQrViewProps> = ({
  products,
  settings,
  activeRole,
  onSaveProduct,
  onDeleteProduct,
  onToggleProductActive,
  onUpdateTableCount,
  onOpenCustomerSelfOrder,
  onRequestOwnerAccess,
}) => {
  const [subView, setSubView] = useState<'DAFTAR' | 'QR_GENERATOR'>('DAFTAR');
  const [selectedQrTable, setSelectedQrTable] = useState<string>('Meja 01');
  const [printMode, setPrintMode] = useState<'SATU_MEJA' | 'SEMUA_MEJA'>('SATU_MEJA');
  const [tableCountInput, setTableCountInput] = useState<string>(String(settings.tableCount || 12));

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Kopi');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [unit, setUnit] = useState('cup');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const canSeeCost = activeRole === 'PEMILIK';

  const tableList = useMemo(() => {
    const count = Math.max(1, Math.min(50, settings.tableCount || 12));
    return Array.from({ length: count }, (_, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      return `Meja ${num}`;
    });
  }, [settings.tableCount]);

  const getTableOrderUrl = (tableName: string) => {
    const base = window.location.origin + window.location.pathname;
    const encodedTable = encodeURIComponent(tableName);
    return `${base}?view=menu&table=${encodedTable}`;
  };

  const handleSaveTableCount = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.max(1, Math.min(50, Number(tableCountInput) || 12));
    onUpdateTableCount(parsed);
    setTableCountInput(String(parsed));
    setFeedbackMessage(`Jumlah meja kedai berhasil diatur menjadi ${parsed} meja.`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const openNewProductForm = () => {
    const nextNum = String(products.length + 1).padStart(3, '0');
    setEditingProduct(null);
    setSku(`PRD-${nextNum}`);
    setName('');
    setCategory('Kopi');
    setPrice('');
    setCost('');
    setStock('20');
    setMinStock('5');
    setUnit('cup');
    setDescription('');
    setIsActive(true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditProductForm = (product: Product) => {
    setEditingProduct(product);
    setSku(product.sku);
    setName(product.name);
    setCategory(product.category);
    setPrice(String(product.price));
    setCost(String(product.cost));
    setStock(String(product.stock));
    setMinStock(String(product.minStock));
    setUnit(product.unit);
    setDescription(product.description || '');
    setIsActive(product.isActive);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedSku = sku.trim().toUpperCase();
    const parsedPrice = Number(price);
    const parsedCost = canSeeCost ? Number(cost) : editingProduct ? editingProduct.cost : 0;
    const parsedStock = Number(stock);
    const parsedMinStock = Number(minStock);

    if (!trimmedName) {
      setFormError('Nama produk wajib diisi.');
      return;
    }
    if (!trimmedSku) {
      setFormError('Kode SKU produk wajib diisi.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError('Harga jual harus berupa angka lebih dari Rp 0.');
      return;
    }
    if (isNaN(parsedCost) || parsedCost < 0) {
      setFormError('Harga pokok (HPP) tidak boleh bernilai negatif.');
      return;
    }
    if (parsedCost > parsedPrice) {
      setFormError('Perhatian: HPP melebihi Harga Jual. Pastikan nilai modal sudah benar.');
      return;
    }
    if (isNaN(parsedStock) || parsedStock < 0) {
      setFormError('Stok awal tidak boleh negatif.');
      return;
    }

    onSaveProduct(
      {
        sku: trimmedSku,
        name: trimmedName,
        category,
        price: parsedPrice,
        cost: parsedCost,
        stock: parsedStock,
        minStock: Math.max(0, parsedMinStock || 0),
        unit: unit.trim() || 'pcs',
        isActive,
        description: description.trim(),
      },
      editingProduct?.id
    );

    setIsFormOpen(false);
    setFeedbackMessage(
      editingProduct
        ? `Produk "${trimmedName}" berhasil diperbarui.`
        : `Produk baru "${trimmedName}" berhasil ditambahkan ke katalog.`
    );
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Section Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Katalog Produk & Generator QR Per Meja
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Kelola daftar harga menu serta cetak kode QR unik per nomor meja agar pelanggan dapat memesan dan membayar langsung via QRIS tanpa antre di kasir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-zinc-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setSubView('DAFTAR')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'DAFTAR'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Tabel Katalog ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('QR_GENERATOR')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                subView === 'QR_GENERATOR'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Generator QR Per Meja</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenCustomerSelfOrder(selectedQrTable)}
            className="px-3.5 py-2 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors min-h-[38px] whitespace-nowrap shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Simulasi Pesan dari {selectedQrTable}</span>
          </button>

          <button
            type="button"
            onClick={openNewProductForm}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg flex items-center gap-1.5 transition-colors min-h-[38px] whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div
          role="status"
          className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 no-print"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* SUBVIEW 1: PRODUCT TABLE */}
      {subView === 'DAFTAR' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {!canSeeCost && (
            <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-4 text-xs text-zinc-600">
              <span>
                Kolom Harga Pokok (HPP) dan Margin Laba disembunyikan pada peran{' '}
                <strong>{activeRole}</strong>.
              </span>
              <button
                type="button"
                onClick={() => onRequestOwnerAccess('Melihat dan mengubah HPP Katalog')}
                className="text-[#24634b] font-semibold hover:underline whitespace-nowrap shrink-0"
              >
                Buka Akses Pemilik (PIN)
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                  <th className="py-3.5 px-4">Produk & SKU</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4 text-right">Harga Jual</th>
                  {canSeeCost && <th className="py-3.5 px-4 text-right">HPP (Modal)</th>}
                  {canSeeCost && <th className="py-3.5 px-4 text-right">Margin Kotor</th>}
                  <th className="py-3.5 px-4 text-right">Stok Saat Ini</th>
                  <th className="py-3.5 px-4">Status Menu</th>
                  <th className="py-3.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm">
                {products.map((product) => {
                  const marginRp = product.price - product.cost;
                  const marginPct =
                    product.price > 0 ? Math.round((marginRp / product.price) * 100) : 0;
                  const isLow = product.stock <= product.minStock;

                  return (
                    <tr key={product.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900">{product.name}</div>
                        <div className="text-xs text-zinc-500 font-mono tabular-nums">
                          {product.sku}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 text-xs">{product.category}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-zinc-900">
                        {formatIDR(product.price)}
                      </td>
                      {canSeeCost && (
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-600">
                          {formatIDR(product.cost)}
                        </td>
                      )}
                      {canSeeCost && (
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 text-xs">
                          +{formatIDR(marginRp)} ({marginPct}%)
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className={isLow ? 'text-amber-700 font-semibold' : 'text-zinc-900'}>
                          {product.stock} {product.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <button
                          type="button"
                          onClick={() => onToggleProductActive(product.id)}
                          className={`font-medium hover:underline whitespace-nowrap shrink-0 ${
                            product.isActive ? 'text-emerald-700' : 'text-zinc-400'
                          }`}
                        >
                          {product.isActive ? 'Aktif di Menu' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditProductForm(product)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
                            title="Ubah Produk"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {canSeeCost && (
                            <button
                              type="button"
                              onClick={() => onDeleteProduct(product.id)}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: TABLE-SPECIFIC QR CODE GENERATOR */}
      {subView === 'QR_GENERATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Configuration Panel (hidden when printing) */}
          <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 space-y-5 no-print">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Generator QR Pesan & Bayar Per Meja</h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                Setiap meja memiliki kode QR unik. Saat dipindai pelanggan, aplikasi otomatis mengunci nomor meja tersebut, memungkinkan pelanggan memilih menu dan langsung membayar via QRIS tanpa antre di kasir.
              </p>
            </div>

            {/* Set total table count */}
            <form onSubmit={handleSaveTableCount} className="flex items-end gap-2 pt-1">
              <div className="flex-1">
                <label htmlFor="table-count-input" className="block text-xs font-medium text-zinc-700 mb-1">
                  Jumlah Meja di Kedai (Maks 50)
                </label>
                <input
                  id="table-count-input"
                  type="number"
                  min={1}
                  max={50}
                  value={tableCountInput}
                  onChange={(e) => setTableCountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg min-h-[38px] whitespace-nowrap shrink-0"
              >
                Simpan Jumlah Meja
              </button>
            </form>

            {/* Select Display Mode: Single Table vs All Tables */}
            <div className="space-y-2 pt-2 border-t border-zinc-200">
              <span className="block text-xs font-medium text-zinc-700">Mode Tampilan & Cetak QR</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintMode('SATU_MEJA')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    printMode === 'SATU_MEJA'
                      ? 'bg-[#24634b] text-white border-[#24634b]'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  Pilih Satu Meja
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('SEMUA_MEJA')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    printMode === 'SEMUA_MEJA'
                      ? 'bg-[#24634b] text-white border-[#24634b]'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  Semua Meja ({tableList.length})
                </button>
              </div>
            </div>

            {printMode === 'SATU_MEJA' && (
              <div>
                <label htmlFor="select-qr-table" className="block text-xs font-medium text-zinc-700 mb-1">
                  Pilih Nomor Meja
                </label>
                <select
                  id="select-qr-table"
                  value={selectedQrTable}
                  onChange={(e) => setSelectedQrTable(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-lg text-sm font-semibold text-zinc-900"
                >
                  {tableList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1">
              <div className="text-xs font-medium text-zinc-500">
                Tautan QR untuk {selectedQrTable}
              </div>
              <div className="text-xs font-mono text-zinc-800 break-all">
                {getTableOrderUrl(selectedQrTable)}
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {printMode === 'SATU_MEJA'
                    ? `Cetak QR ${selectedQrTable}`
                    : `Cetak Semua (${tableList.length} Meja)`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenCustomerSelfOrder(selectedQrTable)}
                className="px-4 py-2.5 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Uji Pesan & Bayar dari {selectedQrTable}
              </button>
            </div>
          </div>

          {/* Right Printable QR Preview */}
          <div className="lg:col-span-7">
            {printMode === 'SATU_MEJA' ? (
              <div className="flex justify-center">
                <div className="bg-white border border-zinc-300 rounded-2xl p-8 max-w-sm w-full text-center space-y-5 shadow-xs">
                  <div className="space-y-1 border-b border-zinc-200 pb-4">
                    <div className="text-xs uppercase tracking-widest text-[#24634b] font-semibold">
                      Pesan & Bayar Tanpa Antre
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900">{settings.storeName}</h3>
                    <div className="text-base font-bold font-mono text-zinc-800 pt-1">
                      {selectedQrTable}
                    </div>
                  </div>

                  <div className="py-2 flex justify-center">
                    <div className="p-4 bg-white border border-zinc-200 rounded-xl inline-block">
                      <QRCodeSVG
                        value={getTableOrderUrl(selectedQrTable)}
                        size={200}
                        bgColor="#FFFFFF"
                        fgColor="#18181B"
                        level="M"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-zinc-600 border-t border-zinc-200 pt-4">
                    <p className="font-semibold text-zinc-900">
                      1. Pindai QR · 2. Pilih Menu · 3. Bayar via QRIS
                    </p>
                    <p>Pesanan Anda akan langsung disiapkan dan diantar ke {selectedQrTable}.</p>
                    {settings.wifiInfo && (
                      <p className="font-mono text-zinc-500 pt-1">Wi-Fi: {settings.wifiInfo}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tableList.map((tName) => (
                  <div
                    key={tName}
                    className="bg-white border border-zinc-300 rounded-xl p-5 text-center space-y-3"
                  >
                    <div className="border-b border-zinc-200 pb-2">
                      <div className="text-[11px] font-semibold text-[#24634b] uppercase">
                        {settings.storeName}
                      </div>
                      <div className="text-lg font-bold font-mono text-zinc-900">{tName}</div>
                    </div>

                    <div className="flex justify-center py-1">
                      <QRCodeSVG
                        value={getTableOrderUrl(tName)}
                        size={140}
                        bgColor="#FFFFFF"
                        fgColor="#18181B"
                        level="M"
                      />
                    </div>

                    <div className="text-[11px] text-zinc-600">
                      Pindai untuk Pesan & Bayar QRIS dari <strong>{tName}</strong>
                    </div>

                    <div className="pt-1 no-print">
                      <button
                        type="button"
                        onClick={() => onOpenCustomerSelfOrder(tName)}
                        className="text-xs font-medium text-[#24634b] hover:underline"
                      >
                        Simulasikan {tName} →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Modal Form */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-form-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 id="product-form-title" className="text-lg font-bold text-zinc-900">
                {editingProduct ? `Ubah Produk: ${editingProduct.name}` : 'Tambah Produk Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="prod-sku" className="block text-xs font-medium text-zinc-700 mb-1">
                    Kode SKU *
                  </label>
                  <input
                    id="prod-sku"
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono uppercase text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="prod-name" className="block text-xs font-medium text-zinc-700 mb-1">
                    Nama Produk / Menu *
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Es Kopi Susu Aren"
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="prod-category"
                    className="block text-xs font-medium text-zinc-700 mb-1"
                  >
                    Kategori Menu
                  </label>
                  <select
                    id="prod-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-unit" className="block text-xs font-medium text-zinc-700 mb-1">
                    Satuan Unit
                  </label>
                  <input
                    id="prod-unit"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="cup, pcs, bungkus"
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="prod-price"
                    className="block text-xs font-medium text-zinc-700 mb-1"
                  >
                    Harga Jual (Rp) *
                  </label>
                  <input
                    id="prod-price"
                    type="number"
                    required
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  />
                </div>
                {canSeeCost && (
                  <div>
                    <label
                      htmlFor="prod-cost"
                      className="block text-xs font-medium text-zinc-700 mb-1"
                    >
                      Harga Pokok / HPP (Rp) *
                    </label>
                    <input
                      id="prod-cost"
                      type="number"
                      required
                      min={0}
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="prod-stock"
                    className="block text-xs font-medium text-zinc-700 mb-1"
                  >
                    Stok Saat Ini
                  </label>
                  <input
                    id="prod-stock"
                    type="number"
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prod-min-stock"
                    className="block text-xs font-medium text-zinc-700 mb-1"
                  >
                    Batas Peringatan Stok Menipis
                  </label>
                  <input
                    id="prod-min-stock"
                    type="number"
                    min={0}
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prod-desc" className="block text-xs font-medium text-zinc-700 mb-1">
                  Deskripsi Singkat untuk Katalog QR
                </label>
                <textarea
                  id="prod-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Komposisi singkat atau catatan rasa..."
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="prod-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-[#24634b] focus:ring-[#24634b]"
                />
                <label htmlFor="prod-active" className="text-xs font-medium text-zinc-800">
                  Tampilkan produk ini di layar Kasir & Katalog QR Pelanggan
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
