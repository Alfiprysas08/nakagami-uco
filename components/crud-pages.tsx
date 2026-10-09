"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { clientApiCall } from "@/lib/firestore-api";
import { formatDate, numberId, rupiah, todayInput } from "@/lib/utils";
import { statusBayar, statusMitra } from "@/lib/labels";
import type { CollectionRecord, FieldExpense, InventoryMovement, Mitra } from "@/types/domain";

function requestId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function call(method = "GET", body?: unknown, suffix = "") {
    setError("");
    try {
      return await clientApiCall(path, method, body, suffix);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request gagal.";
      setError(message);
      throw err;
    }
  }

  async function reload(options: { throwOnError?: boolean } = {}) {
    setLoading(true);
    try {
      setData(await call() as T);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request gagal.");
      if (options.throwOnError) throw err;
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, loading, error, reload, call };
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function Notice({ error, loading }: { error?: string; loading?: boolean }) {
  if (loading) return <div className="mb-4 rounded-md border border-[var(--border)] bg-white/5 px-4 py-3 text-sm text-slate-300">Memuat data...</div>;
  if (error) return <div className="mb-4 rounded-md border border-red-700/70 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>;
  return null;
}

function SuccessNotice({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="mb-4 rounded-md border border-emerald-700/70 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>;
}

export function MitraPage() {
  const api = useApi<Mitra[]>("/api/mitra");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Mitra | null>(null);
  const [form, setForm] = useState({ namaMitra: "", tipeMitra: "", namaPerson: "", noHpPerson: "", status: "aktif", catatan: "" });
  const [success, setSuccess] = useState("");
  const rows = useMemo(
    () =>
      (api.data || []).filter(
        (item) =>
          (filter === "all" || item.status === filter) &&
          [item.namaMitra, item.namaPerson, item.tipeMitra].join(" ").toLowerCase().includes(search.toLowerCase())
      ),
    [api.data, search, filter]
  );

  function edit(item: Mitra) {
    setEditing(item);
    setForm({ ...item });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSuccess("");
    try {
      await api.call(editing ? "PUT" : "POST", editing ? { ...form, id: editing.id } : form);
      await api.reload({ throwOnError: true });
      setEditing(null);
      setForm({ namaMitra: "", tipeMitra: "", namaPerson: "", noHpPerson: "", status: "aktif", catatan: "" });
      setSuccess(editing ? "Mitra berhasil diperbarui dan daftar sudah dimuat ulang." : "Mitra berhasil ditambahkan dan daftar sudah dimuat ulang.");
    } catch {
      setSuccess("");
    }
  }

  return (
    <AppShell>
      <PageHeader title="Mitra" description="Kelola partner UCO aktif, potensi, dan reject." />
      <Notice error={api.error} loading={api.loading} />
      <SuccessNotice message={success} />
      <Card className="mb-5">
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
          <Field label="Nama Mitra"><Input value={form.namaMitra} onChange={(e) => setForm({ ...form, namaMitra: e.target.value })} required /></Field>
          <Field label="Tipe Mitra"><Input value={form.tipeMitra} onChange={(e) => setForm({ ...form, tipeMitra: e.target.value })} required /></Field>
          <Field label="Nama Person"><Input value={form.namaPerson} onChange={(e) => setForm({ ...form, namaPerson: e.target.value })} required /></Field>
          <Field label="No HP"><Input value={form.noHpPerson} onChange={(e) => setForm({ ...form, noHpPerson: e.target.value })} required /></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="aktif">Aktif</option><option value="potensi">Potensi</option><option value="reject">Reject</option></Select></Field>
          <Field label="Catatan"><Input value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></Field>
          <Actions>
            <Button type="submit"><Save size={16} />{editing ? "Simpan" : "Tambah"}</Button>
            {editing && <Button type="button" className="border-slate-700 bg-transparent hover:bg-white/5" onClick={() => setEditing(null)}><X size={16} />Batal</Button>}
          </Actions>
        </form>
      </Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={16} /><Input className="pl-9" placeholder="Cari mitra..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Semua status</option><option value="aktif">Aktif</option><option value="potensi">Potensi</option><option value="reject">Reject</option></Select>
      </div>
      <DataTable rows={rows} columns={[
        { key: "nama", header: "Nama Mitra", cell: (r) => r.namaMitra },
        { key: "tipe", header: "Tipe", cell: (r) => r.tipeMitra },
        { key: "person", header: "Person", cell: (r) => `${r.namaPerson} · ${r.noHpPerson}` },
        { key: "status", header: "Status", cell: (r) => <Badge tone={r.status === "aktif" ? "green" : r.status === "potensi" ? "yellow" : "red"}>{statusMitra[r.status]}</Badge> },
        { key: "catatan", header: "Catatan", cell: (r) => r.catatan || "-" },
        { key: "aksi", header: "Actions", cell: (r) => <Actions><Button className="h-8 px-3" onClick={() => edit(r)}>Edit</Button><Button className="h-8 border-red-800 bg-red-900/60 px-3 hover:bg-red-800" onClick={async () => { if (confirm("Hapus mitra ini?")) { await api.call("DELETE", undefined, `?id=${r.id}`); await api.reload(); } }}><Trash2 size={14} /></Button></Actions> }
      ]} />
    </AppShell>
  );
}

export function CollectionPage() {
  const api = useApi<CollectionRecord[]>("/api/collections");
  const mitra = useApi<Mitra[]>("/api/mitra");
  const [form, setForm] = useState({ tanggal: todayInput(), mitraId: "", quantity: "", hargaSatuan: "", statusPembayaran: "unpaid" });
  const [editing, setEditing] = useState<CollectionRecord | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = editing ? { ...form, id: editing.id } : { ...form, requestId: requestId("collection") };
    await api.call(editing ? "PUT" : "POST", body);
    setEditing(null);
    setForm({ tanggal: todayInput(), mitraId: "", quantity: "", hargaSatuan: "", statusPembayaran: "unpaid" });
    await api.reload();
  }
  return (
    <AppShell>
      <PageHeader title="Collection" description="Total harga dihitung ulang di server: quantity x harga/kg." />
      <Notice error={api.error || mitra.error} loading={api.loading || mitra.loading} />
      <Card className="mb-5">
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-5">
          <Field label="Tanggal"><Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required /></Field>
          <Field label="Mitra"><Select value={form.mitraId} onChange={(e) => setForm({ ...form, mitraId: e.target.value })} required><option value="">Pilih mitra</option>{(mitra.data || []).map((m) => <option key={m.id} value={m.id}>{m.namaMitra}</option>)}</Select></Field>
          <Field label="Quantity (kg)"><Input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></Field>
          <Field label="Harga/kg"><Input type="number" min="0" value={form.hargaSatuan} onChange={(e) => setForm({ ...form, hargaSatuan: e.target.value })} required /></Field>
          <Field label="Status"><Select value={form.statusPembayaran} onChange={(e) => setForm({ ...form, statusPembayaran: e.target.value })}><option value="unpaid">Unpaid</option><option value="paid">Paid</option></Select></Field>
          <Actions><Button type="submit"><Plus size={16} />{editing ? "Simpan" : "Tambah Collection"}</Button></Actions>
        </form>
      </Card>
      <DataTable rows={api.data || []} columns={[
        { key: "tanggal", header: "Date", cell: (r) => formatDate(r.tanggal) },
        { key: "mitra", header: "Mitra", cell: (r) => r.mitraName },
        { key: "qty", header: "Quantity", cell: (r) => `${numberId.format(r.quantity)} kg` },
        { key: "harga", header: "Harga/kg", cell: (r) => rupiah.format(r.hargaSatuan) },
        { key: "total", header: "Total Harga", cell: (r) => rupiah.format(r.totalHarga) },
        { key: "status", header: "Status", cell: (r) => <Badge tone={r.statusPembayaran === "paid" ? "green" : "yellow"}>{statusBayar[r.statusPembayaran]}</Badge> },
        { key: "aksi", header: "Actions", cell: (r) => <Actions><Button className="h-8 px-3" onClick={() => { setEditing(r); setForm({ tanggal: r.tanggal, mitraId: r.mitraId, quantity: String(r.quantity), hargaSatuan: String(r.hargaSatuan), statusPembayaran: r.statusPembayaran }); }}>Edit</Button><Button className="h-8 border-red-800 bg-red-900/60 px-3 hover:bg-red-800" onClick={async () => { if (confirm("Batalkan collection? Sistem akan membuat reversal movement.")) { await api.call("DELETE", undefined, `?id=${r.id}`); await api.reload(); } }}><Trash2 size={14} /></Button></Actions> }
      ]} />
    </AppShell>
  );
}

export function InventoryPage() {
  const api = useApi<{ items: InventoryMovement[]; quantityIn: number; quantityOut: number; stock: number }>("/api/inventory-movements");
  const [form, setForm] = useState({ tanggal: todayInput(), quantity: "", description: "" });
  const [editing, setEditing] = useState<InventoryMovement | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.call(editing ? "PUT" : "POST", editing ? { ...form, id: editing.id } : { ...form, requestId: requestId("stockout") });
    setEditing(null);
    setForm({ tanggal: todayInput(), quantity: "", description: "" });
    await api.reload();
  }
  function cancelEdit() {
    setEditing(null);
    setForm({ tanggal: todayInput(), quantity: "", description: "" });
  }
  const data = api.data || { items: [], quantityIn: 0, quantityOut: 0, stock: 0 };
  return (
    <AppShell>
      <PageHeader title="Inventory" description="Quantity in berasal dari collection valid. Pembatalan collection dicatat sebagai movement reversal, bukan mengubah histori diam-diam." />
      <Notice error={api.error} loading={api.loading} />
      <div className="mb-5 grid gap-4 md:grid-cols-3"><Kpi label="Total Quantity In" value={`${numberId.format(data.quantityIn)} kg`} /><Kpi label="Total Quantity Out" value={`${numberId.format(data.quantityOut)} kg`} /><Kpi label="Stok Tersedia" value={`${numberId.format(data.stock)} kg`} /></div>
      <Card className="mb-5">
        <CardTitle className="mb-4">Stock Out Manual</CardTitle>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
          <Field label="Tanggal"><Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required /></Field>
          <Field label="Quantity (kg)"><Input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></Field>
          <Field label="Deskripsi"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Actions>
            <Button type="submit">{editing ? "Simpan" : "Catat Stock Out"}</Button>
            {editing && <Button type="button" className="border-slate-700 bg-transparent hover:bg-white/5" onClick={cancelEdit}><X size={16} />Batal</Button>}
          </Actions>
        </form>
      </Card>
      <DataTable rows={data.items} columns={[
        { key: "tanggal", header: "Date", cell: (r) => formatDate(r.tanggal) },
        { key: "type", header: "Type", cell: (r) => <Badge tone={r.type === "in" ? "green" : "red"}>{r.type.toUpperCase()}</Badge> },
        { key: "qty", header: "Quantity", cell: (r) => `${numberId.format(r.quantity)} kg` },
        { key: "source", header: "Source", cell: (r) => `${r.sourceType} · ${r.sourceId}` },
        { key: "desc", header: "Description", cell: (r) => r.description || "-" },
        { key: "aksi", header: "Actions", cell: (r) => <Actions><Button className="h-8 px-3" onClick={() => { setEditing(r); setForm({ tanggal: r.tanggal, quantity: String(r.quantity), description: r.description }); }}>Edit</Button><Button className="h-8 border-red-800 bg-red-900/60 px-3 hover:bg-red-800" onClick={async () => { if (confirm("Hapus movement inventory ini?")) { await api.call("DELETE", undefined, `?id=${r.id}`); await api.reload(); } }}><Trash2 size={14} /></Button></Actions> }
      ]} />
    </AppShell>
  );
}

