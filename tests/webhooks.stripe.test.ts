import request from "supertest";

const prismaMock = {
  payment: {
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  reservation: {
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const constructEventMock = jest.fn();

jest.mock("../src/config/prisma", () => ({ prisma: prismaMock }));
jest.mock("../src/config/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventMock,
    },
  },
}));

// Import app after mocks
const app = require("../src/app").default;

describe("POST /webhooks/stripe", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payment.findFirst.mockResolvedValue(null);
    prismaMock.reservation.update.mockResolvedValue({});
    prismaMock.reservation.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (ops: any) => {
      if (Array.isArray(ops)) {
        for (const op of ops) await op;
      } else if (typeof ops === "function") {
        await ops(prismaMock);
      }
      return {};
    });
  });

  test("handles payment_intent.succeeded and confirms reservation", async () => {
    const body = Buffer.from(JSON.stringify({ type: "payment_intent.succeeded" }));
    constructEventMock.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          metadata: { shortId: "SHORT123" },
        },
      },
    });
    prismaMock.payment.findFirst.mockResolvedValue({ reservationId: "res-1" });
    prismaMock.reservation.findFirst.mockResolvedValue({
      id: "res-1",
      shortId: "SHORT123",
      status: "PENDING_DEPOSIT",
      clientName: "Alex Doe",
      partySize: 2,
      startTime: new Date(),
      reservationTables: [{ tableId: "T1" }],
    });

    const response = await request(app)
      .post("/webhooks/stripe")
      .set("stripe-signature", "testsig")
      .send(body);

    expect(response.status).toBe(200);
    expect(constructEventMock).toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { providerIntentId: "pi_123" },
      data: { status: "SUCCEEDED" },
    });
    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: "res-1" },
      data: { status: "CONFIRMED", depositStatus: "PAID" },
    });
  });

  test("handles payment_intent.payment_failed and marks payment failed", async () => {
    const body = Buffer.from(JSON.stringify({ type: "payment_intent.payment_failed" }));
    constructEventMock.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_fail",
        },
      },
    });

    const response = await request(app)
      .post("/webhooks/stripe")
      .set("stripe-signature", "testsig")
      .send(body);

    expect(response.status).toBe(200);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { providerIntentId: "pi_fail" },
      data: { status: "FAILED" },
    });
  });

  test("skips confirmation if reservation is already CANCELLED", async () => {
    const body = Buffer.from(JSON.stringify({ type: "payment_intent.succeeded" }));
    constructEventMock.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_stale",
          metadata: { shortId: "SHORT_STALE" },
        },
      },
    });

    prismaMock.payment.findFirst.mockResolvedValue({ reservationId: "res-stale" });
    prismaMock.reservation.findFirst.mockResolvedValue({
      id: "res-stale",
      status: "CANCELLED", // Already cancelled
      reservationTables: [{ tableId: "T1" }],
    });

    const response = await request(app)
      .post("/webhooks/stripe")
      .set("stripe-signature", "testsig")
      .send(body);

    expect(response.status).toBe(200);
    // Should NOT update to CONFIRMED
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });
});
