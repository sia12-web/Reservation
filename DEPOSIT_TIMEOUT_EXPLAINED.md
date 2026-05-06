# Deposit Timeout Policy - How It Works

## Overview

The system uses **different timeout periods** based on how the reservation was made, to provide the best user experience.

---

## Scenario 1: Direct Reservation (Party ≥ 10)

### User Journey
```
1. Guest visits website
2. Fills booking form (name, party size, time)
3. Selects table from floor map
4. Clicks "Reserve"
   ↓
5. 🎯 Payment form appears immediately (Stripe modal)
   "Complete payment to confirm your reservation"
   ↓
6. Guest enters credit card
7. Clicks "Pay $50"
   ↓
8. ✅ Reservation CONFIRMED
9. Email confirmation sent
```

### Timeout: **5 Minutes**

**Why 5 minutes?**
- Guest is **actively on the website** with payment form open
- Payment form is **right in front of them**
- No need to check email or find a link
- 5 minutes is generous for completing a payment form
- Prevents tables being held indefinitely if guest closes browser

**What happens if they don't pay within 5 minutes?**
1. Reservation auto-cancelled
2. Tables released immediately
3. Email sent: "Your reservation was cancelled because payment was not completed within 5 minutes"

**Why this works:**
- ✅ Guest has payment form open (can't forget)
- ✅ No confusion about "pending" state
- ✅ Tables don't get locked for 30+ minutes
- ✅ Quick turnaround if guest abandons booking
- ✅ Other guests can book those tables quickly

---

## Scenario 2: Waitlist Promotion (Party ≥ 10)

### User Journey
```
1. Guest books 10+ people
2. No tables available → Added to WAITLIST
3. Email: "You're on the waitlist. We'll notify you when a table opens."
   ↓
   [Time passes... another guest cancels]
   ↓
4. Admin promotes guest to available table
   OR
   System auto-promotes (if implemented)
   ↓
5. 📧 Email sent:
   "Good news! A table is now available for your party!"
   "Please complete your $50 deposit within 60 minutes"
   [Payment Link]
   ↓
6. Guest checks email (maybe not immediately)
7. Clicks payment link
8. Completes payment
   ↓
9. ✅ Reservation CONFIRMED
10. Email confirmation sent
```

### Timeout: **60 Minutes**

**Why 60 minutes?**
- Guest is **NOT on the website** anymore
- They need time to:
  - Check their email
  - Find the email (might be in spam)
  - Open the link
  - Complete payment
- More reasonable for email-based notification
- Still fast enough to fill the table

**What happens if they don't pay within 60 minutes?**
1. Reservation auto-cancelled
2. Tables released
3. Next person on waitlist can be promoted
4. Email sent: "Your reservation was cancelled because payment was not completed within 60 minutes"

**Why this works:**
- ✅ Enough time to check email and respond
- ✅ Not too long (table doesn't sit empty)
- ✅ Fair to other guests waiting
- ✅ Creates urgency without stress

---

## Technical Implementation

### How the System Knows the Difference

**Direct Reservations:**
- `depositRequestedAt` = `null` (not set)
- Timeout checks `createdAt` timestamp
- 5-minute window from reservation creation

**Waitlist Promotions:**
- `depositRequestedAt` = timestamp when promoted
- Timeout checks `depositRequestedAt` timestamp
- 60-minute window from promotion time

### Cleanup Job (Runs Every Minute)

```typescript
// Direct reservations (payment form on screen)
const directCutoff = new Date(Date.now() - 5 * 60_000); // 5 minutes ago

// Waitlist promotions (email notification)
const promotedCutoff = new Date(Date.now() - 60 * 60_000); // 60 minutes ago

// Find stale reservations
const stale = await prisma.reservation.findMany({
  where: {
    status: "PENDING_DEPOSIT",
    OR: [
      // Direct: no depositRequestedAt, check createdAt
      { depositRequestedAt: null, createdAt: { lt: directCutoff } },

      // Promoted: has depositRequestedAt, check it
      { depositRequestedAt: { not: null, lt: promotedCutoff } },
    ],
  },
});

// Cancel stale reservations, release tables, send emails
```

---

## Email Notifications

### Direct Reservation Timeout Email
```
Subject: Reservation Cancelled - Payment Not Completed

Hi [Name],

Your reservation for [Party Size] guests on [Date] at [Time]
was automatically cancelled because the security deposit was
not completed within 5 minutes.

You can rebook anytime on our website.

- Diba Restaurant
```

### Waitlist Promotion Timeout Email
```
Subject: Reservation Cancelled - Payment Not Completed

Hi [Name],

Your reservation for [Party Size] guests on [Date] at [Time]
was automatically cancelled because the security deposit was
not completed within 60 minutes.

We've released this table to the next guest. You can rebook
anytime on our website.

- Diba Restaurant
```

---

## Configuration

All timeouts are configured in: `src/jobs/cleanupPendingDeposits.ts`

```typescript
// Easy to adjust if needed
const directCutoff = new Date(Date.now() - 5 * 60_000);      // 5 minutes
const promotedCutoff = new Date(Date.now() - 60 * 60_000);   // 60 minutes
```

**To change timeouts:**
1. Edit the file above
2. Test locally
3. Merge to main
4. Deploy to Railway

---

## Benefits of This Approach

### For Direct Reservations (5 min)
✅ **No abandoned reservations** - Quick cleanup
✅ **Tables available faster** - Other guests can book
✅ **Clear user experience** - Payment required NOW
✅ **No confusion** - Guest knows they must pay immediately
✅ **Low friction** - 5 minutes is plenty when form is open

### For Waitlist (60 min)
✅ **Fair to guests** - Enough time to check email
✅ **Not too long** - Table doesn't sit empty
✅ **Automated** - No manual admin intervention needed
✅ **Creates urgency** - Guests respond quickly
✅ **Professional** - Better than manual phone calls

---

## Alternative Approaches Considered

### ❌ Same Timeout for Both (30 min)
**Problem**: Too long for direct (table held unnecessarily), too short for waitlist (guests miss email)

### ❌ No Timeout for Waitlist
**Problem**: Tables held indefinitely, no urgency, poor user experience

### ❌ Manual Phone Calls
**Problem**: Time-consuming, doesn't scale, requires staff availability

### ✅ Current: Smart Timeouts (5 min / 60 min)
**Winner**: Best balance of UX, automation, and table turnover

---

## Monitoring & Metrics

**Track these metrics:**
- % of direct reservations completed within 5 minutes
- % of waitlist promotions completed within 60 minutes
- Average time to payment for each type
- Cancellation rate due to timeout
- Table utilization efficiency

**Expected rates:**
- Direct: 90%+ completion (payment form is open)
- Waitlist: 70-80% completion (depends on email checking)

---

## Troubleshooting

**"Guests are complaining about 5-minute timeout"**
→ Payment form should be non-dismissible (can't close easily)
→ Add prominent timer: "Complete payment within 5:00"
→ Consider increasing to 10 minutes if needed

**"Waitlist guests missing the 60-minute window"**
→ Add SMS notification in addition to email
→ Consider increasing to 90 minutes
→ Add reminder email at 30 minutes

**"Too many auto-cancellations"**
→ Check spam folder delivery
→ Verify email subject line is clear
→ Consider phone call for large parties (15+)

---

## Future Enhancements

1. **SMS Notifications** (High Priority)
   - Send SMS for waitlist promotions
   - Higher open rate than email
   - Faster response time

2. **Progressive Reminders**
   - For waitlist: Reminder at 30 min, 45 min
   - "Only 15 minutes left to secure your table!"

3. **Payment Link in SMS**
   - Click-to-pay from SMS
   - Easier than finding email

4. **Analytics Dashboard**
   - Track completion rates
   - Monitor timeout patterns
   - Optimize timeouts based on data

5. **Personalized Timeouts**
   - VIP guests: Longer timeout
   - Repeat customers: Phone call option
   - Large parties (20+): Manual handling

---

## Summary

| Type | Timeout | Reason | Notification |
|------|---------|--------|--------------|
| **Direct Reservation** | 5 min | Payment form on screen | None needed (form is open) |
| **Waitlist Promotion** | 60 min | Need to check email | Email with payment link |

Both approaches optimize for:
- ✅ Best user experience
- ✅ Table efficiency
- ✅ Fair to all guests
- ✅ Minimal manual intervention
- ✅ Professional automation

---

**Last Updated:** 2026-04-30
**System Status:** ✅ Production Ready
