"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { getClientAuth, getClientFirestore } from "@/lib/firebase-client";
import { dateInput, nonNegativeNumber, partnerStatus, paymentStatus, phone, positiveNumber, text, transactionStatus, transactionType } from "@/lib/validation";
import { monthRange } from "@/lib/utils";
import type { AppUser, CollectionRecord, FieldExpense, InventoryMovement, Mitra, Role, Transaction } from "@/types/domain";

type SortDirection = "asc" | "desc";

function serializeDoc<T>(snapshot: QueryDocumentSnapshot<DocumentData>): T & { id: string } {
  return { id: snapshot.id, ...(serializeData(snapshot.data()) as Record<string, unknown>) } as T & { id: string };
}

function serializeData(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeData(item)]));
  }
  return value;
}

function currentUid() {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) throw new Error("Belum login.");
  return uid;
}

function requireAdmin() {
  const role = getCachedRole();
  if (role !== "admin") throw new Error("Anda tidak memiliki akses ke halaman ini.");
}

let cachedRole: Role | null = null;

function getCachedRole() {
  return cachedRole;
}

function logFirestoreError(operation: string, details: Record<string, string | number | boolean | undefined>, error: unknown) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message, code: "code" in error && typeof error.code === "string" ? error.code : undefined }
      : { message: "Unknown error" };
  console.error("[Firestore]", operation, { ...details, error: safeError });
}

function indexDirection(direction: SortDirection) {
  return direction === "desc" ? "DESCENDING" : "ASCENDING";
}

function indexErrorMessage(collectionName: string, orderField: string, direction: SortDirection) {
  const order = indexDirection(direction);
  return [
    `Query Firestore untuk koleksi "${collectionName}" membutuhkan composite index yang cocok.`,
    `Konfigurasi: scope Collection, fields deletedAt ASCENDING, ${orderField} ${order}, __name__ ${order}.`,
    "Jika index yang aktif memakai arah berbeda, query tetap akan gagal meskipun status index Enabled."
  ].join(" ");
}

export async function getSignedInProfile(): Promise<AppUser> {
  const authUser = getClientAuth().currentUser;
  if (!authUser) throw new Error("Belum login.");

  const snapshot = await getDoc(doc(getClientFirestore(), "users", authUser.uid));
  const role = snapshot.get("role") as Role | undefined;
  if (role !== "admin" && role !== "ranger") {
    cachedRole = null;
    throw new Error("Akun belum memiliki role. Minta admin mengatur akses.");
  }

  cachedRole = role;
  return {
    uid: authUser.uid,
    email: authUser.email,
    displayName: snapshot.get("displayName") || authUser.displayName || null,
    role
  };
}

export async function clientApiCall<T>(path: string, method = "GET", body?: unknown, suffix = ""): Promise<T> {
  switch (path) {
    case "/api/dashboard":
      return getDashboard() as Promise<T>;
    case "/api/mitra":
      return mitraApi(method, body, suffix) as Promise<T>;
    case "/api/collections":
      return collectionsApi(method, body, suffix) as Promise<T>;
    case "/api/inventory-movements":
      return inventoryApi(method, body, suffix) as Promise<T>;
    case "/api/field-expenses":
      return fieldExpensesApi(method, body, suffix) as Promise<T>;
    case "/api/transactions":
      return transactionsApi(method, body, suffix) as Promise<T>;
    case "/api/monthly-report":
      return getMonthlyReport(suffix) as Promise<T>;
    default:
      throw new Error("Endpoint tidak dikenal.");
  }
}

async function listDocs<T>(collectionName: string, max: number, orderField = "createdAt", direction: SortDirection = "desc") {
  try {
    const snapshot = await getDocs(
      query(collection(getClientFirestore(), collectionName), where("deletedAt", "==", null), orderBy(orderField, direction), limit(max))
    );
    return snapshot.docs.map((item) => serializeDoc<T>(item));
  } catch (error) {
    logFirestoreError("listDocs", { collectionName, max, orderField, direction }, error);
    if (error && typeof error === "object" && "code" in error && error.code === "failed-precondition") {
      throw new Error(indexErrorMessage(collectionName, orderField, direction));
    }
    throw error;
  }
}

