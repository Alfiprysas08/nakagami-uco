import { Card } from "@/components/ui/card";

export function DataTable<T>({
  rows,
  columns,
  empty = "Belum ada data."
}: {
  rows: T[];
  columns: Array<{ key: string; header: string; cell: (row: T) => React.ReactNode }>;
  empty?: string;
}) {
  return (
    <Card className="p-0">
      <div className="table-scroll">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-slate-400">
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="border-b border-[var(--border)] last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 align-middle text-slate-200">
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
