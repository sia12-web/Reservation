# SMS Payment Links Setup Guide

## Overview

The system now supports sending payment links via SMS for phone reservations. This is especially useful when customers call the restaurant to make a reservation for 10+ guests, as collecting email addresses over the phone can be difficult.

## How It Works

### Flow for Phone Reservations:

1. Customer calls restaurant to book a table for 10+ guests
2. Admin creates reservation via admin panel (source: PHONE)
3. System sends **SMS with payment link** to customer's phone number
4. If email was also provided, system sends email too (as backup)
5. Customer clicks link and completes $50 deposit payment
6. Customer has **60 minutes** to pay (longer than web bookings because they need time to check their phone)

### Flow for Web/Kiosk Reservations:

1. Customer books online for 10+ guests
2. **Payment modal appears immediately** (blocking)
3. Customer must pay within **5 minutes**
4. No email or SMS sent (payment happens on screen)

## Twilio Setup

### 1. Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free trial account
3. Verify your phone number

### 2. Get Your Credentials

1. Log in to https://www.twilio.com/console
2. Copy your **Account SID** (starts with `AC...`)
3. Copy your **Auth Token** (click the eye icon to reveal)

### 3. Get a Phone Number

1. Go to https://www.twilio.com/console/phone-numbers/incoming
2. Click "Buy a number"
3. Search for a Canadian number (for Montreal: search area code 514)
4. Buy the number (trial accounts get one free number)
5. Copy the phone number in E.164 format (e.g., `+15144859999`)

### 4. Configure Environment Variables

Add these to your `.env.production` file:

```bash
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+15144859999"
```

### 5. Deploy to Railway

1. Go to your Railway project dashboard
2. Click on your backend service
3. Go to "Variables" tab
4. Add the three Twilio environment variables
5. Redeploy the service

## Testing SMS

### Test in Development:

```bash
# Set environment variables in .env
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+15144859999"

# Create a phone reservation via API
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Test Customer",
    "clientPhone": "+15141234567",
    "partySize": 10,
    "startTime": "2026-05-01T18:00:00Z",
    "source": "PHONE"
  }'
```

You should receive an SMS at the provided phone number with the payment link.

### Test in Production:

1. Log in to admin panel
2. Create a phone reservation for 10+ guests
3. Enter a valid phone number (your phone for testing)
4. Submit the reservation
5. Check your phone for the SMS

## SMS Message Format

**Deposit Request (Phone Reservations):**
```
Hi [Name]! Your reservation for [X] guests on [Date, Time] requires a $50 deposit. Complete payment here: [Link] (Ref: [ID]). You have 60 minutes. Questions? Call (514) 485-9999
```

**Waitlist Promotion:**
```
Great news [Name]! A table is now available for [X] guests on [Date, Time]. Complete your $50 deposit to confirm: [Link] (Ref: [ID]). You have 60 minutes.
```

## Cost Estimate

### Twilio Pricing (Canada):
- **SMS (outbound)**: ~$0.0075 per SMS
- **Phone number**: ~$1.00/month

### Monthly Cost Estimate:
- If you send 100 SMS/month: $1.75/month
- If you send 500 SMS/month: $4.75/month

This is very affordable for the convenience it provides!

## Fallback Behavior

If Twilio is **not configured** (environment variables missing):
- System logs a warning but continues normally
- No SMS is sent (email is sent if available)
- Phone reservations still work, but customer must call restaurant to complete payment

This is safe - SMS is "best effort" and won't break reservations if unavailable.

## Troubleshooting

### SMS not sending:

1. Check Railway logs for errors:
   ```bash
   # Look for "Failed to send SMS" messages
   ```

2. Verify environment variables are set correctly in Railway

3. Check Twilio console for delivery status:
   - Go to https://www.twilio.com/console/sms/logs
   - Look for failed messages

4. Verify phone number format:
   - Must be E.164 format: `+15141234567` (country code + number)
   - No spaces, dashes, or parentheses

### Phone number restrictions (Trial account):

- Twilio trial accounts can only send to **verified numbers**
- To send to any number, upgrade to a paid account (~$20/month minimum)

### Message delivery issues:

- Some carriers block SMS from certain shortcodes
- If customers don't receive SMS, check carrier spam filters
- Consider adding SMS disclaimer to your reservation confirmation

## Production Checklist

Before going live with SMS:

- [ ] Twilio account created and verified
- [ ] Phone number purchased (Canadian number recommended)
- [ ] Environment variables set in Railway
- [ ] Tested sending SMS in production
- [ ] Upgraded to paid account (to send to any number)
- [ ] Budget allocated for SMS costs (~$5-10/month for small restaurant)
- [ ] Updated restaurant phone number in SMS message template (currently hardcoded)

## Future Enhancements

Potential improvements:
- Two-way SMS (customer can reply to confirm/cancel)
- SMS delivery status tracking
- SMS templates in database (instead of hardcoded)
- SMS notifications for reservation reminders (1 hour before)
- Waitlist promotion via SMS when table becomes available

---

**Questions?** Check the Twilio documentation: https://www.twilio.com/docs/sms
