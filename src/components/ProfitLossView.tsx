import React, { useState, useMemo, useRef } from 'react';
import {
  AppDatabase,
  Expense,
  ExpenseCategory,
  StockLog,
  StoreSettings,
  Transaction,
  UserRole,
} from '../types';
import { formatIDR, formatDateTimeID, validateBackupJson } from '../utils/storage';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  RotateCcw,
} from 'lucide-react';

interface ProfitLossViewProps {
  db: AppDatabase;
  activeRole: UserRole;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'actorRole'>) => void;
  onDeleteExpense: (expenseId: string) => void;
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onRestoreDatabase: (newDb: AppDatabase) => void;
  onResetDefaultDatabase: () => void;
  onRequestOwnerAccess: (reason: string) => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Bahan Pendukung',
  'Kemasan & Cup',
  'Utilitas & Listrik',
  'Operasional Lainnya',
];

export const ProfitLossView: React.FC<ProfitLossViewProps> = ({
  db,
  activeRole,
  onAddExpense,
  onDeleteExpense,
  onUpdateSettings,
  onRestoreDatabase,
  onResetDefaultDatabase,
  onRequestOwnerAccess,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'HARI_INI' | '7_HARI' | 'SEMUA'>('HARI_INI');
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Bahan Pendukung');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');

  // Store Settings state
  const [storeName, setStoreName] = useState(db.settings.storeName);
  const [storeTagline, setStoreTagline] = useState(db.settings.storeTagline);
  const [storeAddress, setStoreAddress] = useState(db.settings.storeAddress);
  const [wifiInfo, setWifiInfo] = useState(db.settings.wifiInfo);
  const [ownerPin, setOwnerPin] = useState(db.settings.ownerPin);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isOwner = activeRole === 'PEMILIK';

  const isWithinPeriod = (isoOrDateStr: string): boolean => {
    if (periodFilter === 'SEMUA') return true;
    const itemDate = new Date(isoOrDateStr);
    const now = new Date();
    if (periodFilter === 'HARI_INI') {
      return (
        itemDate.getFullYear() === now.getFullYear() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getDate() === now.getDate()
      );
    }
    if (periodFilter === '7_HARI') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return itemDate >= sevenDaysAgo;
    }
    return true;
  };

  const filteredTransactions = useMemo(
    () => db.transactions.filter((t) => isWithinPeriod(t.createdAt)),
    [db.transactions, periodFilter]
  );

  const filteredExpenses = useMemo(
    () => db.expenses.filter((e) => isWithinPeriod(e.createdAt || e.date)),
    [db.expenses, periodFilter]
  );

  const filteredWasteLogs = useMemo(
    () => db.stockLogs.filter((l) => l.type === 'OUT_WASTE' && isWithinPeriod(l.createdAt)),
    [db.stockLogs, periodFilter]
  );

  // Financial Calculations
  const metrics = useMemo(() => {
    const grossSales = filteredTransactions.reduce((s, t) => s + t.subtotal, 0);
    const totalDiscounts = filteredTransactions.reduce((s, t) => s + t.discount, 0);
    const netRevenue = filteredTransactions.reduce((s, t) => s + t.total, 0);
    const cogsSold = filteredTransactions.reduce((s, t) => s + t.totalCost, 0);
    const grossProfit = netRevenue - cogsSold;

    const wasteLoss = filteredWasteLogs.reduce((s, l) => s + (l.unitCostImpact || 0), 0);
    const operationalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit - wasteLoss - operationalExpenses;

    const netMarginPct = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0;

    return {
      grossSales,
      totalDiscounts,
      netRevenue,
      cogsSold,
      grossProfit,
      wasteLoss,
      operationalExpenses,
      netProfit,
      netMarginPct,
    };
  }, [filteredTransactions, filteredExpenses, filteredWasteLogs]);

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const trimmedTitle = expTitle.trim();
    const parsedAmt = Number(expAmount);

    if (!trimmedTitle) {
      setStatusMessage({ type: 'error', text: 'Nama pengeluaran operasional wajib diisi.' });
      return;
    }
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setStatusMessage({ type: 'error', text: 'Nominal biaya harus lebih dari Rp 0.' });
      return;
    }

    onAddExpense({
      title: trimmedTitle,
      category: expCategory,
      amount: parsedAmt,
      date: new Date().toISOString().split('T')[0],
      note: expNote.trim(),
    });

    setExpTitle('');
    setExpAmount('');
    setExpNote('');
    setStatusMessage({ type: 'success', text: `Biaya "${trimmedTitle}" berhasil dicatat ke laporan.` });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setStatusMessage({ type: 'error', text: 'Nama toko tidak boleh kosong.' });
      return;
    }
    if (!ownerPin.trim() || ownerPin.trim().length < 4) {
      setStatusMessage({ type: 'error', text: 'PIN Pemilik minimal terdiri dari 4 karakter.' });
      return;
    }

    onUpdateSettings({
      ...db.settings,
      storeName: storeName.trim(),
      storeTagline: storeTagline.trim(),
      storeAddress: storeAddress.trim(),
      wifiInfo: wifiInfo.trim(),
      ownerPin: ownerPin.trim(),
    });
    setStatusMessage({ type: 'success', text: 'Pengaturan profil toko & PIN berhasil diperbarui.' });
  };

  const handleExportBackupJson = () => {
    const jsonString = JSON.stringify(db, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `cadangan-kasir-${dateStamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({
      type: 'success',
      text: 'File cadangan JSON berhasil diunduh ke perangkat Anda.',
    });
  };

  const handleExportTransactionsCsv = () => {
    const headers = [
      'No_Struk',
      'Waktu',
      'Pelanggan',
      'Metode_Bayar',
      'Subtotal',
      'Diskon',
      'Total_Omzet',
      'Total_HPP',
      'Laba_Kotor',
    ];
    const rows = filteredTransactions.map((t) => [
      t.receiptNumber,
      t.createdAt,
      `"${(t.customerName || '').replace(/"/g, '""')}"`,
      t.paymentMethod,
      t.subtotal,
      t.discount,
      t.total,
      t.totalCost,
      t.total - t.totalCost,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `laporan-penjualan-${dateStamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || ''));
        const result = validateBackupJson(parsed);
        if (!result.valid || !result.db) {
          setStatusMessage({
            type: 'error',
            text: result.error || 'File cadangan tidak valid.',
          });
          return;
        }
        onRestoreDatabase(result.db);
        setStoreName(result.db.settings.storeName);
        setStoreTagline(result.db.settings.storeTagline);
        setStoreAddress(result.db.settings.storeAddress);
        setWifiInfo(result.db.settings.wifiInfo);
        setOwnerPin(result.db.settings.ownerPin);
        setStatusMessage({
          type: 'success',
          text: `Data cadangan berhasil dipulihkan (${result.db.products.length} produk, ${result.db.transactions.length} transaksi).`,
        });
      } catch {
        setStatusMessage({
          type: 'error',
          text: 'Gagal membaca file JSON. Pastikan memilih file cadangan .json yang benar.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOwner) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4 my-8">
        <div className="w-11 h-11 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Laporan Laba Rugi & Pencadangan</h1>
        <p className="text-sm text-zinc-600 leading-relaxed">
          Halaman ini memuat rincian Harga Pokok Penjualan (HPP), perhitungan laba bersih, biaya operasional, serta fitur pemulihan data yang dikhususkan bagi <strong>Pemilik Toko</strong>.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onRequestOwnerAccess('Membuka Laporan Laba Rugi & Pengaturan Cadangan')}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Masukkan PIN Pemilik Toko
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Laporan Laba Rugi & Cadangan Data
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Ringkasan pendapatan, HPP produk terjual, kerugian stok rusak, serta biaya operasional harian.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-200/70 rounded-lg">
          {(['HARI_INI', '7_HARI', 'SEMUA'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setPeriodFilter(period)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                periodFilter === period ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {period === 'HARI_INI' ? 'Hari Ini' : period === '7_HARI' ? '7 Hari Terakhir' : 'Semua Waktu'}
            </button>
          ))}
        </div>
      </div>

      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 ${
            statusMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {statusMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 4-Column Financial Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-500">Omzet Bersih Penjualan</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
            {formatIDR(metrics.netRevenue)}
          </div>
          <div className="text-xs text-zinc-500 font-mono tabular-nums pt-1">
            {filteredTransactions.length} transaksi selesai
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-500">Total HPP Produk Terjual</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
            {formatIDR(metrics.cogsSold)}
          </div>
          <div className="text-xs text-emerald-700 font-mono tabular-nums pt-1">
            Laba Kotor: {formatIDR(metrics.grossProfit)}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-500">Beban Operasional & Waste</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">
            {formatIDR(metrics.operationalExpenses + metrics.wasteLoss)}
          </div>
          <div className="text-xs text-zinc-500 font-mono tabular-nums pt-1">
            Biaya: {formatIDR(metrics.operationalExpenses)} · Waste: {formatIDR(metrics.wasteLoss)}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-500">Estimasi Laba Bersih</div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              metrics.netProfit >= 0 ? 'text-[#24634b]' : 'text-red-700'
            }`}
          >
            {formatIDR(metrics.netProfit)}
          </div>
          <div className="text-xs text-zinc-500 font-mono tabular-nums pt-1">
            Margin Bersih: {metrics.netMarginPct}% dari omzet
          </div>
        </div>
      </div>

      {/* Main Grid: Structured P&L Statement + Daily Expense Logger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Structured P&L Statement & Transactions (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 className="text-base font-bold text-zinc-900">Rincian Perhitungan Laba Rugi</h2>
              <button
                type="button"
                onClick={handleExportTransactionsCsv}
                className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Unduh CSV Transaksi</span>
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-zinc-700">
                <span>Penjualan Kotor (Gross Sales)</span>
                <span className="font-mono tabular-nums">{formatIDR(metrics.grossSales)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Potongan Diskon Pesanan</span>
                <span className="font-mono tabular-nums">({formatIDR(metrics.totalDiscounts)})</span>
              </div>
              <div className="flex justify-between font-semibold text-zinc-900 border-t border-zinc-200 pt-2">
                <span>Pendapatan Bersih (Net Revenue)</span>
                <span className="font-mono tabular-nums">{formatIDR(metrics.netRevenue)}</span>
              </div>

              <div className="flex justify-between text-zinc-600 pt-2">
                <span>Harga Pokok Penjualan (HPP Produk Terjual)</span>
                <span className="font-mono tabular-nums">({formatIDR(metrics.cogsSold)})</span>
              </div>
              <div className="flex justify-between font-semibold text-zinc-900 border-t border-zinc-200 pt-2">
                <span>Laba Kotor (Gross Profit)</span>
                <span className="font-mono tabular-nums">{formatIDR(metrics.grossProfit)}</span>
              </div>

              <div className="flex justify-between text-zinc-600 pt-2">
                <span>Kerugian Stok Rusak / Terbuang (Waste)</span>
                <span className="font-mono tabular-nums">({formatIDR(metrics.wasteLoss)})</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Beban Operasional Harian</span>
                <span className="font-mono tabular-nums">({formatIDR(metrics.operationalExpenses)})</span>
              </div>

              <div className="flex justify-between text-base font-bold border-t border-zinc-300 pt-3">
                <span className="text-zinc-900">Laba / Rugi Bersih Operasional</span>
                <span
                  className={`font-mono tabular-nums ${
                    metrics.netProfit >= 0 ? 'text-[#24634b]' : 'text-red-700'
                  }`}
                >
                  {formatIDR(metrics.netProfit)}
                </span>
              </div>
            </div>
          </section>

          {/* Recent Transactions Table */}
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-900">
                Daftar Transaksi ({filteredTransactions.length})
              </h2>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Belum ada transaksi penjualan pada rentang waktu yang dipilih.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                      <th className="py-2.5 px-4">No. Struk & Waktu</th>
                      <th className="py-2.5 px-4">Item Pesanan</th>
                      <th className="py-2.5 px-4">Metode</th>
                      <th className="py-2.5 px-4 text-right">Omzet</th>
                      <th className="py-2.5 px-4 text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-xs">
                    {filteredTransactions.map((trx) => {
                      const trxProfit = trx.total - trx.totalCost;
                      return (
                        <tr key={trx.id} className="hover:bg-zinc-50/70">
                          <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-zinc-900">{trx.receiptNumber}</div>
                            <div className="text-zinc-500">{formatDateTimeID(trx.createdAt)}</div>
                          </td>
                          <td className="py-2.5 px-4 text-zinc-700">
                            {trx.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-zinc-600">{trx.paymentMethod}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-zinc-900">
                            {formatIDR(trx.total)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                            +{formatIDR(trxProfit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right: Operational Expenses + Backup & Store Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Operational Expenses Form & List */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-900">Catat Beban Operasional Harian</h2>
            <form onSubmit={handleAddExpenseSubmit} className="space-y-3">
              <div>
                <label htmlFor="exp-title" className="block text-xs font-medium text-zinc-700 mb-1">
                  Nama Pengeluaran *
                </label>
                <input
                  id="exp-title"
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Contoh: Beli Es Batu, Listrik Token, Cup"
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="exp-cat" className="block text-xs font-medium text-zinc-700 mb-1">
                    Kategori Biaya
                  </label>
                  <select
                    id="exp-cat"
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="exp-amount" className="block text-xs font-medium text-zinc-700 mb-1">
                    Nominal (Rp) *
                  </label>
                  <input
                    id="exp-amount"
                    type="number"
                    min={1}
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#24634b] hover:bg-[#1d503d] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors min-h-[40px] whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Biaya Operasional</span>
              </button>
            </form>

            {filteredExpenses.length > 0 && (
              <div className="border-t border-zinc-200 pt-3 divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                {filteredExpenses.map((exp) => (
                  <div key={exp.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-medium text-zinc-900">{exp.title}</div>
                      <div className="text-zinc-500">
                        {exp.category} · {exp.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        {formatIDR(exp.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Hapus Biaya"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Data Backup & Restore Card (T05 Documentation & Backup) */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Pencadangan & Pemulihan Data</h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                Data aplikasi disimpan di peramban perangkat ini. Unduh file cadangan JSON secara berkala setiap selesai tutup buku harian agar data aman dan dapat dipindahkan ke perangkat lain.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportBackupJson}
                className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors min-h-[40px] whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Cadangan (.JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors min-h-[40px] whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Impor Cadangan (.JSON)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJsonFile}
                className="hidden"
              />
            </div>

            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span>Ingin mengembalikan data contoh awal?</span>
              <button
                type="button"
                onClick={onResetDefaultDatabase}
                className="text-red-700 hover:underline font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Data Awal</span>
              </button>
            </div>
          </section>

          {/* Store Profile & PIN Settings */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-600" />
              <h2 className="text-base font-bold text-zinc-900">Profil Kedai & PIN Pemilik</h2>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label htmlFor="set-name" className="block text-xs font-medium text-zinc-700 mb-1">
                  Nama Kedai / Toko
                </label>
                <input
                  id="set-name"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="set-tagline" className="block text-xs font-medium text-zinc-700 mb-1">
                  Slogan Singkat (Tampil di Katalog QR)
                </label>
                <input
                  id="set-tagline"
                  type="text"
                  value={storeTagline}
                  onChange={(e) => setStoreTagline(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="set-wifi" className="block text-xs font-medium text-zinc-700 mb-1">
                    Info Wi-Fi Pelanggan
                  </label>
                  <input
                    id="set-wifi"
                    type="text"
                    value={wifiInfo}
                    onChange={(e) => setWifiInfo(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900"
                  />
                </div>
                <div>
                  <label htmlFor="set-pin" className="block text-xs font-medium text-zinc-700 mb-1">
                    PIN Akses Pemilik
                  </label>
                  <input
                    id="set-pin"
                    type="text"
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Simpan Pengaturan Toko
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
