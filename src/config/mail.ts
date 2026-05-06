

export const transporter = {
    sendMail: async (params: { from: string, to: string, cc?: string, subject: string, html: string }) => {
        // Parse "Name <email@domain.com>" format
        const fromMatch = params.from.match(/^(.*?) <(.*?)>$/);
        const sender = fromMatch 
            ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() } 
            : { name: "Diba Restaurant", email: "siavashshahbazifar@gmail.com" };
        
        const toList = [{ email: params.to }];
        const ccList = params.cc ? [{ email: params.cc }] : undefined;

        // Use the Brevo HTTP API to bypass Railway's strict SMTP firewall
        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            console.error("BREVO_API_KEY is not set. Cannot send email.");
            return { messageId: "skipped" };
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender,
                to: toList,
                cc: ccList,
                subject: params.subject,
                htmlContent: params.html
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Brevo API Error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as { messageId: string };
        return { messageId: data.messageId };
    }
};