async function mitraApi(method: string, body?: unknown, suffix = "") {
  const firestore = getClientFirestore();
  if (method === "GET") return listDocs<Mitra>("mitra", 200);
  if (method === "POST") {
    const payload = body as Record<string, unknown>;
    const ref = doc(collection(firestore, "mitra"));
    await runTransaction(firestore, async (tx) => {
      const now = serverTimestamp();
      tx.set(ref, {
        namaMitra: text(payload.namaMitra, "Nama mitra"),
        tipeMitra: text(payload.tipeMitra, "Tipe mitra"),
        namaPerson: text(payload.namaPerson, "Nama person"),
        noHpPerson: phone(payload.noHpPerson),
        status: partnerStatus(payload.status),
        catatan: text(payload.catatan, "Catatan", false),
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
    });
    return { id: ref.id };
  }
  if (method === "PUT") {
    const payload = body as Record<string, unknown>;
    const id = text(payload.id, "ID");
    await updateDoc(doc(firestore, "mitra", id), {
      namaMitra: text(payload.namaMitra, "Nama mitra"),
      tipeMitra: text(payload.tipeMitra, "Tipe mitra"),
      namaPerson: text(payload.namaPerson, "Nama person"),
      noHpPerson: phone(payload.noHpPerson),
      status: partnerStatus(payload.status),
      catatan: text(payload.catatan, "Catatan", false),
      updatedAt: serverTimestamp()
    });
    return { ok: true };
  }
  if (method === "DELETE") {
    await updateDoc(doc(firestore, "mitra", idFromSuffix(suffix)), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ok: true };
  }
  throw new Error("Method tidak didukung.");
}

async function collectionsApi(method: string, body?: unknown, suffix = "") {
  const firestore = getClientFirestore();
  if (method === "GET") return listDocs<CollectionRecord>("collections", 200, "tanggal");
  if (method === "POST") {
    const payload = body as Record<string, unknown>;
    const requestId = text(payload.requestId, "Request ID");
    const ref = doc(firestore, "collections", requestId);
    await runTransaction(firestore, async (tx) => {
      if ((await tx.get(ref)).exists()) return;
      const mitraId = text(payload.mitraId, "Mitra");
      const mitraDoc = await tx.get(doc(firestore, "mitra", mitraId));
      if (!mitraDoc.exists() || mitraDoc.get("deletedAt")) throw new Error("Mitra tidak ditemukan.");
      const quantity = positiveNumber(payload.quantity, "Quantity");
      const hargaSatuan = nonNegativeNumber(payload.hargaSatuan, "Harga satuan");
      const tanggal = dateInput(payload.tanggal);
      const now = serverTimestamp();
      tx.set(ref, {
        tanggal,
        mitraId,
        mitraName: mitraDoc.get("namaMitra"),
        quantity,
        hargaSatuan,
        totalHarga: quantity * hargaSatuan,
        statusPembayaran: paymentStatus(payload.statusPembayaran),
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
      tx.set(doc(firestore, "inventory_movements", `collection_${ref.id}`), {
        tanggal,
        type: "in",
        quantity,
        sourceType: "collection",
        sourceId: ref.id,
        description: `Collection dari ${mitraDoc.get("namaMitra")}`,
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
    });
    return { id: ref.id };
  }
  if (method === "PUT") {
    const payload = body as Record<string, unknown>;
    const id = text(payload.id, "ID");
    const ref = doc(firestore, "collections", id);
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists() || current.get("deletedAt")) throw new Error("Collection tidak ditemukan.");
      const mitraId = text(payload.mitraId, "Mitra");
      const mitraDoc = await tx.get(doc(firestore, "mitra", mitraId));
      if (!mitraDoc.exists() || mitraDoc.get("deletedAt")) throw new Error("Mitra tidak ditemukan.");
      const quantity = positiveNumber(payload.quantity, "Quantity");
      const hargaSatuan = nonNegativeNumber(payload.hargaSatuan, "Harga satuan");
      const previousQuantity = Number(current.get("quantity") || 0);
      const delta = quantity - previousQuantity;
      const tanggal = dateInput(payload.tanggal);
      const now = serverTimestamp();
      tx.update(ref, {
        tanggal,
        mitraId,
        mitraName: mitraDoc.get("namaMitra"),
        quantity,
        hargaSatuan,
        totalHarga: quantity * hargaSatuan,
        statusPembayaran: paymentStatus(payload.statusPembayaran),
        updatedAt: now
      });
      if (delta !== 0) {
        tx.set(doc(firestore, "inventory_movements", `correction_${id}_${Date.now()}`), {
          tanggal,
          type: delta > 0 ? "in" : "out",
          quantity: Math.abs(delta),
          sourceType: "correction",
          sourceId: id,
          description: "Koreksi quantity collection",
          createdBy: currentUid(),
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        });
      }
    });
    return { ok: true };
  }
  if (method === "DELETE") {
    const id = idFromSuffix(suffix);
    const ref = doc(firestore, "collections", id);
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists() || current.get("deletedAt")) return;
      const now = serverTimestamp();
      tx.update(ref, { deletedAt: now, updatedAt: now });
      tx.set(doc(firestore, "inventory_movements", `reversal_${id}`), {
        tanggal: current.get("tanggal"),
        type: "out",
        quantity: Number(current.get("quantity") || 0),
        sourceType: "correction",
        sourceId: id,
        description: "Pembatalan collection",
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
    });
    return { ok: true };
  }
  throw new Error("Method tidak didukung.");
}

async function inventoryApi(method: string, body?: unknown, suffix = "") {
  const firestore = getClientFirestore();
  if (method === "GET") {
    const items = await listDocs<InventoryMovement>("inventory_movements", 300, "tanggal");
    const quantityIn = items.filter((item) => item.type === "in").reduce((sum, item) => sum + item.quantity, 0);
    const quantityOut = items.filter((item) => item.type === "out").reduce((sum, item) => sum + item.quantity, 0);
    return { items, quantityIn, quantityOut, stock: quantityIn - quantityOut };
  }
  if (method === "POST") {
    const payload = body as Record<string, unknown>;
    const requestId = text(payload.requestId, "Request ID");
    const quantity = positiveNumber(payload.quantity, "Quantity");
    const current = await inventoryApi("GET") as { stock: number };
    if (quantity > current.stock) throw new Error("Stock out melebihi stok tersedia.");
    const ref = doc(firestore, "inventory_movements", requestId);
    await runTransaction(firestore, async (tx) => {
      if ((await tx.get(ref)).exists()) return;
      const now = serverTimestamp();
      tx.set(ref, {
        tanggal: dateInput(payload.tanggal),
        type: "out",
        quantity,
        sourceType: "manual",
        sourceId: ref.id,
        description: text(payload.description, "Deskripsi", false),
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
    });
    return { id: ref.id };
  }
  if (method === "PUT") {
    const payload = body as Record<string, unknown>;
    const id = text(payload.id, "ID");
    const quantity = positiveNumber(payload.quantity, "Quantity");
    const ref = doc(firestore, "inventory_movements", id);
    const currentStock = await inventoryApi("GET") as { items: InventoryMovement[]; stock: number };
    const currentItem = currentStock.items.find((item) => item.id === id);
    if (!currentItem) throw new Error("Movement inventory tidak ditemukan.");
    const currentSignedQuantity = currentItem.type === "in" ? currentItem.quantity : -currentItem.quantity;
    const nextSignedQuantity = currentItem.type === "in" ? quantity : -quantity;
    if (currentStock.stock - currentSignedQuantity + nextSignedQuantity < 0) throw new Error("Perubahan quantity membuat stok tersedia menjadi negatif.");
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists() || current.get("deletedAt")) throw new Error("Movement inventory tidak ditemukan.");
      tx.update(ref, {
        tanggal: dateInput(payload.tanggal),
        quantity,
        description: text(payload.description, "Deskripsi", false),
        updatedAt: serverTimestamp()
      });
    });
    return { ok: true };
  }
  if (method === "DELETE") {
    const ref = doc(firestore, "inventory_movements", idFromSuffix(suffix));
    const currentStock = await inventoryApi("GET") as { items: InventoryMovement[]; stock: number };
    const currentItem = currentStock.items.find((item) => item.id === ref.id);
    if (currentItem?.type === "in" && currentStock.stock - currentItem.quantity < 0) throw new Error("Movement inventory tidak dapat dihapus karena stok tersedia akan menjadi negatif.");
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists() || current.get("deletedAt")) return;
      tx.update(ref, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    return { ok: true };
  }
  throw new Error("Method tidak didukung.");
}

async function fieldExpensesApi(method: string, body?: unknown, suffix = "") {
  const firestore = getClientFirestore();
  if (method === "GET") return listDocs<FieldExpense>("field_expenses", 200, "tanggal");
  if (method === "POST") {
    const payload = body as Record<string, unknown>;
    const requestId = text(payload.requestId, "Request ID");
    const expenseRef = doc(firestore, "field_expenses", requestId);
    const transactionRef = doc(firestore, "transactions", `field_expense_${requestId}`);
    await runTransaction(firestore, async (tx) => {
      if ((await tx.get(expenseRef)).exists()) return;
      const tanggal = dateInput(payload.tanggal);
      const namaPengeluaran = text(payload.namaPengeluaran, "Nama pengeluaran");
      const amount = positiveNumber(payload.amount, "Amount");
      const now = serverTimestamp();
      tx.set(transactionRef, {
        tanggal,
        tipe: "outcome",
        deskripsi: `Field Expense: ${namaPengeluaran}`,
        amount,
        paymentMethod: text(payload.paymentMethod, "Metode pembayaran", false) || "cash",
        status: "paid",
        sourceType: "field_expense",
        sourceId: expenseRef.id,
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
      tx.set(expenseRef, {
        tanggal,
        namaPengeluaran,
        amount,
        transactionId: transactionRef.id,
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
    });
    return { id: expenseRef.id, transactionId: transactionRef.id };
  }
  if (method === "PUT") {
    const payload = body as Record<string, unknown>;
    const id = text(payload.id, "ID");
    const expenseRef = doc(firestore, "field_expenses", id);
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(expenseRef);
      if (!current.exists() || current.get("deletedAt")) throw new Error("Field Expense tidak ditemukan.");
      const tanggal = dateInput(payload.tanggal);
      const namaPengeluaran = text(payload.namaPengeluaran, "Nama pengeluaran");
      const amount = positiveNumber(payload.amount, "Amount");
      const now = serverTimestamp();
      tx.update(expenseRef, { tanggal, namaPengeluaran, amount, updatedAt: now });
      tx.update(doc(firestore, "transactions", current.get("transactionId")), {
        tanggal,
        deskripsi: `Field Expense: ${namaPengeluaran}`,
        amount,
        updatedAt: now
      });
    });
    return { ok: true };
  }
  if (method === "DELETE") {
    const id = idFromSuffix(suffix);
    const expenseRef = doc(firestore, "field_expenses", id);
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(expenseRef);
      if (!current.exists() || current.get("deletedAt")) return;
      const now = serverTimestamp();
      tx.update(expenseRef, { deletedAt: now, updatedAt: now });
      tx.update(doc(firestore, "transactions", current.get("transactionId")), {
        status: "pending",
        deletedAt: now,
        updatedAt: now,
        deskripsi: `${current.get("namaPengeluaran")} (dibatalkan)`
      });
    });
    return { ok: true };
  }
  throw new Error("Method tidak didukung.");
}

async function transactionsApi(method: string, body?: unknown, suffix = "") {
  requireAdmin();
  const firestore = getClientFirestore();
  if (method === "GET") return listDocs<Transaction>("transactions", 300, "tanggal");
  if (method === "POST") {
    const payload = body as Record<string, unknown>;
    const requestId = text(payload.requestId, "Request ID");
    const ref = doc(firestore, "transactions", requestId);
    await runTransaction(firestore, async (tx) => {
      if ((await tx.get(ref)).exists()) return;
      const now = serverTimestamp();
      tx.set(ref, {
        tanggal: dateInput(payload.tanggal),
        tipe: transactionType(payload.tipe),
        deskripsi: text(payload.deskripsi, "Deskripsi"),
        amount: positiveNumber(payload.amount, "Amount"),
        paymentMethod: text(payload.paymentMethod, "Metode pembayaran", false) || "cash",
        status: transactionStatus(payload.status),
        sourceType: "manual",
        sourceId: ref.id,
        createdBy: currentUid(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      });
    });
    return { id: ref.id };
  }
  if (method === "PUT") {
    const payload = body as Record<string, unknown>;
    const id = text(payload.id, "ID");
    const ref = doc(firestore, "transactions", id);
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists() || current.get("deletedAt")) throw new Error("Transaksi tidak ditemukan.");
      if (current.get("sourceType") !== "manual") throw new Error("Transaksi terkait record bisnis harus diubah dari sumbernya.");
      tx.update(ref, {
        tanggal: dateInput(payload.tanggal),
        tipe: transactionType(payload.tipe),
        deskripsi: text(payload.deskripsi, "Deskripsi"),
        amount: positiveNumber(payload.amount, "Amount"),
        paymentMethod: text(payload.paymentMethod, "Metode pembayaran", false) || "cash",
        status: transactionStatus(payload.status),
        updatedAt: serverTimestamp()
      });
    });
    return { ok: true };
  }
  if (method === "DELETE") {
    const ref = doc(firestore, "transactions", idFromSuffix(suffix));
    await runTransaction(firestore, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists() || current.get("deletedAt")) return;
      if (current.get("sourceType") !== "manual") throw new Error("Transaksi terkait record bisnis tidak dapat dihapus dari halaman transaksi.");
      tx.update(ref, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    return { ok: true };
  }
  throw new Error("Method tidak didukung.");
}

