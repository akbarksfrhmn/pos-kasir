import { AppDatabase, Product, Transaction, StockLog, Expense, StoreSettings } from './types';

const STORAGE_KEY = 'kedai_kasir_db_v1';

const todayStr = () => new Date().toISOString().split('T')[0];
const hoursAgoIso = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

export const INITIAL_SETTINGS: StoreSettings = {
  storeName: 'Kedai Kopi Teduh',
  storeTagline: 'Seduhan harian, roti hangat, dan ruang kerja tenang',
  storeAddress: 'Jl. Cempaka Putih No. 18, Bandung',
  storePhone: '0812-3456-7890',
  ownerPin: '1234',
  wifiInfo: 'Teduh_Guest / Sandi: kopipagi',
  tableCount: 12,
  qrisMerchantName: 'KEDAI KOPI TEDUH BANDUNG',
  qrisNmid: 'ID1024098871290',
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prd-1',
    sku: 'KOP-001',
    name: 'Es Kopi Susu Gula Aren',
    category: 'Kopi',
    price: 22000,
    cost: 9500,
    stock: 34,
    minStock: 10,
    unit: 'cup',
    isActive: true,
    description: 'Espresso blend Arabika-Robusta dengan susu segar dan gula aren organik.',
  },
  {
    id: 'prd-2',
    sku: 'KOP-002',
    name: 'Americano Dingin / Panas',
    category: 'Kopi',
    price: 18000,
    cost: 6500,
    stock: 42,
    minStock: 10,
    unit: 'cup',
    isActive: true,
    description: 'Double shot espresso Arabika Gayo dengan air mineral murni.',
  },
  {
    id: 'prd-3',
    sku: 'KOP-003',
    name: 'Manual Brew V60 Flores Bajawa',
    category: 'Kopi',
    price: 28000,
    cost: 12000,
    stock: 7,
    minStock: 8,
    unit: 'cup',
    isActive: true,
    description: 'Seduhan manual single origin dengan cita rasa cokelat hitam dan citrus.',
  },
  {
    id: 'prd-4',
    sku: 'KOP-004',
    name: 'Caffe Latte Oatmilk',
    category: 'Kopi',
    price: 30000,
    cost: 14500,
    stock: 19,
    minStock: 8,
    unit: 'cup',
    isActive: true,
    description: 'Espresso lembut dipadukan dengan susu gandum ramah vegan.',
  },
  {
    id: 'prd-5',
    sku: 'NKP-001',
    name: 'Uji Matcha Latte',
    category: 'Non-Kopi',
    price: 26000,
    cost: 11500,
    stock: 24,
    minStock: 8,
    unit: 'cup',
    isActive: true,
    description: 'Bubuk teh hijau Uji Jepang murni dengan susu segar.',
  },
  {
    id: 'prd-6',
    sku: 'NKP-002',
    name: 'Signature Dark Chocolate',
    category: 'Non-Kopi',
    price: 25000,
    cost: 10500,
    stock: 21,
    minStock: 8,
    unit: 'cup',
    isActive: true,
    description: 'Cokelat hitam Sulawesi 70% pekat, disajikan dingin atau hangat.',
  },
  {
    id: 'prd-7',
    sku: 'NKP-003',
    name: 'Teh Lemon Rosella Segar',
    category: 'Non-Kopi',
    price: 19000,
    cost: 7000,
    stock: 28,
    minStock: 10,
    unit: 'cup',
    isActive: true,
    description: 'Seduhan kelopak bunga rosella kering dengan perasan lemon asli.',
  },
  {
    id: 'prd-8',
    sku: 'MKN-001',
    name: 'Butter Croissant Panggang',
    category: 'Makanan & Kue',
    price: 20000,
    cost: 9000,
    stock: 5,
    minStock: 6,
    unit: 'pcs',
    isActive: true,
    description: 'Croissant berlapis mentega Prancis, renyah di luar dan lembut di dalam.',
  },
  {
    id: 'prd-9',
    sku: 'MKN-002',
    name: 'Cinnamon Roll Glaze Vanilla',
    category: 'Makanan & Kue',
    price: 22000,
    cost: 10000,
    stock: 12,
    minStock: 6,
    unit: 'pcs',
    isActive: true,
    description: 'Roti gulung kayu manis hangat dengan krim vanilla lembut.',
  },
  {
    id: 'prd-10',
    sku: 'MKN-003',
    name: 'Banana Bread Walnut Slice',
    category: 'Makanan & Kue',
    price: 18000,
    cost: 8000,
    stock: 15,
    minStock: 5,
    unit: 'pcs',
    isActive: true,
    description: 'Bolu pisang ambon panggang dengan taburan kacang walnut.',
  },
  {
    id: 'prd-11',
    sku: 'RTL-001',
    name: 'Biji Kopi Arabika Gayo 200g',
    category: 'Biji Kopi & Retail',
    price: 85000,
    cost: 52000,
    stock: 9,
    minStock: 4,
    unit: 'bungkus',
    isActive: true,
    description: 'Biji kopi sangrai medium untuk seduhan rumah (bisa minta giling).',
  },
  {
    id: 'prd-12',
    sku: 'RTL-002',
    name: 'Drip Bag Coffee Box (Isi 5)',
    category: 'Biji Kopi & Retail',
    price: 55000,
    cost: 31000,
    stock: 14,
    minStock: 5,
    unit: 'box',
    isActive: true,
    description: 'Kopi saring praktis siap seduh di mana saja.',
  },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'trx-101',
    receiptNumber: 'INV-241019-001',
    createdAt: hoursAgoIso(4),
    cashierRole: 'PELANGGAN_QR',
    customerName: 'Raka',
    tableNumber: 'Meja 03',
    orderSource: 'MEJA_QR',
    fulfillmentStatus: 'SELESAI',
    paymentReference: 'QRIS-882910',
    items: [
      {
        productId: 'prd-1',
        sku: 'KOP-001',
        productName: 'Es Kopi Susu Gula Aren',
        quantity: 2,
        unitPrice: 22000,
        unitCost: 9500,
        unit: 'cup',
      },
      {
        productId: 'prd-8',
        sku: 'MKN-001',
        productName: 'Butter Croissant Panggang',
        quantity: 1,
        unitPrice: 20000,
        unitCost: 9000,
        unit: 'pcs',
      },
    ],
    subtotal: 64000,
    discount: 0,
    total: 64000,
    totalCost: 28000,
    paymentMethod: 'QRIS',
    cashReceived: 64000,
    changeAmount: 0,
    note: 'Es sedikit untuk 1 cup',
  },
  {
    id: 'trx-102',
    receiptNumber: 'INV-241019-002',
    createdAt: hoursAgoIso(2.5),
    cashierRole: 'KASIR',
    customerName: 'Sinta',
    tableNumber: 'Meja 01',
    orderSource: 'KASIR_POS',
    fulfillmentStatus: 'SELESAI',
    items: [
      {
        productId: 'prd-5',
        sku: 'NKP-001',
        productName: 'Uji Matcha Latte',
        quantity: 1,
        unitPrice: 26000,
        unitCost: 11500,
        unit: 'cup',
      },
      {
        productId: 'prd-9',
        sku: 'MKN-002',
        productName: 'Cinnamon Roll Glaze Vanilla',
        quantity: 2,
        unitPrice: 22000,
        unitCost: 10000,
        unit: 'pcs',
      },
    ],
    subtotal: 70000,
    discount: 0,
    total: 70000,
    totalCost: 31500,
    paymentMethod: 'TUNAI',
    cashReceived: 100000,
    changeAmount: 30000,
  },
  {
    id: 'trx-103',
    receiptNumber: 'INV-241019-003',
    createdAt: hoursAgoIso(0.25),
    cashierRole: 'PELANGGAN_QR',
    customerName: 'Dimas',
    tableNumber: 'Meja 05',
    orderSource: 'MEJA_QR',
    fulfillmentStatus: 'BARU',
    paymentReference: 'QRIS-994120',
    items: [
      {
        productId: 'prd-3',
        sku: 'KOP-003',
        productName: 'Manual Brew V60 Flores Bajawa',
        quantity: 1,
        unitPrice: 28000,
        unitCost: 12000,
        unit: 'cup',
      },
      {
        productId: 'prd-11',
        sku: 'RTL-001',
        productName: 'Biji Kopi Arabika Gayo 200g',
        quantity: 1,
        unitPrice: 85000,
        unitCost: 52000,
        unit: 'bungkus',
      },
    ],
    subtotal: 113000,
    discount: 0,
    total: 113000,
    totalCost: 64000,
    paymentMethod: 'QRIS',
    cashReceived: 113000,
    changeAmount: 0,
    note: 'Biji kopi giling medium-fine, antar ke Meja 05',
  },
];

