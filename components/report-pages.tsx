"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/layout/auth-provider";
import { clientApiCall } from "@/lib/firestore-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDate, numberId, rupiah, todayInput } from "@/lib/utils";
import { statusBayar, statusTransaksi, tipeTransaksi } from "@/lib/labels";
import type { CollectionRecord, Transaction } from "@/types/domain";

function requestId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function call(method = "GET", body?: unknown, suffix = "") {
    setError("");
    return clientApiCall(path, method, body, suffix);
  }

  async function reload(suffix = "") {
    setLoading(true);
    try {
      setData(await call("GET", undefined, suffix) as T);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request gagal.");
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

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { appUser } = useAuth();
  if (appUser?.role !== "admin") {
    return (
      <AppShell>
        <PageHeader title="Akses Ditolak" description="Halaman ini hanya untuk Admin." />
      </AppShell>
    );
  }
  return <>{children}</>;
}

function Notice({ error, loading }: { error?: string; loading?: boolean }) {
  if (loading) return <div className="mb-4 rounded-md border border-[var(--border)] bg-white/5 px-4 py-3 text-sm text-slate-300">Memuat data...</div>;
  if (error) return <div className="mb-4 rounded-md border border-red-700/70 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>;
  return null;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{value}</div></Card>;
}

export function DashboardPage() {
  const api = useApi<{
    activePartners: number;
    potentialPartners: number;
    availableStock: number;
    monthExpense: number;
    latestCollections: CollectionRecord[];
    activity: Array<{ label: string; value: number }>;
  }>("/api/dashboard");
  const data = api.data;
  return (
    <AppShell>
      <PageHeader title="Dashboard" description="KPI dihitung dari Firestore: mitra non-deleted, inventory movement valid, dan field expense bulan berjalan." actions={<Button onClick={() => api.reload()}><Save size={16} />Refresh</Button>} />
      <Notice error={api.error} loading={api.loading} />
      {data && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <Kpi label="Mitra Aktif" value={numberId.format(data.activePartners)} />
            <Kpi label="Mitra Potensi" value={numberId.format(data.potentialPartners)} />
            <Kpi label="Stok Tersedia" value={`${numberId.format(data.availableStock)} kg`} />
            <Kpi label="Pengeluaran Bulan Ini" value={rupiah.format(data.monthExpense)} />
          </div>
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardTitle className="mb-4">Ringkasan Inventory</CardTitle>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.activity}>
                    <CartesianGrid stroke="#1d332b" />
                    <XAxis dataKey="label" stroke="#8ba39a" />
                    <YAxis stroke="#8ba39a" />
                    <Tooltip contentStyle={{ background: "#0e1a16", border: "1px solid #1d332b" }} />
                    <Bar dataKey="value" fill="#39a666" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardTitle className="mb-4">Aktivitas Operasional</CardTitle>
              <div className="grid gap-3 text-sm">
                {data.activity.map((item) => <div key={item.label} className="flex justify-between border-b border-[var(--border)] pb-3 last:border-0"><span className="text-slate-400">{item.label}</span><span>{numberId.format(item.value)} kg</span></div>)}
              </div>
            </Card>
          </div>
          <DataTable rows={data.latestCollections} columns={[
            { key: "tanggal", header: "Date", cell: (r) => formatDate(r.tanggal) },
            { key: "mitra", header: "Mitra", cell: (r) => r.mitraName },
            { key: "qty", header: "Quantity", cell: (r) => `${numberId.format(r.quantity)} kg` },
            { key: "total", header: "Total Harga", cell: (r) => rupiah.format(r.totalHarga) },
            { key: "status", header: "Status", cell: (r) => <Badge tone={r.statusPembayaran === "paid" ? "green" : "yellow"}>{statusBayar[r.statusPembayaran]}</Badge> }
          ]} empty="Belum ada collection." />
        </>
      )}
    </AppShell>
  );
}

