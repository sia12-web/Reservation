# Diba Restaurant: Guest Communication Guide

This document outlines all automated emails sent to guests by the reservation system. Each email is designed to maintain a premium brand image while providing clear, real-time information to prevent conflicts and misunderstandings.

---

## 1. Booking & Confirmation Flow

### **A. Instant Confirmation (Success)**
*   **Situation**: Sent immediately after a guest successfully books a table (and it's not an overflow/waitlist scenario).
*   **Key Message**: *"Your reservation at Diba Restaurant is confirmed."*
*   **Contents**: Full booking details (Date, Time, Party Size, Table IDs), a unique #ShortID, and a direct link to manage the booking.

### **B. Request Received (Overflow/Waitlist)**
*   **Situation**: Sent when a guest is assigned to the "Internal Waitlist" (Table 15) because the restaurant is at capacity.
*   **Key Message**: *"We have received your request! We will send you a final confirmation shortly."*
*   **Purpose**: Manages guest expectations immediately. Tells them they are **not** confirmed yet and that the staff is working to accommodate them.

### **C. Deposit Required (Large Parties)**
*   **Situation**: Sent when a guest books for a group larger than 10 people.
*   **Key Message**: *"To confirm your booking and release the hold, please complete the security deposit ($50)."*
*   **Logic**: The reservation status is set to `PENDING_DEPOSIT`. If they don't pay within 15 minutes, the system automatically cancels the booking and releases the tables.

---

## 2. Dynamic Status Updates

### **D. The "Full House" Apology (Refund Notification)**
*   **Situation**: Sent when an Admin cancels a guest who was on the Waitlist (Table 15).
*   **Key Message**: *"We were unfortunately unable to find a table for your party... We have automatically processed a full refund."*
*   **Purpose**: Professional rejection. It explains that the restaurant is at capacity and confirms the money is on its way back to their bank.

### **E. Standard Cancellation**
*   **Situation**: Sent when a confirmed reservation is cancelled by an administrator.
*   **Key Message**: *"Your reservation #XXXX has been cancelled."* (Includes the specific reason provided by the admin).

---

## 3. The "Smart Assistant" (Automated Lifecycle)

### **F. Friendly Reminder**
*   **Situation**: Sent **1 hour before** the reservation time.
*   **Key Message**: *"Just a friendly reminder that your reservation is in 1 hour."*
*   **Purpose**: Reduces "No-Shows" and keeps the restaurant top-of-mind.

### **G. "Running Late?" Warning**
*   **Situation**: Sent **15 minutes after** the reservation start time if the guest has not been "Checked In" by the staff.
*   **Key Message**: *"We noticed you haven't arrived... Please arrive soon or call us, otherwise we may need to release your table."*
*   **Purpose**: Protects the restaurant's inventory. It gives the guest a final nudge to call if they are stuck in traffic.

### **H. Post-Dining Thank You**
*   **Situation**: Sent **30 minutes after** the estimated end of the meal.
*   **Key Message**: *"Thank you for visiting! We hope you enjoyed your meal."*
*   **Call to Action**: Includes a direct link to leave a **Google Review**. This automatically builds the restaurant's online reputation without any effort from the staff.

---

## 4. Financial Records (Receipts)

### **I. Stripe Payment Receipt**
*   **Situation**: Sent automatically after a guest pays the $50 security deposit.
*   **Contains**: Legal receipt number and confirmation that the $50 will be credited toward their final bill.

### **J. Stripe Refund Notice**
*   **Situation**: Sent when a deposit is returned.
*   **Contains**: Confirmation of the original charge ID and the refund amount.
