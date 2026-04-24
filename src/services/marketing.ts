import { prisma } from "../config/prisma";
import { env } from "../config/env";
import pino from "pino";

const logger = pino();

export interface MarketingContact {
    email: string;
    clientName: string;
}

/**
 * Fetches all unique customers who have opted in for marketing
 */
export async function getOptedInContacts(): Promise<MarketingContact[]> {
    // We group by email to ensure no duplicates
    const rawContacts = await prisma.reservation.findMany({
        where: {
            marketingOptIn: true,
            clientEmail: { not: null }
        },
        select: {
            clientEmail: true,
            clientName: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    // Manual deduplication to keep the most recent name if email appears twice
    const uniqueMap = new Map<string, string>();
    rawContacts.forEach(c => {
        if (c.clientEmail && !uniqueMap.has(c.clientEmail)) {
            uniqueMap.set(c.clientEmail, c.clientName);
        }
    });

    return Array.from(uniqueMap.entries()).map(([email, name]) => ({
        email,
        clientName: name
    }));
}

/**
 * Syncs the unique contacts to Brevo Marketing List
 */
export async function syncContactsToBrevo(): Promise<{ success: boolean; count: number; message: string }> {
    if (!env.brevoApiKey) {
        throw new Error("BREVO_API_KEY is not configured");
    }

    const contacts = await getOptedInContacts();
    
    if (contacts.length === 0) {
        return { success: true, count: 0, message: "No opted-in contacts found to sync." };
    }

    logger.info(`Starting Brevo sync for ${contacts.length} contacts...`);

    // Brevo API allows creating/updating contacts
    // For large lists, bulk import is better, but for small batches (restaurants usually < 1000 active),
    // we can iterate or use a simpler approach.
    // Let's use the standard "create contact" endpoint which also updates if already exists
    // but requires 'updateEnabled' parameter.

    let successCount = 0;
    let failCount = 0;

    for (const contact of contacts) {
        try {
            const response = await fetch("https://api.brevo.com/v3/contacts", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "api-key": env.brevoApiKey
                },
                body: JSON.stringify({
                    email: contact.email,
                    attributes: {
                        FIRSTNAME: contact.clientName.split(' ')[0],
                        LASTNAME: contact.clientName.split(' ').slice(1).join(' ') || 'Customer'
                    },
                    listIds: [env.brevoListId],
                    updateEnabled: true
                })
            });

            if (response.ok || response.status === 204) {
                successCount++;
            } else {
                const error = await response.json();
                logger.error({ msg: "Brevo sync item failed", email: contact.email, error });
                failCount++;
            }
        } catch (error) {
            logger.error({ msg: "Brevo sync network error", email: contact.email, error });
            failCount++;
        }
    }

    return { 
        success: failCount === 0, 
        count: successCount, 
        message: `Synced ${successCount} contacts. ${failCount} failed.` 
    };
}