export const INITIAL_STOCK_LOGS: StockLog[] = [
  {
    id: 'slg-1',
    productId: 'prd-1',
    productName: 'Es Kopi Susu Gula Aren',
    sku: 'KOP-001',
    type: 'IN_RESTOCK',
    quantityChange: 20,
    previousStock: 16,
    newStock: 36,
    unitCostImpact: 0,
    note: 'Persiapan batch pagi oleh tim bar',
    createdAt: hoursAgoIso(5),
    actorRole: 'PRODUKSI',
  },
  {
    id: 'slg-2',
    productId: 'prd-8',
    productName: 'Butter Croissant Panggang',
    sku: 'MKN-001',
    type: 'OUT_WASTE',
    quantityChange: -1,
    previousStock: 7,
    newStock: 6,
    unitCostImpact: 9000,
    note: '1 pcs gosong saat pemanasan oven pagi',
    createdAt: hoursAgoIso(4.5),
    actorRole: 'PRODUKSI',
  },
  {
    id: 'slg-3',
    productId: 'prd-1',
    productName: 'Es Kopi Susu Gula Aren',
    sku: 'KOP-001',
    type: 'OUT_SALE',
    quantityChange: -2,
    previousStock: 36,
    newStock: 34,
    unitCostImpact: 0,
    note: 'Penjualan QR Meja 03 (INV-241019-001)',
    createdAt: hoursAgoIso(4),
    actorRole: 'PELANGGAN_QR',
  },
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    title: 'Es Batu Kristal 2 Karung',
    category: 'Bahan Pendukung',
    amount: 30000,
    date: todayStr(),
    createdAt: hoursAgoIso(5),
    note: 'Pengiriman rutin pagi',
    actorRole: 'PEMILIK',
  },
  {
    id: 'exp-2',
    title: 'Paper Napkin & Sedotan Ramah Lingkungan',
    category: 'Kemasan & Cup',
    amount: 25000,
    date: todayStr(),
    createdAt: hoursAgoIso(3),
    note: 'Beli stok tambahan di toko kemasan',
    actorRole: 'PEMILIK',
  },
];

