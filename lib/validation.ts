import type { PartnerStatus, PaymentStatus, TransactionStatus, TransactionType } from "@/types/domain";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function text(value: unknown, field: string, required = true) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new ValidationError(`${field} wajib diisi.`);
  return result;
}

export function positiveNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new ValidationError(`${field} harus lebih dari 0.`);
  return number;
}

export function nonNegativeNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new ValidationError(`${field} tidak boleh negatif.`);
  return number;
}

export function dateInput(value: unknown, field = "Tanggal") {
  const result = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new ValidationError(`${field} tidak valid.`);
  return result;
}

export function partnerStatus(value: unknown) {
  if (value === "aktif" || value === "potensi" || value === "reject") return value satisfies PartnerStatus;
  throw new ValidationError("Status mitra tidak valid.");
}

export function paymentStatus(value: unknown) {
  if (value === "paid" || value === "unpaid") return value satisfies PaymentStatus;
  throw new ValidationError("Status pembayaran tidak valid.");
}

export function transactionType(value: unknown) {
  if (value === "income" || value === "outcome") return value satisfies TransactionType;
  throw new ValidationError("Tipe transaksi tidak valid.");
}

export function transactionStatus(value: unknown) {
  if (value === "paid" || value === "pending") return value satisfies TransactionStatus;
  throw new ValidationError("Status transaksi tidak valid.");
}

export function phone(value: unknown) {
  const result = text(value, "Nomor HP");
  if (!/^[+0-9][0-9\s-]{7,18}$/.test(result)) throw new ValidationError("Nomor HP tidak valid.");
  return result;
}
