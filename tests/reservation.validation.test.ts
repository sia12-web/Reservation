jest.mock("../src/config/prisma", () => ({ prisma: {} }));
jest.mock("../src/config/redis", () => ({ redlock: { acquire: jest.fn() } }));

import { reservationSchema } from "../src/routes/reservations";

describe("reservation validation", () => {
  test("rejects emoji-only names", () => {
    const payload = {
      clientName: "😀😀",
      clientPhone: "+14155551212",
      partySize: 2,
      startTime: new Date(Date.now() + 3600000).toISOString(),
    };

    expect(() => reservationSchema.parse(payload)).toThrow();
  });

  test("rejects invalid phone", () => {
    const payload = {
      clientName: "Alex Doe",
      clientPhone: "415-555-1212",
      partySize: 2,
      startTime: new Date(Date.now() + 3600000).toISOString(),
    };

    expect(() => reservationSchema.parse(payload)).toThrow();
  });
});
