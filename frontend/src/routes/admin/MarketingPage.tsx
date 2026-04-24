import { useState, useEffect } from "react";
import { fetchMarketingContacts, syncMarketingContacts, type MarketingContact } from "../../api/admin.api";
import { Megaphone, Users, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export default function MarketingPage() {
    const [contacts, setContacts] = useState<MarketingContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ count: number; message: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadContacts = async () => {
        try {
            setIsLoading(true);
            const data = await fetchMarketingContacts();
            setContacts(data);
            setError(null);
        } catch (err) {
            setError("Failed to load marketing contacts.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadContacts();
    }, []);

    const handleSync = async () => {
        try {
            setIsSyncing(true);
            setSyncResult(null);
            const result = await syncMarketingContacts();
            setSyncResult({ count: result.count, message: result.message });
            await loadContacts(); // Refresh list in case
        } catch (err) {
            setError("Sync failed. Make sure BREVO_API_KEY is configured in your environment.");
            console.error(err);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-12 opacity-5">
                    <Megaphone className="w-48 h-48" />
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-blue-100 p-2 rounded-xl">
                            <Megaphone className="w-6 h-6 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">Marketing & Loyalty</h2>
                    </div>
                    
                    <p className="text-slate-600 max-w-2xl text-lg leading-relaxed">
                        Grow your business by staying in touch with your guests. Use this tool to sync your opted-in 
                        customers directly to your <strong>Brevo</strong> marketing list.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-4">
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-blue-200/50 ${
                                isSyncing ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                            }`}
                        >
                            {isSyncing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <RefreshCw className="w-5 h-5" />
                            )}
                            {isSyncing ? "Syncing..." : "Sync Contacts to Brevo"}
                        </button>
                        
                        <a 
                            href="https://app.brevo.com/campaign/list" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                        >
                            <ExternalLink className="w-5 h-5" />
                            Open Brevo Dashboard
                        </a>
                    </div>
                </div>
            </div>

            {/* Status Messages */}
            {syncResult && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                        <p className="font-bold text-green-900">Sync Successful!</p>
                        <p className="text-sm text-green-700">{syncResult.message}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <div>
                        <p className="font-bold text-red-900">System Notice</p>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}

            {/* List Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-slate-900">Opted-in Customers</h3>
                    </div>
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                        {contacts.length} Total
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email Address</th>
                                <th className="px-6 py-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-48"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : contacts.length > 0 ? (
                                contacts.map((contact) => (
                                    <tr key={contact.email} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-slate-900">{contact.clientName}</td>
                                        <td className="px-6 py-4 text-slate-600 font-mono text-sm">{contact.email}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Opted In
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p>No customers have opted in yet.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="p-4 bg-slate-100/50 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 text-center">
                    <strong>Note:</strong> Customers are identified by their unique email address. If a customer books multiple times, they will only appear once in this list. 
                    Syncing will never send duplicate emails.
                </p>
            </div>
        </div>
    );
}
