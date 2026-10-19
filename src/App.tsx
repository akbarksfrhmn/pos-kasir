/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AppDatabase,
  Expense,
  FulfillmentStatus,
  OrderItem,
  PaymentMethod,
  Product,
  StockMovementType,
  StoreSettings,
  Transaction,
  UserRole,
} from './types';
import {
  getDefaultDatabase,
  loadDatabase,
  saveDatabase,
} from './utils/storage';
import { PosView } from './components/PosView';
import { CatalogQrView } from './components/CatalogQrView';
import { StockDailyView } from './components/StockDailyView';
import { ProfitLossView } from './components/ProfitLossView';
import { CustomerTableOrderView } from './components/CustomerTableOrderView';
import { Lock, X, AlertTriangle, HelpCircle } from 'lucide-react';

type ActiveTab = 'KASIR' | 'KATALOG' | 'STOK' | 'LAPORAN';

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => loadDatabase());
  const [activeTab, setActiveTab] = useState<ActiveTab>('KASIR');
  const [activeRole, setActiveRole] = useState<UserRole>('KASIR');

  // Customer QR public view mode when URL has ?view=menu&table=Meja+01
  const [isCustomerMenuMode, setIsCustomerMenuMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'menu';
  });

  const [customerActiveTable, setCustomerActiveTable] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || 'Meja 01';
  });

  // Owner PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinReason, setPinReason] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingTabAfterPin, setPendingTabAfterPin] = useState<ActiveTab | null>(null);

  // Quick Guide / Documentation Modal State
  const [guideOpen, setGuideOpen] = useState(false);

  // Sync changes to localStorage
  useEffect(() => {
    saveDatabase(db);
  }, [db]);

  const lowStockAlertCount = useMemo(
    () => db.products.filter((p) => p.isActive && p.stock <= p.minStock).length,
    [db.products]
  );

  const activeTableOrdersCount = useMemo(
    () =>
      db.transactions.filter(
        (t) =>
          t.orderSource === 'MEJA_QR' &&
          (t.fulfillmentStatus === 'BARU' || t.fulfillmentStatus === 'DIPROSES')
      ).length,
    [db.transactions]
  );

  // Role Switching Handler
  const handleSelectRole = (targetRole: UserRole) => {
    if (targetRole === 'PEMILIK' && activeRole !== 'PEMILIK') {
      setPinReason('Beralih ke peran Pemilik Toko (akses HPP, Laporan Laba Rugi, dan Cadangan)');
      setPinInput('');
      setPinError(null);
      setPendingTabAfterPin(null);
      setPinModalOpen(true);
      return;
    }
    setActiveRole(targetRole);
  };

  const requestOwnerAccess = (reason: string, targetTab?: ActiveTab) => {
    setPinReason(reason);
    setPinInput('');
    setPinError(null);
    setPendingTabAfterPin(targetTab || null);
    setPinModalOpen(true);
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === db.settings.ownerPin) {
      setActiveRole('PEMILIK');
      setPinModalOpen(false);
      if (pendingTabAfterPin) {
        setActiveTab(pendingTabAfterPin);
      }
      setPinInput('');
      setPinError(null);
    } else {
      setPinError('PIN salah. PIN standar awal adalah 1234.');
    }
  };

  // POS Transaction Handler (Cashier)
  const handleCompleteTransaction = (trxData: {
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
  }): Transaction => {
    const nowIso = new Date().toISOString();
    const datePart = nowIso.slice(2, 10).replace(/-/g, '');
    const seqPart = String(db.transactions.length + 1).padStart(3, '0');
    const newTrx: Transaction = {
      id: `trx-${Date.now()}`,
      receiptNumber: `INV-${datePart}-${seqPart}`,
      createdAt: nowIso,
      cashierRole: activeRole,
      customerName: trxData.customerName,
      tableNumber: trxData.tableNumber,
      orderSource: 'KASIR_POS',
      fulfillmentStatus: 'SELESAI',
      items: trxData.items,
      subtotal: trxData.subtotal,
      discount: trxData.discount,
      total: trxData.total,
      totalCost: trxData.totalCost,
      paymentMethod: trxData.paymentMethod,
      cashReceived: trxData.cashReceived,
      changeAmount: trxData.changeAmount,
      note: trxData.note,
    };

    setDb((prev) => {
      const updatedProducts = prev.products.map((prod) => {
        const soldItem = trxData.items.find((i) => i.productId === prod.id);
        if (!soldItem) return prod;
        return {
          ...prod,
          stock: Math.max(0, prod.stock - soldItem.quantity),
        };
      });

      const saleLogs = trxData.items.map((item) => {
        const originalProd = prev.products.find((p) => p.id === item.productId);
        const prevStock = originalProd ? originalProd.stock : 0;
        return {
          id: `slg-${Date.now()}-${item.productId}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          type: 'OUT_SALE' as const,
          quantityChange: -item.quantity,
          previousStock: prevStock,
          newStock: Math.max(0, prevStock - item.quantity),
          unitCostImpact: 0,
          note: `Penjualan Kasir (${trxData.tableNumber}) ${newTrx.receiptNumber}`,
          createdAt: nowIso,
          actorRole: activeRole,
        };
      });

      return {
        ...prev,
        products: updatedProducts,
        transactions: [newTrx, ...prev.transactions],
        stockLogs: [...saleLogs, ...prev.stockLogs],
      };
    });

    return newTrx;
  };

  // Self-Order & Direct QRIS Payment Handler (Customer at Table)
  const handlePlaceTableOrder = (orderData: {
    customerName: string;
    tableNumber: string;
    items: OrderItem[];
    subtotal: number;
    total: number;
    totalCost: number;
    paymentMethod: PaymentMethod;
    paymentReference: string;
    note: string;
  }): Transaction => {
    const nowIso = new Date().toISOString();
    const datePart = nowIso.slice(2, 10).replace(/-/g, '');
    const seqPart = String(db.transactions.length + 1).padStart(3, '0');
    const newTrx: Transaction = {
      id: `trx-${Date.now()}`,
      receiptNumber: `INV-${datePart}-${seqPart}`,
      createdAt: nowIso,
      cashierRole: 'PELANGGAN_QR',
      customerName: orderData.customerName,
      tableNumber: orderData.tableNumber,
      orderSource: 'MEJA_QR',
      fulfillmentStatus: 'BARU',
      paymentReference: orderData.paymentReference,
      items: orderData.items,
      subtotal: orderData.subtotal,
      discount: 0,
      total: orderData.total,
      totalCost: orderData.totalCost,
      paymentMethod: orderData.paymentMethod,
      cashReceived: orderData.total,
      changeAmount: 0,
      note: orderData.note,
    };

    setDb((prev) => {
      const updatedProducts = prev.products.map((prod) => {
        const soldItem = orderData.items.find((i) => i.productId === prod.id);
        if (!soldItem) return prod;
        return {
          ...prod,
          stock: Math.max(0, prod.stock - soldItem.quantity),
        };
      });

      const saleLogs = orderData.items.map((item) => {
        const originalProd = prev.products.find((p) => p.id === item.productId);
        const prevStock = originalProd ? originalProd.stock : 0;
        return {
          id: `slg-${Date.now()}-${item.productId}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          type: 'OUT_SALE' as const,
          quantityChange: -item.quantity,
          previousStock: prevStock,
          newStock: Math.max(0, prevStock - item.quantity),
          unitCostImpact: 0,
          note: `Pesanan QR ${orderData.tableNumber} (${newTrx.receiptNumber})`,
          createdAt: nowIso,
          actorRole: 'PELANGGAN_QR' as const,
        };
      });

      return {
        ...prev,
        products: updatedProducts,
        transactions: [newTrx, ...prev.transactions],
        stockLogs: [...saleLogs, ...prev.stockLogs],
      };
    });

    return newTrx;
  };

  const handleUpdateFulfillmentStatus = (trxId: string, status: FulfillmentStatus) => {
    setDb((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === trxId ? { ...t, fulfillmentStatus: status } : t
      ),
    }));
  };

  // Catalog CRUD Handlers
  const handleSaveProduct = (productData: Omit<Product, 'id'>, existingId?: string) => {
    setDb((prev) => {
      if (existingId) {
        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === existingId ? { ...productData, id: existingId } : p
          ),
        };
      }
      const newProduct: Product = {
        ...productData,
        id: `prd-${Date.now()}`,
      };
      return {
        ...prev,
        products: [...prev.products, newProduct],
      };
    });
  };

  const handleDeleteProduct = (productId: string) => {
    setDb((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
  };

  const handleToggleProductActive = (productId: string) => {
    setDb((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, isActive: !p.isActive } : p
      ),
    }));
  };

  const handleUpdateTableCount = (count: number) => {
    setDb((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tableCount: count,
      },
    }));
  };

  // Daily Stock Movement Handler
  const handleRecordStockMovement = (movement: {
    productId: string;
    type: StockMovementType;
    quantityChange: number;
    note: string;
  }) => {
    const nowIso = new Date().toISOString();
    setDb((prev) => {
      const target = prev.products.find((p) => p.id === movement.productId);
      if (!target) return prev;

      const prevStock = target.stock;
      const newStock = Math.max(0, prevStock + movement.quantityChange);
      const wasteImpact =
        movement.type === 'OUT_WASTE'
          ? Math.abs(movement.quantityChange) * target.cost
          : 0;

      const newLog = {
        id: `slg-${Date.now()}`,
        productId: target.id,
        productName: target.name,
        sku: target.sku,
        type: movement.type,
        quantityChange: movement.quantityChange,
        previousStock: prevStock,
        newStock,
        unitCostImpact: wasteImpact,
        note: movement.note,
        createdAt: nowIso,
        actorRole: activeRole,
      };

      return {
        ...prev,
        products: prev.products.map((p) =>
          p.id === target.id ? { ...p, stock: newStock } : p
        ),
        stockLogs: [newLog, ...prev.stockLogs],
      };
    });
  };

  // Expense & Settings Handlers
  const handleAddExpense = (exp: Omit<Expense, 'id' | 'createdAt' | 'actorRole'>) => {
    const newExp: Expense = {
      ...exp,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      actorRole: activeRole,
    };
    setDb((prev) => ({
      ...prev,
      expenses: [newExp, ...prev.expenses],
    }));
  };

  const handleDeleteExpense = (expenseId: string) => {
    setDb((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
    }));
  };

  const handleUpdateSettings = (newSettings: StoreSettings) => {
    setDb((prev) => ({
      ...prev,
      settings: newSettings,
    }));
  };

  const handleRestoreDatabase = (newDb: AppDatabase) => {
    setDb(newDb);
  };

  const handleResetDefaultDatabase = () => {
    const fresh = getDefaultDatabase();
    setDb(fresh);
  };

  const openCustomerTableMode = (tableName: string) => {
    setCustomerActiveTable(tableName);
    setIsCustomerMenuMode(true);
    const url = `${window.location.pathname}?view=menu&table=${encodeURIComponent(tableName)}`;
    window.history.replaceState({}, '', url);
  };

  // Customer Digital Self-Ordering & Direct QRIS Payment View (?view=menu&table=Meja+01)
  if (isCustomerMenuMode) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 py-6 px-4 sm:px-8">
        <div className="max-w-[1280px] mx-auto">
          <CustomerTableOrderView
            products={db.products}
            settings={db.settings}
            initialTable={customerActiveTable}
            onPlaceTableOrder={handlePlaceTableOrder}
            onExitToStaffMode={() => {
              window.history.replaceState({}, '', window.location.pathname);
              setIsCustomerMenuMode(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-zinc-900">
      {/* Strictly Compliant 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#kasir"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('KASIR');
            }}
            className="text-lg font-bold tracking-tight text-zinc-900 font-display whitespace-nowrap shrink-0"
          >
            {db.settings.storeName}
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            <a
              href="#kasir"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('KASIR');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'KASIR'
                  ? 'border-[#24634b] text-zinc-900 font-semibold'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Kasir POS {activeTableOrdersCount > 0 ? `(${activeTableOrdersCount} Meja)` : ''}
            </a>
            <a
              href="#katalog"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('KATALOG');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'KATALOG'
                  ? 'border-[#24634b] text-zinc-900 font-semibold'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Katalog & QR Meja
            </a>
            <a
              href="#stok"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('STOK');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'STOK'
                  ? 'border-[#24634b] text-zinc-900 font-semibold'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Stok Harian {lowStockAlertCount > 0 ? `(${lowStockAlertCount})` : ''}
            </a>
            <a
              href="#laporan"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('LAPORAN');
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'LAPORAN'
                  ? 'border-[#24634b] text-zinc-900 font-semibold'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Laporan Laba Rugi
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openCustomerTableMode('Meja 01')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Mode Pesan QR Meja
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Workspace Context & Role Switcher Toolbar */}
      <div className="bg-zinc-100/80 border-b border-zinc-200 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Mobile Tab Bar */}
          <div className="flex md:hidden items-center gap-1 overflow-x-auto w-full pb-1">
            {(['KASIR', 'KATALOG', 'STOK', 'LAPORAN'] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                  activeTab === tab ? 'bg-[#24634b] text-white' : 'bg-white text-zinc-700'
                }`}
              >
                {tab === 'KASIR'
                  ? `Kasir (${activeTableOrdersCount})`
                  : tab === 'KATALOG'
                  ? 'Katalog & QR'
                  : tab === 'STOK'
                  ? `Stok (${lowStockAlertCount})`
                  : 'Laporan'}
              </button>
            ))}
          </div>

          <div className="text-xs text-zinc-600 hidden md:block">
            <span>{db.settings.storeAddress}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>{db.settings.tableCount} Meja QR Aktif</span>
          </div>

          {/* Role Switcher Controls */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-zinc-500">Peran Staf:</span>
            <div className="flex items-center gap-1 p-0.5 bg-zinc-200/80 rounded-lg">
              {(['KASIR', 'PRODUKSI', 'PEMILIK'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleSelectRole(role)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeRole === role
                      ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {role === 'KASIR'
                    ? 'Staff Kasir'
                    : role === 'PRODUKSI'
                    ? 'Tim Produksi'
                    : 'Pemilik Toko'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-8">
        {activeTab === 'KASIR' && (
          <PosView
            products={db.products}
            transactions={db.transactions}
            activeRole={activeRole}
            settings={db.settings}
            onCompleteTransaction={handleCompleteTransaction}
            onUpdateFulfillmentStatus={handleUpdateFulfillmentStatus}
            onNavigateToCatalog={() => setActiveTab('KATALOG')}
          />
        )}

        {activeTab === 'KATALOG' && (
          <CatalogQrView
            products={db.products}
            settings={db.settings}
            activeRole={activeRole}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onToggleProductActive={handleToggleProductActive}
            onUpdateTableCount={handleUpdateTableCount}
            onOpenCustomerSelfOrder={openCustomerTableMode}
            onRequestOwnerAccess={(reason) => requestOwnerAccess(reason, 'KATALOG')}
          />
        )}

        {activeTab === 'STOK' && (
          <StockDailyView
            products={db.products}
            stockLogs={db.stockLogs}
            activeRole={activeRole}
            onRecordStockMovement={handleRecordStockMovement}
          />
        )}

        {activeTab === 'LAPORAN' && (
          <ProfitLossView
            db={db}
            activeRole={activeRole}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onUpdateSettings={handleUpdateSettings}
            onRestoreDatabase={handleRestoreDatabase}
            onResetDefaultDatabase={handleResetDefaultDatabase}
            onRequestOwnerAccess={(reason) => requestOwnerAccess(reason, 'LAPORAN')}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-zinc-200 bg-white py-5 px-4 sm:px-8 no-print">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            {db.settings.storeName} · Sistem Kasir, Self-Order QR Meja, Stok Harian & Laba Rugi
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => openCustomerTableMode('Meja 01')}
              className="hover:text-zinc-900 underline"
            >
              Simulasi Pesan & Bayar QR Pelanggan
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="hover:text-zinc-900 underline"
            >
              Panduan Operasional & Pencadangan
            </button>
          </div>
        </div>
      </footer>

      {/* Owner PIN Verification Modal */}
      {pinModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-modal-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-zinc-200 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#24634b]" />
                <h2 id="pin-modal-title" className="text-base font-bold text-zinc-900">
                  Konfirmasi PIN Pemilik Toko
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              {pinReason ||
                'Masukkan PIN Pemilik Toko untuk membuka fitur manajemen HPP dan Laporan Laba Rugi.'}
              <br />
              <span className="text-zinc-500">
                (PIN bawaan awal: <strong>1234</strong>)
              </span>
            </p>

            {pinError && (
              <div
                role="alert"
                className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label htmlFor="owner-pin-field" className="block text-xs font-medium text-zinc-700 mb-1">
                  PIN Pemilik Toko
                </label>
                <input
                  id="owner-pin-field"
                  type="password"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-center text-lg font-mono tracking-widest text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#24634b]"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg"
                >
                  Buka Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operational Documentation & Backup Guide Modal */}
      {guideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-modal-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#24634b]" />
                <h2 id="guide-modal-title" className="text-base font-bold text-zinc-900">
                  Panduan Operasional, QR Meja & Pencadangan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-zinc-700 leading-relaxed">
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">
                  1. Pesan & Bayar Mandiri dari Meja (Tanpa Antre di Kasir)
                </h3>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>
                    Buka menu <strong>Katalog & QR Meja</strong> → klik{' '}
                    <strong>Generator QR Per Meja</strong>.
                  </li>
                  <li>
                    Atur jumlah meja kedai Anda, lalu cetak kartu QR untuk satu meja atau semua meja sekaligus.
                  </li>
                  <li>
                    Saat pelanggan memindai QR di mejanya, halaman pemesanan otomatis mengenali nomor meja tersebut, menyajikan katalog menu, dan membuat kode pembayaran <strong>QRIS</strong> sesuai nominal pesanan.
                  </li>
                  <li>
                    Setelah dibayar oleh pelanggan, pesanan otomatis masuk ke daftar{' '}
                    <strong>Pesanan Masuk dari QR Meja</strong> di layar Kasir/Barista untuk disiapkan dan diantar.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-zinc-900 text-sm">2. Alur Stok & Laba Rugi Otomatis</h3>
                <p className="mt-1">
                  Baik pesanan dari Kasir maupun pesanan mandiri dari QR Meja otomatis memotong stok produk jadi dan mengunci HPP saat transaksi terjadi.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-zinc-900 text-sm">
                  3. Cara Mencadangkan & Memulihkan Data
                </h3>
                <p className="mt-1">
                  Buka menu <strong>Laporan Laba Rugi</strong> (PIN Pemilik bawaan:{' '}
                  <strong>{db.settings.ownerPin}</strong>), lalu klik{' '}
                  <strong>Ekspor Cadangan (.JSON)</strong> setiap selesai tutup buku harian.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#24634b] hover:bg-[#1d503d] rounded-lg"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
