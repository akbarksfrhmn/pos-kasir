export type UserRole = 'KASIR' | 'PRODUKSI' | 'PEMILIK';

export type ProductCategory = 'Kopi' | 'Non-Kopi' | 'Makanan & Kue' | 'Biji Kopi & Retail';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number; // Harga Jual (Rp)
  cost: number;  // Harga Pokok Penjualan / Modal per unit (Rp)
  stock: number; // Stok Produk Jadi Saat Ini
  minStock: number; // Batas Peringatan Stok Menipis
  unit: string; // cup, pcs, porsi, bungkus
  isActive: boolean;
  description?: string;
}

export interface OrderItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  unit: string;
}

export type PaymentMethod = 'TUNAI' | 'QRIS' | 'TRANSFER';

export type OrderSource = 'KASIR_POS' | 'MEJA_QR';

export type FulfillmentStatus = 'BARU' | 'DIPROSES' | 'SELESAI';

export interface Transaction {
  id: string;
  receiptNumber: string;
  createdAt: string; // ISO string
  cashierRole: UserRole | 'PELANGGAN_QR';
  customerName?: string;
  tableNumber?: string; // Misal: "Meja 01", "Meja 02", atau "Takeaway"
  orderSource?: OrderSource;
  fulfillmentStatus?: FulfillmentStatus;
  paymentReference?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number; // Total HPP saat transaksi terjadi
  paymentMethod: PaymentMethod;
  cashReceived: number;
  changeAmount: number;
  note?: string;
}

export type StockMovementType = 'IN_RESTOCK' | 'OUT_SALE' | 'OUT_WASTE' | 'ADJUSTMENT';

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantityChange: number; // Positif untuk masuk, negatif untuk keluar
  previousStock: number;
  newStock: number;
  unitCostImpact: number; // Nilai kerugian jika OUT_WASTE (quantity * unit cost)
  note: string;
  createdAt: string;
  actorRole: UserRole | 'PELANGGAN_QR';
}

export type ExpenseCategory = 'Bahan Pendukung' | 'Kemasan & Cup' | 'Utilitas & Listrik' | 'Operasional Lainnya';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  createdAt: string;
  note?: string;
  actorRole: UserRole;
}

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  storeAddress: string;
  storePhone: string;
  ownerPin: string;
  wifiInfo: string;
  tableCount: number; // Jumlah meja untuk QR
  qrisMerchantName: string;
  qrisNmid: string;
}

export interface AppDatabase {
  version: number;
  settings: StoreSettings;
  products: Product[];
  transactions: Transaction[];
  stockLogs: StockLog[];
  expenses: Expense[];
}