async function getDashboard() {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const { start, end } = monthRange(month);
  const firestore = getClientFirestore();
  const [mitra, movements, expenses, collections] = await Promise.all([
    getDocs(query(collection(firestore, "mitra"), where("deletedAt", "==", null))),
    getDocs(query(collection(firestore, "inventory_movements"), where("deletedAt", "==", null))),
    getDocs(
      query(
        collection(firestore, "field_expenses"),
        where("deletedAt", "==", null),
        where("tanggal", ">=", start.toISOString().slice(0, 10)),
        where("tanggal", "<", end.toISOString().slice(0, 10)),
        orderBy("tanggal", "desc")
      )
    ),
    getDocs(query(collection(firestore, "collections"), where("deletedAt", "==", null), orderBy("tanggal", "desc"), limit(5)))
  ]);
  const quantityIn = movements.docs.filter((item) => item.get("type") === "in").reduce((sum, item) => sum + Number(item.get("quantity") || 0), 0);
  const quantityOut = movements.docs.filter((item) => item.get("type") === "out").reduce((sum, item) => sum + Number(item.get("quantity") || 0), 0);
  return {
    activePartners: mitra.docs.filter((item) => item.get("status") === "aktif").length,
    potentialPartners: mitra.docs.filter((item) => item.get("status") === "potensi").length,
    availableStock: quantityIn - quantityOut,
    monthExpense: expenses.docs.reduce((sum, item) => sum + Number(item.get("amount") || 0), 0),
    latestCollections: collections.docs.map((item) => serializeDoc<CollectionRecord>(item)),
    activity: [
      { label: "Quantity in", value: quantityIn },
      { label: "Quantity out", value: quantityOut },
      { label: "Stock tersedia", value: quantityIn - quantityOut }
    ]
  };
}

