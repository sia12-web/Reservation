import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";

type ClientShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export default function ClientShell({ children, title, subtitle }: ClientShellProps) {
  useEffect(() => {
    document.title = title ? `Diba Restaurant - ${title}` : "Diba Restaurant - Reservation";
  }, [title]);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-5 py-8 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/favicon.png" alt="Diba Logo" className="w-10 h-10 rounded-lg object-contain" />
              <span className="text-xl font-bold tracking-tight">Diba Restaurant</span>
            </div>
            <div className="flex items-center">

              <a
                href="/admin/login"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl bg-slate-50 border border-slate-200 text-[10px] sm:text-xs font-black text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm whitespace-nowrap"
              >
                <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 group-hover:text-blue-300" />
                <span className="hidden xs:inline">Admin Portal</span>
                <span className="xs:hidden">Admin</span>
              </a>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{title ?? "Reserve a table"}</h1>
            {subtitle ? <p className="text-slate-600 text-lg">{subtitle}</p> : null}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-10 flex-grow w-full">
        {children}
      </main>

      <footer className="border-t border-slate-100 bg-slate-50 mt-10">
        <div className="max-w-4xl mx-auto px-5 py-8 grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="font-semibold">Visit Us</p>
            <p className="text-slate-600 text-sm leading-relaxed">
              6520 Somerled Ave,<br />
              Montreal, Quebec, H4V 1S8
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Contact</p>
            <p className="text-slate-600 text-sm">
              <a href="tel:+15144859999" className="hover:underline">(514) 485-9999</a>
            </p>
            <p className="text-slate-600 text-sm italic">Bring your own wine 🍷</p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-5 py-4 border-t border-slate-100 text-center flex justify-between items-center">
          <p className="text-xs text-slate-400">© 2025 Diba Restaurant. All Reserved.</p>

        </div>
      </footer>
    </div>
  );
}
