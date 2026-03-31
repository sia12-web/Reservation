import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, LogOut, Menu, X, ShieldAlert } from "lucide-react";
import PromptSystem from "../../components/admin/PromptSystem";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { label: "Reservations", path: "/admin/reservations", icon: <CalendarDays className="w-5 h-5" /> },
        { label: "Floor Map", path: "/admin/floor", icon: <LayoutDashboard className="w-5 h-5" /> },
        { label: "Closures", path: "/admin/blackouts", icon: <ShieldAlert className="w-5 h-5" /> },
    ];

    useEffect(() => {
        const currentItem = navItems.find((n) => n.path === location.pathname);
        document.title = currentItem ? `Diba Portal - ${currentItem.label}` : "Diba Portal - Admin";
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem("admin_pin");
        window.location.href = "/admin/login";
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                w-56 bg-slate-900 text-white flex flex-col fixed inset-y-0 z-50 shadow-xl transition-transform duration-300
                ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
                md:translate-x-0
            `}>
                <div className="p-5 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <img src="/favicon.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white" />
                        <span className="text-lg font-bold tracking-tight">Portal</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden text-slate-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <nav className="flex-grow p-4 space-y-2 mt-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === item.path
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                        >
                            {item.icon}
                            <span className="font-semibold">{item.label}</span>
                        </Link>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-all w-full font-semibold"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-h-screen transition-all duration-300 md:ml-56">
                <header className="bg-white border-b border-slate-200 h-14 md:h-14 flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
                            {navItems.find((n) => n.path === location.pathname)?.label ?? "Dashboard"}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-900">Administrator</p>
                            <p className="text-xs text-slate-500">Diba Restaurant</p>
                        </div>
                        <img src="/favicon.png" alt="Admin" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-contain bg-slate-100" />
                    </div>
                </header>
                <div className="p-3 md:p-6 overflow-x-hidden">
                    {children}
                </div>
            </main>
            <PromptSystem />
        </div>
    );
}
