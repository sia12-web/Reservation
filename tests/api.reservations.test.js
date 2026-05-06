"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const prismaMock = {
    layout: {
        findFirst: jest.fn(),
    },
    reservationTable: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    reservation: {
        create: jest.fn(),
    },
    $transaction: jest.fn(),
};
const redlockMock = {
    acquire: jest.fn(),
};
jest.mock("../src/config/prisma", () => ({
    prisma: prismaMock,
}));
jest.mock("../src/config/redis", () => ({
    redlock: redlockMock,
}));
describe("POST /reservations", () => {
    beforeEach(() => {
        prismaMock.layout.findFirst.mockReset();
        prismaMock.reservationTable.findFirst.mockReset();
        prismaMock.reservationTable.findMany.mockReset();
        prismaMock.reservation.create.mockReset();
        prismaMock.$transaction.mockReset();
        redlockMock.acquire.mockReset();
    });
    test("creates a reservation and returns table assignment", async () => {
        prismaMock.layout.findFirst.mockResolvedValue({
            id: "layout-1",
            isActive: true,
            tables: [{ id: "T1" }, { id: "T2" }],
        });
        prismaMock.reservationTable.findMany.mockResolvedValue([]);
        prismaMock.reservationTable.findFirst.mockResolvedValue(null);
        prismaMock.reservation.create.mockResolvedValue({
            id: "res-1",
            status: "CONFIRMED",
        });
        prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
        redlockMock.acquire.mockResolvedValue({ release: jest.fn() });
        const response = await (0, supertest_1.default)(app_1.default)
            .post("/reservations")
            .send({
            clientName: "Alex Doe",
            clientPhone: "+14155551212",
            partySize: 2,
            startTime: new Date(Date.now() + 3600000).toISOString(),
        });
        expect(response.status).toBe(201);
        expect(response.body.tableIds).toEqual(["T1"]);
    });
    test("returns 409 when no tables available", async () => {
        prismaMock.layout.findFirst.mockResolvedValue({
            id: "layout-1",
            isActive: true,
            tables: [{ id: "T1" }],
        });
        prismaMock.reservationTable.findMany.mockResolvedValue([{ tableId: "T1" }]);
        const response = await (0, supertest_1.default)(app_1.default)
            .post("/reservations")
            .send({
            clientName: "Alex Doe",
            clientPhone: "+14155551212",
            partySize: 2,
            startTime: new Date(Date.now() + 3600000).toISOString(),
        });
        expect(response.status).toBe(409);
    });
});
