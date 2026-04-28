jest.mock("../src/config/prisma", () => ({ prisma: {} }));
jest.mock("../src/config/redis", () => ({ redlock: { acquire: jest.fn() } }));

import { deriveDepositState } from "../src/routes/reservations";

describe("deposit logic", () => {
  test("party size >= 10 requires deposit", () => {
    expect(deriveDepositState(10)).toEqual({ status: "PENDING_DEPOSIT", depositStatus: "PENDING" });
    expect(deriveDepositState(11)).toEqual({ status: "PENDING_DEPOSIT", depositStatus: "PENDING" });
    expect(deriveDepositState(50)).toEqual({ status: "PENDING_DEPOSIT", depositStatus: "PENDING" });
  });

  test("party size < 10 does not require deposit", () => {
    expect(deriveDepositState(9)).toEqual({ status: "CONFIRMED", depositStatus: "NOT_REQUIRED" });
    expect(deriveDepositState(1)).toEqual({ status: "CONFIRMED", depositStatus: "NOT_REQUIRED" });
  });
});