async function getMonthlyReport(suffix = "") {
  requireAdmin();
  const month = new URLSearchParams(suffix.replace(/^\?/, "")).get("month") || new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  const firestore = getClientFirestore();
  const [collections, movements, transactions] = await Promise.all([
    getDocs(query(collection(firestore, "collections"), where("deletedAt", "==", null), where("tanggal", ">=", from), where("tanggal", "<", to), orderBy("tanggal", "desc"))),
    getDocs(query(collection(firestore, "inventory_movements"), where("deletedAt", "==", null), where("tanggal", ">=", from), where("tanggal", "<", to), orderBy("tanggal", "desc"))),
    getDocs(query(collection(firestore, "transactions"), where("deletedAt", "==", null), where("tanggal", ">=", from), where("tanggal", "<", to), orderBy("tanggal", "desc")))
  ]);
  const paidTransactions = transactions.docs.filter((item) => item.get("status") === "paid");
  const totalIncome = paidTransactions.filter((item) => item.get("tipe") === "income").reduce((sum, item) => sum + Number(item.get("amount") || 0), 0);
  const totalOutcome = paidTransactions.filter((item) => item.get("tipe") === "outcome").reduce((sum, item) => sum + Number(item.get("amount") || 0), 0);
  const fieldExpense = paidTransactions
    .filter((item) => item.get("tipe") === "outcome" && item.get("sourceType") === "field_expense")
    .reduce((sum, item) => sum + Number(item.get("amount") || 0), 0);
  return {
    month,
    collectionIn: collections.docs.reduce((sum, item) => sum + Number(item.get("quantity") || 0), 0),
    collectionOut: movements.docs.filter((item) => item.get("type") === "out").reduce((sum, item) => sum + Number(item.get("quantity") || 0), 0),
    totalIncome,
    totalOutcome,
    fieldExpense,
    netProfit: totalIncome - totalOutcome
  };
}

function idFromSuffix(suffix: string) {
  const id = new URLSearchParams(suffix.replace(/^\?/, "")).get("id");
  return text(id, "ID");
}
