# ⚠️ CRITICAL: Frontend Payment Integration Required

## Current Problem

The frontend booking flow does NOT show the payment modal immediately. Instead:

```
Current (BROKEN):
User books → Reservation created (PENDING_DEPOSIT) → Success page → User sees "check email" → Leaves website → 5 min timeout → Cancelled
```

**This is wrong!** User should pay BEFORE seeing success page.

---

## Required Fix

### What Needs to Happen:

```
Correct Flow:
User books → Reservation created (PENDING_DEPOSIT) → PAYMENT MODAL APPEARS (blocking) → User pays → Success page (CONFIRMED)
```

### Implementation Steps:

#### 1. Update `NewReservationPage.tsx` or `ReservationForm`

**File**: `frontend/src/routes/kiosk/NewReservationPage.tsx`

```typescript
import { useState } from "react";
import StripePaymentModal from "../../components/reservation/StripePaymentModal";

export default function NewReservationPage() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingReservation, setPendingReservation] = useState<ReservationResponse | null>(null);

  const handleSuccess = (response: ReservationResponse) => {
    // Check if deposit is required
    if (response.status === "PENDING_DEPOSIT" && response.clientSecret) {
      // Show payment modal immediately
      setPendingReservation(response);
      setShowPaymentModal(true);
    } else {
      // No payment needed, go to success page
      navigate(`/reservations/${response.reservationId}/success`, {
        state: { reservation: response },
      });
    }
  };

  const handlePaymentSuccess = () => {
    // Payment completed, now go to success page
    setShowPaymentModal(false);
    if (pendingReservation) {
      navigate(`/reservations/${pendingReservation.reservationId}/success`, {
        state: { reservation: { ...pendingReservation, status: "CONFIRMED" } },
      });
    }
  };

  return (
    <>
      <ReservationForm onSuccess={handleSuccess} />

      {/* Payment Modal - Blocks until payment complete */}
      {showPaymentModal && pendingReservation && (
        <StripePaymentModal
          clientSecret={pendingReservation.clientSecret!}
          reservationId={pendingReservation.reservationId}
          amount={50}
          onSuccess={handlePaymentSuccess}
          onCancel={() => {
            // User cancelled payment
            setShowPaymentModal(false);
            alert("Reservation will be cancelled in 5 minutes if payment not completed.");
          }}
        />
      )}
    </>
  );
}
```

#### 2. Make Payment Modal Non-Dismissible

**File**: `frontend/src/components/reservation/StripePaymentModal.tsx`

Update the modal to:
- Show prominent warning if user tries to close
- Add countdown timer (5 minutes)
- Block background clicks
- Show "You must complete payment to confirm reservation"

```typescript
// In StripePaymentModal.tsx
const [timeLeft, setTimeLeft] = useState(5 * 60); // 5 minutes in seconds

useEffect(() => {
  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        onCancel(); // Auto-close when time expires
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, []);

// Show timer in modal
<div className="text-red-600 font-bold text-center mb-4">
  Time remaining: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
</div>
```

#### 3. Remove PENDING_DEPOSIT Success Page

The user should NEVER see the success page with PENDING_DEPOSIT status. They should only see it after payment is confirmed.

**File**: `frontend/src/routes/kiosk/ReservationSuccessPage.tsx`

The PENDING_DEPOSIT section should be removed entirely, or just show a loading state:

```typescript
{reservation?.status === "PENDING_DEPOSIT" && (
  <div className="text-center p-8">
    <p className="text-lg text-gray-600">Processing payment...</p>
  </div>
)}
```

---

## Temporary Workaround (Current)

For now, the success page has been updated to:
- ❌ Remove "check your email" message (no email is sent)
- ❌ Update timeout from 15 min to 5 min
- ❌ Show urgent warning that reservation will be cancelled
- ❌ Ask user to call restaurant

**This is NOT a proper solution!** It's just to prevent confusion.

---

## Why This Matters

### Current Issues:
1. ❌ User thinks reservation is confirmed (it's not)
2. ❌ User leaves website (no payment happens)
3. ❌ 5 minutes pass → Reservation cancelled
4. ❌ User shows up → No table reserved
5. ❌ Bad customer experience

### After Proper Fix:
1. ✅ User creates reservation
2. ✅ Payment modal appears immediately (can't close)
3. ✅ User completes payment
4. ✅ Success page shows CONFIRMED status
5. ✅ Good customer experience

---

## Testing Checklist

After implementing:

- [ ] Book party of 10+
- [ ] Payment modal appears immediately
- [ ] Cannot close modal easily (confirmation dialog)
- [ ] Timer counts down from 5:00
- [ ] Payment form works
- [ ] After payment, goes to success page
- [ ] Success page shows CONFIRMED status
- [ ] Confirmation email received
- [ ] NO "check email" message
- [ ] If payment cancelled, shows warning

---

## Priority

**CRITICAL** - This should be fixed before launch!

The current flow is broken and will cause customer complaints.

---

## Files to Modify

1. `frontend/src/routes/kiosk/NewReservationPage.tsx` - Add payment modal logic
2. `frontend/src/components/reservation/StripePaymentModal.tsx` - Add timer, make non-dismissible
3. `frontend/src/routes/kiosk/ReservationSuccessPage.tsx` - Remove PENDING_DEPOSIT section
4. `frontend/src/components/reservation/ReservationSummary.tsx` - Already fixed ✅

---

**Estimated Time**: 2-3 hours
**Complexity**: Medium
**Impact**: HIGH - Directly affects user experience and revenue

---

Last Updated: 2026-04-30
