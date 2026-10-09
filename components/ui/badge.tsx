import { cn } from "@/lib/utils";

const toneClass = {
  green: "border-emerald-600/60 bg-emerald-500/12 text-emerald-200",
  yellow: "border-yellow-600/60 bg-yellow-500/12 text-yellow-100",
  red: "border-red-600/60 bg-red-500/12 text-red-100",
  blue: "border-sky-600/60 bg-sky-500/12 text-sky-100",
  gray: "border-slate-600/60 bg-slate-500/12 text-slate-200"
};

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: keyof typeof toneClass }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-medium", toneClass[tone])}>{children}</span>;
}
