"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reservations_1 = require("../src/routes/reservations");
describe("deposit logic", () => {
    test("party size > 10 requires deposit", () => {
        const state = (0, reservations_1.deriveDepositState)(11);
        expect(state).toEqual({ status: "PENDING_DEPOSIT", depositStatus: "PENDING" });
    });
    test("party size <= 10 does not require deposit", () => {
        const state = (0, reservations_1.deriveDepositState)(10);
        expect(state).toEqual({ status: "CONFIRMED", depositStatus: "NOT_REQUIRED" });
    });
});
