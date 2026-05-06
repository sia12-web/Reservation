"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../src/services/tableAssignment/engine");
describe("table assignment engine", () => {
    test("Case A: party of 2 prefers T1 over T9", () => {
        const available = ["T1", "T9"];
        const result = (0, engine_1.findBestTableAssignment)(2, available);
        expect(result.best?.tableIds).toEqual(["T1"]);
    });
    test("Case B: party of 8 finds [T1, T2] when T9 is taken", () => {
        const available = ["T1", "T2", "T3", "T10", "T11"];
        const result = (0, engine_1.findBestTableAssignment)(8, available);
        expect(result.best?.tableIds).toEqual(["T1", "T2"]);
    });
    test("Case C: party of 12 finds [T9, T10, T11]", () => {
        const available = ["T9", "T10", "T11"];
        const result = (0, engine_1.findBestTableAssignment)(12, available);
        expect(result.best?.tableIds).toEqual(["T10", "T11", "T9"]);
    });
});
