jest.mock("../src/config/prisma", () => ({ prisma: {} }));
jest.mock("../src/config/redis", () => ({ redlock: { acquire: jest.fn() } }));

import { deriveDepositState } from "../src/routes/reservations";

describe("deposit logic", () => {
  test("party size > 10 requires deposit", () => {
    const state = deriveDepositState(11);

    expect(state).toEqual({ status: "PENDING_DEPOSIT", depositStatus: "PENDING" });
  });

  test("party size <= 10 does not require deposit", () => {
    const state = deriveDepositState(10);

    expect(state).toEqual({ status: "CONFIRMED", depositStatus: "NOT_REQUIRED" });
  });
});