export function TransactionsPage() {
  const api = useApi<Transaction[]>("/api/transactions");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState({ tanggal: todayInput(), tipe: "income", deskripsi: "", amount: "", paymentMethod: "cash", status: "paid" });
  const rows = useMemo(() => (api.data || []).filter((row) => (type === "all" || row.tipe === type) && (status === "all" || row.status === status) && row.deskripsi.toLowerCase().includes(search.toLowerCase())), [api.data, search, type, status]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.call(editing ? "PUT" : "POST", editing ? { ...form, id: editing.id } : { ...form, requestId: requestId("trx") });
    setEditing(null);
    setForm({ tanggal: todayInput(), tipe: "income", deskripsi: "", amount: "", paymentMethod: "cash", status: "paid" });
    await api.reload();
  }
  return (
    <AdminOnly>
      <AppShell>
        <PageHeader title="Transaksi" description="Admin only. Pending tidak dihitung sebagai cash movement selesai." />
        <Notice error={api.error} loading={api.loading} />
        <Card className="mb-5">
          <form onSubmit={submit} className="grid gap-4 lg:grid-cols-6">
            <Field label="Tanggal"><Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required /></Field>
            <Field label="Tipe"><Select value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value })}><option value="income">Income</option><option value="outcome">Outcome</option></Select></Field>
            <Field label="Deskripsi"><Input value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} required /></Field>
            <Field label="Amount"><Input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Payment"><Input value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} /></Field>
            <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="paid">Paid</option><option value="pending">Pending</option></Select></Field>
            <Button type="submit"><Plus size={16} />{editing ? "Simpan" : "Tambah Transaksi"}</Button>
          </form>
        </Card>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Input placeholder="Cari deskripsi..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={type} onChange={(e) => setType(e.target.value)}><option value="all">Semua tipe</option><option value="income">Income</option><option value="outcome">Outcome</option></Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Semua status</option><option value="paid">Paid</option><option value="pending">Pending</option></Select>
        </div>
        <DataTable rows={rows} columns={[
          { key: "tanggal", header: "Date", cell: (r) => formatDate(r.tanggal) },
          { key: "tipe", header: "Tipe", cell: (r) => <Badge tone={r.tipe === "income" ? "green" : "red"}>{tipeTransaksi[r.tipe]}</Badge> },
          { key: "desc", header: "Deskripsi", cell: (r) => r.deskripsi },
          { key: "amount", header: "Amount", cell: (r) => rupiah.format(r.amount) },
          { key: "status", header: "Status", cell: (r) => <Badge tone={r.status === "paid" ? "green" : "yellow"}>{statusTransaksi[r.status]}</Badge> },
          { key: "source", header: "Source", cell: (r) => r.sourceType === "manual" ? "Manual" : `Generated: ${r.sourceType}` },
          { key: "aksi", header: "Actions", cell: (r) => r.sourceType === "manual" ? <div className="flex gap-2"><Button className="h-8 px-3" onClick={() => { setEditing(r); setForm({ tanggal: r.tanggal, tipe: r.tipe, deskripsi: r.deskripsi, amount: String(r.amount), paymentMethod: r.paymentMethod, status: r.status }); }}>Edit</Button><Button className="h-8 border-red-800 bg-red-900/60 px-3 hover:bg-red-800" onClick={async () => { if (confirm("Hapus transaksi manual?")) { await api.call("DELETE", undefined, `?id=${r.id}`); await api.reload(); } }}><Trash2 size={14} /></Button></div> : <span className="text-slate-500">Lewat sumber</span> }
        ]} />
      </AppShell>
    </AdminOnly>
  );
}

export function MonthlyReportPage() {
  const monthDefault = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(monthDefault);
  const api = useApi<{ month: string; collectionIn: number; collectionOut: number; totalIncome: number; totalOutcome: number; fieldExpense: number; netProfit: number }>(`/api/monthly-report`);
  useEffect(() => {
    void api.reload(`?month=${month}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  const data = api.data;
  return (
    <AdminOnly>
      <AppShell>
        <PageHeader title="Monthly Report" description="Net Profit = Total Income - Total Outcome. Field Expense adalah subset outcome dan tidak dikurangkan dua kali." actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />} />
        <Notice error={api.error} loading={api.loading} />
        {data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Kpi label="Month" value={data.month} />
            <Kpi label="Collection In" value={`${numberId.format(data.collectionIn)} kg`} />
            <Kpi label="Collection Out" value={`${numberId.format(data.collectionOut)} kg`} />
            <Kpi label="Total Income" value={rupiah.format(data.totalIncome)} />
            <Kpi label="Total Outcome" value={rupiah.format(data.totalOutcome)} />
            <Kpi label="Field Expense" value={rupiah.format(data.fieldExpense)} />
            <Kpi label="Net Profit" value={rupiah.format(data.netProfit)} />
          </div>
        )}
      </AppShell>
    </AdminOnly>
  );
}
