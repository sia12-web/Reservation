import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchReservationByShortId, cancelReservation, confirmDemoPayment } from "../../api/reservations.api";
import ClientShell from "../../app/layout/ClientShell";
import {
    Calendar,
    Clock,
    Users,
    Hash,
    XCircle,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ArrowRight,
    CreditCard
} from "lucide-react";
import StripePaymentModal from "../../components/reservation/StripePaymentModal";
import { toRestaurantTime, getRestaurantNow } from "../../utils/time";

import clsx from "clsx";

export default function ManageReservationPage() {
    const { shortId } = useParams<{ shortId: string }>();
    const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
    const [isPaying, setIsPaying] = useState(false);

    const { data: reservation, isLoading, error, refetch } = useQuery({
        queryKey: ["reservation", shortId],
        queryFn: () => fetchReservationByShortId(shortId!),
        enabled: !!shortId,
    });

    const cancelMutation = useMutation({
        mutationFn: () => cancelReservation(
            reservation!.shortId,
            "Cancelled by user via manage link",
            reservation!.clientPhone || ""
        ),
        onSuccess: () => {
            setIsConfirmingCancel(false);
            refetch();
        },
    });

    const demoPaymentMutation = useMutation({
        mutationFn: (id: string) => confirmDemoPayment(id),
        onSuccess: () => {
            refetch();
            alert("✅ Payment confirmed! Reservation is now CONFIRMED.");
        },
        onError: (error: any) => {
            console.error("Demo payment error:", error);
            alert(`❌ Error: ${error.message || "Payment failed"}`);
        },
    });

    if (isLoading) {
        return (
            <ClientShell title="Loading Reservation...">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
                </div>
            </ClientShell>
        );
    }

    if (error || !reservation) {
        return (
            <ClientShell title="Reservation Not Found" subtitle="We couldn't find a booking with that code.">
                <div className="bg-red-50 border border-red-100 p-8 rounded-2xl text-center space-y-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-red-700 font-black text-2xl tracking-tight">Reservation Not Found</p>
                        <p className="text-red-600 font-medium">We couldn't find a booking with that code.</p>
                        <p className="text-slate-500 text-sm">Please check the link in your email and try again.</p>
                    </div>
                    <div className="pt-4">
                        <Link
                            to="/reserve"
                            className="inline-flex items-center justify-center px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                        >
                            Make New Reservation
                        </Link>
                    </div>
                </div>
            </ClientShell>
        );
    }

    const isCancelled = reservation.status === "CANCELLED";
    const start = toRestaurantTime(reservation.startTime);
    const isPast = start.isBefore(getRestaurantNow());


    return (
        <ClientShell
            title="Manage Booking"
            subtitle={isCancelled ? "This reservation has been cancelled." : "Review or update your details below."}
        >
            <div className="space-y-8">
                {/* Payment Banner if Pending */}
                {!isCancelled && reservation.status === "PENDING_DEPOSIT" && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top duration-500">
                        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                            <CreditCard className="w-7 h-7" />
                        </div>
                        <div className="flex-grow text-center md:text-left space-y-1">
                            <h3 className="text-xl font-black text-amber-900 tracking-tight">Security Deposit Required</h3>
                            <p className="text-amber-700 font-medium">A $50 deposit is needed to confirm your large party reservation.</p>
                        </div>
                        <button
                            onClick={() => setIsPaying(true)}
                            disabled={demoPaymentMutation.isPending}
                            className="w-full md:w-auto px-8 py-4 bg-amber-600 text-white rounded-2xl font-black hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 uppercase tracking-wider text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {demoPaymentMutation.isPending ? "Processing..." : "Pay Deposit Now"}
                        </button>
                    </div>
                )}
                {/* Status Badge */}
                <div className={clsx(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider",
                    isCancelled ? "bg-red-100 text-red-700" : 
                    reservation.status === "PENDING_DEPOSIT" ? "bg-amber-100 text-amber-700" :
                    reservation.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                )}>
                    {isCancelled ? <XCircle className="w-4 h-4" /> : 
                     reservation.status === "CONFIRMED" ? <CheckCircle2 className="w-4 h-4" /> : 
                     reservation.status === "PENDING_DEPOSIT" ? <AlertTriangle className="w-4 h-4" /> : 
                     <Clock className="w-4 h-4" />}
                    {reservation.status.replace(/_/g, " ")}
                </div>

                {/* Reservation Card */}
                <div className="bg-white border-2 border-slate-100 rounded-3xl p-8 shadow-sm space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                <Calendar className="w-4 h-4" /> Date
                            </div>
                            <p className="text-xl font-black">{start.format("dddd, MMM D")}</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                <Clock className="w-4 h-4" /> Time
                            </div>
                            <p className="text-xl font-black">{start.format("h:mm A")}</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                <Users className="w-4 h-4" /> Party Size
                            </div>
                            <p className="text-xl font-black">{reservation.partySize} Guests</p>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                Name
                            </div>
                            <p className="font-bold text-lg">{reservation.clientName}</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                <Hash className="w-4 h-4" /> Code
                            </div>
                            <p className="font-mono font-bold text-lg text-slate-600">{reservation.shortId}</p>
                        </div>
                    </div>

                    {reservation.customerNotes && (
                        <div className="pt-8 border-t border-slate-50">
                            <div className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Special Request</div>
                            <p className="text-slate-600 leading-relaxed italic">"{reservation.customerNotes}"</p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {!isCancelled && !isPast && (
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button
                            onClick={() => {
                                alert("To change your reservation details, please call us at (514) 485-9999.");
                            }}
                            className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                        >
                            Modify Details <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsConfirmingCancel(true)}
                            className="flex-1 bg-white text-red-600 border-2 border-red-50 py-4 rounded-2xl font-bold hover:bg-red-50 transition-all"
                        >
                            Cancel Reservation
                        </button>
                    </div>
                )}

                {isPast && !isCancelled && (
                    <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl text-center">
                        <p className="text-slate-500 font-medium">This reservation is in the past and cannot be modified.</p>
                    </div>
                )}

                {/* Cancel Confirmation Modal/Overlay */}
                {isConfirmingCancel && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl p-8 max-sm w-full space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto">
                                <AlertTriangle className="w-10 h-10" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-slate-900">Are you sure?</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    Cancelling your reservation will release your table immediately. This action cannot be undone.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 pt-2">
                                <button
                                    disabled={cancelMutation.isPending}
                                    onClick={() => cancelMutation.mutate()}
                                    className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                                >
                                    {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Booking"}
                                </button>
                                <button
                                    onClick={() => setIsConfirmingCancel(false)}
                                    className="w-full bg-slate-100 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    Keep My Reservation
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stripe Payment Modal */}
                {isPaying && reservation.clientSecret && (
                    <StripePaymentModal 
                        clientSecret={reservation.clientSecret}
                        reservationId={reservation.id}
                        onSuccess={() => {
                            setIsPaying(false);
                            refetch();
                        }}
                        onCancel={() => setIsPaying(false)}
                        amount={50}
                        cancelLabel="Back to Details"
                    />
                )}
            </div>
        </ClientShell>
    );
}