export const getDefaultDatabase = (): AppDatabase => ({
  version: 1,
  settings: INITIAL_SETTINGS,
  products: INITIAL_PRODUCTS,
  transactions: INITIAL_TRANSACTIONS,
  stockLogs: INITIAL_STOCK_LOGS,
  expenses: INITIAL_EXPENSES,
});

export const loadDatabase = (): AppDatabase => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultDatabase();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<AppDatabase>;
    if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.transactions)) {
      return getDefaultDatabase();
    }
    return {
      version: 1,
      settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
      products: parsed.products,
      transactions: parsed.transactions,
      stockLogs: Array.isArray(parsed.stockLogs) ? parsed.stockLogs : INITIAL_STOCK_LOGS,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : INITIAL_EXPENSES,
    };
  } catch {
    return getDefaultDatabase();
  }
};

export const saveDatabase = (db: AppDatabase): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Gagal menyimpan ke penyimpanan lokal:', e);
  }
};

export const validateBackupJson = (data: unknown): { valid: boolean; error?: string; db?: AppDatabase } => {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Format file bukan objek JSON yang valid.' };
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.products)) {
    return { valid: false, error: 'Data produk (products) tidak ditemukan atau rusak di dalam file cadangan.' };
  }
  if (!Array.isArray(obj.transactions)) {
    return { valid: false, error: 'Data transaksi (transactions) tidak ditemukan di dalam file cadangan.' };
  }

  for (const p of obj.products) {
    if (!p || typeof p !== 'object' || typeof (p as Product).name !== 'string' || typeof (p as Product).price !== 'number') {
      return { valid: false, error: 'Salah satu entri produk memiliki struktur yang tidak valid.' };
    }
  }

  return {
    valid: true,
    db: {
      version: 1,
      settings: {
        ...INITIAL_SETTINGS,
        ...(typeof obj.settings === 'object' && obj.settings ? (obj.settings as Partial<StoreSettings>) : {}),
      },
      products: obj.products as Product[],
      transactions: obj.transactions as Transaction[],
      stockLogs: Array.isArray(obj.stockLogs) ? (obj.stockLogs as StockLog[]) : [],
      expenses: Array.isArray(obj.expenses) ? (obj.expenses as Expense[]) : [],
    },
  };
};

export const formatIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDateTimeID = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
};
