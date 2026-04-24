import request from "supertest";

process.env.BUSINESS_HOURS_START = "0";
process.env.BUSINESS_HOURS_END = "24";

const prismaMock = {
  layout: {
    findFirst: jest.fn(),
  },
  reservationTable: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  reservation: {
    create: jest.fn(),
  },
  blackout: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("../src/config/redis", () => ({
  redlock: {
    acquire: jest.fn().mockResolvedValue({ release: jest.fn() }),
  },
}));

const redlockMock = require("../src/config/redis").redlock;

jest.mock("../src/config/prisma", () => ({ prisma: prismaMock }));
jest.mock("../src/config/stripe", () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../src/utils/time", () => ({
  ...jest.requireActual("../src/utils/time"),
  isWithinBusinessHours: () => true,
  alignToSlotInterval: () => true,
}));

const app = require("../src/app").default;

describe("POST /reservations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redlockMock.acquire.mockResolvedValue({ release: jest.fn() });
  });

  test("creates a reservation and returns table assignment", async () => {
    const startTime = buildAlignedStartTime();
    prismaMock.layout.findFirst.mockResolvedValue({
      id: "layout-1",
      isActive: true,
      tables: [{ id: "T1" }, { id: "T2" }],
    });
    prismaMock.reservationTable.findMany.mockResolvedValue([]);
    prismaMock.reservationTable.findFirst.mockResolvedValue(null);
    redlockMock.acquire.mockResolvedValue({ release: jest.fn() });
    prismaMock.reservation.create.mockResolvedValue({
      id: "res-1",
      status: "CONFIRMED",
    });
    prismaMock.reservationTable.createMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));

    const response = await request(app)
      .post("/api/reservations")
      .send({
        clientName: "Alex Doe",
        clientPhone: "+14155551212",
        partySize: 2,
        startTime: startTime.toISOString(),
      });

    expect(response.status).toBe(201);
    expect(response.body.tableIds).toEqual(["T1"]);
  });

  test("returns 409 when no tables available", async () => {
    const startTime = buildAlignedStartTime();
    prismaMock.layout.findFirst.mockResolvedValue({
      id: "layout-1",
      isActive: true,
      tables: [{ id: "T1" }],
    });
    // Mock enough data for checkAvailability and trySmartReassignment
    prismaMock.reservationTable.findMany.mockResolvedValue([
      {
        tableId: "T1",
        reservationId: "existing-res",
        reservation: { id: "existing-res", partySize: 2, status: "CONFIRMED" }
      }
    ]);

    const response = await request(app)
      .post("/api/reservations")
      .send({
        clientName: "Alex Doe",
        clientPhone: "+14155551212",
        partySize: 2,
        startTime: startTime.toISOString(),
      });

    expect(response.status).toBe(409);
  });
});

function buildAlignedStartTime(): Date {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return new Date(Date.UTC(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth(),
    tomorrow.getUTCDate(),
    18, // 18:00 UTC = 13:00 Montreal (Safe business hour)
    0,
    0,
    0
  ));
}
