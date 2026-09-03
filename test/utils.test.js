import test from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  calcCoverageDays,
  formatCoverageDays,
  parseDateString,
} from "../js/utils.js";

test("mantiene fechas de calendario sin desplazamientos", () => {
  assert.equal(parseDateString("2026-02-28").getDate(), 28);
  assert.equal(parseDateString("2026-02-28").getMonth(), 1);
  assert.equal(addCalendarDays("2026-03-28", 1).toISOString().slice(0, 10), "2026-03-29");
  assert.throws(() => parseDateString("2026-02-30"), /Fecha inválida/);
});

test("calcula cobertura y estados indeterminados", () => {
  assert.equal(calcCoverageDays(500, [], 10), 50);
  assert.equal(calcCoverageDays(100, [], 0), null);
  assert.equal(formatCoverageDays(null), "Sin datos");
});
