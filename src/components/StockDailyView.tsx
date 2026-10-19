import React, { useState, useMemo } from 'react';
import { Product, StockLog, StockMovementType, UserRole } from '../types';
import { formatIDR, formatDateTimeID } from '../utils/storage';
import { Plus, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, SlidersHorizontal } from 'lucide-react';

interface StockDailyViewProps {
  products: Product[];
  stockLogs: StockLog[];
  activeRole: UserRole;
  onRecordStockMovement: (movement: {
    productId: string;
    type: StockMovementType;
    quantityChange: number;
    note: string;
  }) => void;
}

export const StockDailyView: React.FC<StockDailyViewProps> = ({
  products,
  stockLogs,
  activeRole,
  onRecordStockMovement,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [movementType, setMovementType] = useState<'IN_RESTOCK' | 'OUT_WASTE' | 'ADJUSTMENT'>('IN_RESTOCK');
  const [quantityInput, setQuantityInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [stockFilter, setStockFilter] = useState<'SEMUA' | 'MENIPIS' | 'HABIS'>('SEMUA');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length,
    [products]
  );

  const outOfStockCount = useMemo(
    () => products.filter((p) => p.stock <= 0).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (stockFilter === 'MENIPIS') return p.stock > 0 && p.stock <= p.minStock;
      if (stockFilter === 'HABIS') return p.stock <= 0;
      return true;
    });
  }, [products, stockFilter]);

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedProduct) {
      setErrorMsg('Pilih produk terlebih dahulu.');
      return;
    }

    const parsedQty = Number(quantityInput);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMsg('Masukkan jumlah unit berupa angka bulat lebih dari 0.');
      return;
    }

    if (movementType === 'OUT_WASTE' && parsedQty > selectedProduct.stock) {
      setErrorMsg(
        `Jumlah barang rusak/terbuang (${parsedQty}) melebihi sisa stok saat ini (${selectedProduct.stock} ${selectedProduct.unit}).`
      );
      return;
    }

    if (!noteInput.trim()) {
      setErrorMsg('Harap isi keterangan singkat (misal: Produksi pagi, produk basi, atau koreksi fisik).');
      return;
    }

    let delta = parsedQty;
    if (movementType === 'OUT_WASTE') {
      delta = -parsedQty;
    } else if (movementType === 'ADJUSTMENT') {
      // In ADJUSTMENT mode, parsedQty is treated as the new actual physical stock count
      delta = parsedQty - selectedProduct.stock;
      if (delta === 0) {
        setErrorMsg('Stok fisik yang dimasukkan sama dengan stok tercatat saat ini.');
        return;
      }
    }

    onRecordStockMovement({
      productId: selectedProduct.id,
      type: movementType,
      quantityChange: delta,
      note: noteInput.trim(),
    });

    setQuantityInput('');
    setNoteInput('');
    setSuccessMsg(
      `Pergerakan stok untuk "${selectedProduct.name}" berhasil dicatat oleh ${activeRole}.`
    );
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Pencatatan Stok Harian</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Catat stok masuk dari dapur/produksi, barang rusak atau terbuang (waste), serta pantau batas peringatan stok minimum.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-zinc-600">
          <span>Total Menu: {products.length}</span>
          <span aria-hidden="true">·</span>
          <span className={lowStockCount > 0 ? 'text-amber-700 font-semibold' : ''}>
            Stok Menipis: {lowStockCount}
          </span>
          <span aria-hidden="true">·</span>
          <span className={outOfStockCount > 0 ? 'text-red-700 font-semibold' : ''}>
            Stok Habis: {outOfStockCount}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Daily Stock Input Form (5 cols) */}
        <section aria-label="Formulir Pergerakan Stok" className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Input Pergerakan Stok</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Dicatat sebagai peran: <strong>{activeRole}</strong>
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleMovementSubmit} className="space-y-4">
            <div>
              <label htmlFor="stock-product-select" className="block text-xs font-medium text-zinc-700 mb-1">
                Pilih Produk
              </label>
              <select
                id="stock-product-select"
                value={selectedProduct?.id || ''}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Sisa: {p.stock} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-zinc-700 mb-1.5">Jenis Pencatatan</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('IN_RESTOCK')}
                  className={`py-2 px-2.5 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                    movementType === 'IN_RESTOCK'
                      ? 'bg-[#24634b] text-white border-[#24634b]'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Stok Masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('OUT_WASTE')}
                  className={`py-2 px-2.5 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                    movementType === 'OUT_WASTE'
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Rusak / Waste</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('ADJUSTMENT')}
                  className={`py-2 px-2.5 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                    movementType === 'ADJUSTMENT'
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Opname Fisik</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="stock-qty-input" className="block text-xs font-medium text-zinc-700 mb-1">
                {movementType === 'IN_RESTOCK'
                  ? `Jumlah Unit Masuk (${selectedProduct?.unit || 'unit'}) *`
                  : movementType === 'OUT_WASTE'
                  ? `Jumlah Unit Rusak/Terbuang (${selectedProduct?.unit || 'unit'}) *`
                  : `Total Stok Fisik Sebenarnya (${selectedProduct?.unit || 'unit'}) *`}
              </label>
              <input
                id="stock-qty-input"
                type="number"
                min={1}
                step={1}
                required
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder={
                  movementType === 'ADJUSTMENT'
                    ? `Stok tercatat saat ini: ${selectedProduct?.stock ?? 0}`
                    : 'Masukkan angka, misal: 15'
                }
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
              />
              {movementType === 'OUT_WASTE' && selectedProduct && Number(quantityInput) > 0 && (
                <p className="text-xs text-red-700 mt-1 font-mono tabular-nums">
                  Beban kerugian HPP: {formatIDR(Number(quantityInput) * selectedProduct.cost)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="stock-note-input" className="block text-xs font-medium text-zinc-700 mb-1">
                Catatan / Alasan *
              </label>
              <input
                id="stock-note-input"
                type="text"
                required
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={
                  movementType === 'IN_RESTOCK'
                    ? 'Contoh: Tambahan seduhan batch siang'
                    : movementType === 'OUT_WASTE'
                    ? 'Contoh: Tumpah saat penyajian / lewat batas simpan'
                    : 'Contoh: Penyesuaian perhitungan tutup kedai'
                }
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#24634b] hover:bg-[#1d503d] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors min-h-[42px] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Catatan Stok</span>
            </button>
          </form>
        </section>

        {/* Right Column: Current Stock Table & Movement History (7 cols) */}
        <section aria-label="Status Stok dan Riwayat" className="lg:col-span-7 space-y-6">
          {/* Stock Status Card */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-zinc-900">Status Persediaan Produk</h2>
              <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
                {(['SEMUA', 'MENIPIS', 'HABIS'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStockFilter(f)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      stockFilter === f ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {f === 'SEMUA' ? 'Semua' : f === 'MENIPIS' ? `Menipis (${lowStockCount})` : `Habis (${outOfStockCount})`}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-zinc-800">Tidak ada produk pada filter ini</p>
                <p className="text-xs text-zinc-500">Semua persediaan produk berada dalam batas aman.</p>
                {stockFilter !== 'SEMUA' && (
                  <button
                    type="button"
                    onClick={() => setStockFilter('SEMUA')}
                    className="mt-2 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md"
                  >
                    Tampilkan Semua Produk
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                      <th className="py-3 px-4">Produk</th>
                      <th className="py-3 px-4 text-right">Batas Min.</th>
                      <th className="py-3 px-4 text-right">Sisa Stok</th>
                      <th className="py-3 px-4">Keterangan</th>
                      <th className="py-3 px-4 text-right">Aksi Cepat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-sm">
                    {filteredProducts.map((p) => {
                      const isOut = p.stock <= 0;
                      const isLow = p.stock > 0 && p.stock <= p.minStock;
                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/70">
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-zinc-900">{p.name}</div>
                            <div className="text-xs text-zinc-500 font-mono tabular-nums">{p.sku}</div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-zinc-500">
                            {p.minStock} {p.unit}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                            <span className={isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-zinc-900'}>
                              {p.stock} {p.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-xs">
                            {isOut ? (
                              <span className="text-red-700 font-medium">Habis — Perlu Restock</span>
                            ) : isLow ? (
                              <span className="text-amber-700 font-medium">Stok Menipis</span>
                            ) : (
                              <span className="text-emerald-700">Stok Aman</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductId(p.id);
                                setMovementType('IN_RESTOCK');
                              }}
                              className="text-xs font-medium text-[#24634b] hover:underline whitespace-nowrap shrink-0"
                            >
                              Pilih Input
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Movement History Log */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-900">Riwayat Pergerakan Stok Terbaru</h2>
            </div>

            {stockLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Belum ada catatan pergerakan stok harian.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                      <th className="py-2.5 px-4">Waktu & Peran</th>
                      <th className="py-2.5 px-4">Produk</th>
                      <th className="py-2.5 px-4">Jenis</th>
                      <th className="py-2.5 px-4 text-right">Perubahan</th>
                      <th className="py-2.5 px-4">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-xs">
                    {stockLogs.slice(0, 25).map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/70">
                        <td className="py-2.5 px-4 text-zinc-500 font-mono tabular-nums whitespace-nowrap">
                          <div>{formatDateTimeID(log.createdAt)}</div>
                          <div className="text-zinc-400">{log.actorRole}</div>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-zinc-900">{log.productName}</td>
                        <td className="py-2.5 px-4">
                          {log.type === 'IN_RESTOCK' && (
                            <span className="text-emerald-700 font-medium">Stok Masuk</span>
                          )}
                          {log.type === 'OUT_SALE' && (
                            <span className="text-zinc-600">Terjual Kasir</span>
                          )}
                          {log.type === 'OUT_WASTE' && (
                            <span className="text-red-700 font-medium">Rusak / Waste</span>
                          )}
                          {log.type === 'ADJUSTMENT' && (
                            <span className="text-amber-700 font-medium">Opname Fisik</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                          <span className={log.quantityChange > 0 ? 'text-emerald-700' : 'text-red-700'}>
                            {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                          </span>
                          <span className="text-zinc-400 font-normal ml-1">
                            ({log.previousStock}→{log.newStock})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-zinc-600">{log.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
