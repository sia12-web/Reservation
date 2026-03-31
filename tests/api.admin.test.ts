
import request from "supertest";
import { prisma } from "../src/config/prisma";
import { redlock } from "../src/config/redis";

jest.mock("../src/config/prisma", () => ({
    prisma: {
        layout: { findFirst: jest.fn() },
        reservation: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            $transaction: jest.fn(),
        },
        reservationTable: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            createMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        auditLog: {
            create: jest.fn(),
        }
    },
}));

jest.mock("../src/config/redis", () => ({
    redlock: {
        acquire: jest.fn(),
    },
}));

// Mock audit log for transaction
const prismaMock = (prisma as any);
prismaMock.$transaction = jest.fn((cb) => cb(prismaMock));

const app = require("../src/app").default;
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

describe("Admin API Endpoints", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (redlock.acquire as jest.Mock).mockResolvedValue({ release: jest.fn() });
    });

    describe("GET /admin/reservations", () => {
        it("returns list of reservations when authenticated", async () => {
            prismaMock.reservation.findMany.mockResolvedValue([
                { id: "res-1", startTime: new Date(), reservationTables: [] }
            ]);

            const response = await request(app)
                .get("/api/admin/reservations")
                .set("x-admin-pin", ADMIN_PIN);

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(prismaMock.reservation.findMany).toHaveBeenCalled();
        });

        it("returns 401 with missing PIN", async () => {
            const response = await request(app).get("/api/admin/reservations");
            expect(response.status).toBe(401);
        });
    });

    describe("POST /admin/walkins", () => {
        it("creates a walk-in reservation", async () => {
            prismaMock.layout.findFirst.mockResolvedValue({
                id: "layout-1",
                tables: [{ id: "T1", minCapacity: 1, maxCapacity: 4, type: "STANDARD" }]
            });
            prismaMock.reservationTable.findMany.mockResolvedValue([]);
            prismaMock.reservation.create.mockResolvedValue({ id: "res-walkin", shortId: "WALK1" });

            const response = await request(app)
                .post("/api/admin/walkins")
                .set("x-admin-pin", ADMIN_PIN)
                .send({
                    partySize: 2,
                    clientName: "Walkin Guest"
                });

            expect(response.status).toBe(201);
            expect(response.body.shortId).toBe("WALK1");
            expect(prismaMock.reservation.create).toHaveBeenCalled();
        });
    });

    describe("POST /admin/tables/:tableId/free", () => {
        it("frees an occupied table", async () => {
            prismaMock.reservationTable.findFirst.mockResolvedValue({
                tableId: "T1",
                reservation: { id: "res-active", status: "CHECKED_IN", startTime: new Date(), endTime: new Date() }
            });

            const response = await request(app)
                .post("/api/admin/tables/T1/free")
                .set("x-admin-pin", ADMIN_PIN)
                .send({ reason: "Customer left early" });

            expect(response.status).toBe(200);
            expect(prismaMock.reservation.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: "res-active" },
                data: expect.objectContaining({ status: "COMPLETED" })
            }));
        });
    });
});
