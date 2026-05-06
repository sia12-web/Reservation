import { maskPII } from "../src/utils/masking";

describe("PII Masking Utility", () => {
    test("masks email addresses", () => {
        expect(maskPII({ email: "john.doe@example.com" })).toEqual({
            email: "jo***@example.com"
        });
        expect(maskPII({ userEmail: "a@b.com" })).toEqual({
            userEmail: "***@b.com"
        });
    });

    test("masks phone numbers", () => {
        expect(maskPII({ phone: "+15145551234" })).toEqual({
            phone: "***-***-1234"
        });
        expect(maskPII({ client_phone: "5558889999" })).toEqual({
            client_phone: "***-***-9999"
        });
    });

    test("masks recursively", () => {
        const input = {
            id: "123",
            details: {
                email: "secret@example.com",
                nested: {
                    phone: "1234567890"
                }
            },
            list: [
                { email: "a@b.com" },
                { phone: "9876543210" }
            ]
        };
        const output = maskPII(input);
        expect(output.details.email).toBe("se***@example.com");
        expect(output.details.nested.phone).toBe("***-***-7890");
        expect(output.list[0].email).toBe("***@b.com");
        expect(output.list[1].phone).toBe("***-***-3210");
        expect(output.id).toBe("123");
    });

    test("leaves other fields untouched", () => {
        const input = { name: "Alex", partySize: 4 };
        expect(maskPII(input)).toEqual(input);
    });
});