export function FieldExpensePage() {
  const api = useApi<FieldExpense[]>("/api/field-expenses");
  const [form, setForm] = useState({ tanggal: todayInput(), namaPengeluaran: "", amount: "" });
  const [editing, setEditing] = useState<FieldExpense | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.call(editing ? "PUT" : "POST", editing ? { ...form, id: editing.id } : { ...form, requestId: requestId("expense") });
    setEditing(null);
    setForm({ tanggal: todayInput(), namaPengeluaran: "", amount: "" });
    await api.reload();
  }
  return (
    <AppShell>
      <PageHeader title="Field Expense" description="Setiap expense membuat tepat satu transaksi outcome tertaut. Ranger dapat mencatat expense tanpa akses halaman Transaksi." />
      <Notice error={api.error} loading={api.loading} />
      <Card className="mb-5">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
          <Field label="Tanggal"><Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required /></Field>
          <Field label="Nama Pengeluaran"><Input value={form.namaPengeluaran} onChange={(e) => setForm({ ...form, namaPengeluaran: e.target.value })} required /></Field>
          <Field label="Amount"><Input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
          <Actions><Button type="submit"><Save size={16} />{editing ? "Simpan" : "Tambah Expense"}</Button></Actions>
        </form>
      </Card>
      <DataTable rows={api.data || []} columns={[
        { key: "tanggal", header: "Date", cell: (r) => formatDate(r.tanggal) },
        { key: "nama", header: "Expense Name", cell: (r) => r.namaPengeluaran },
        { key: "amount", header: "Amount", cell: (r) => rupiah.format(r.amount) },
        { key: "trx", header: "Transaction ID", cell: (r) => r.transactionId },
        { key: "aksi", header: "Actions", cell: (r) => <Actions><Button className="h-8 px-3" onClick={() => { setEditing(r); setForm({ tanggal: r.tanggal, namaPengeluaran: r.namaPengeluaran, amount: String(r.amount) }); }}>Edit</Button><Button className="h-8 border-red-800 bg-red-900/60 px-3 hover:bg-red-800" onClick={async () => { if (confirm("Batalkan expense dan transaksi tertaut?")) { await api.call("DELETE", undefined, `?id=${r.id}`); await api.reload(); } }}><Trash2 size={14} /></Button></Actions> }
      ]} />
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{value}</div></Card>;
}
