"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reservations_1 = require("../src/routes/reservations");
describe("reservation validation", () => {
    test("rejects emoji-only names", () => {
        const payload = {
            clientName: "😀😀",
            clientPhone: "+14155551212",
            partySize: 2,
            startTime: new Date(Date.now() + 3600000).toISOString(),
        };
        expect(() => reservations_1.reservationSchema.parse(payload)).toThrow();
    });
    test("rejects invalid phone", () => {
        const payload = {
            clientName: "Alex Doe",
            clientPhone: "415-555-1212",
            partySize: 2,
            startTime: new Date(Date.now() + 3600000).toISOString(),
        };
        expect(() => reservations_1.reservationSchema.parse(payload)).toThrow();
    });
});
