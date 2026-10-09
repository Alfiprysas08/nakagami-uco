export type Role = "admin" | "ranger";
export type PartnerStatus = "aktif" | "potensi" | "reject";
export type PaymentStatus = "paid" | "unpaid";
export type MovementType = "in" | "out";
export type TransactionType = "income" | "outcome";
export type TransactionStatus = "paid" | "pending";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role;
};

export type Mitra = {
  id: string;
  namaMitra: string;
  tipeMitra: string;
  namaPerson: string;
  noHpPerson: string;
  status: PartnerStatus;
  catatan: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CollectionRecord = {
  id: string;
  tanggal: string;
  mitraId: string;
  mitraName: string;
  quantity: number;
  hargaSatuan: number;
  totalHarga: number;
  statusPembayaran: PaymentStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryMovement = {
  id: string;
  tanggal: string;
  type: MovementType;
  quantity: number;
  sourceType: "collection" | "manual" | "correction";
  sourceId: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FieldExpense = {
  id: string;
  tanggal: string;
  namaPengeluaran: string;
  amount: number;
  transactionId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  tanggal: string;
  tipe: TransactionType;
  deskripsi: string;
  amount: number;
  paymentMethod: string;
  status: TransactionStatus;
  sourceType: "manual" | "field_expense" | "collection";
  sourceId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
