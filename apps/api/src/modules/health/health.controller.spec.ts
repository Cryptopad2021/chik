import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

const dbUp = { checkHealth: async () => true };
const dbDown = { checkHealth: async () => false };

describe("HealthController", () => {
  it("returns ok envelope (ТЗ §45)", async () => {
    const r = await new HealthController(dbUp as never).check();
    expect(r.success).toBe(true);
    expect(r.data.status).toBe("ok");
    expect(r.data.db).toBe("up");
  });

  it("degraded when DB unavailable (dev без PostgreSQL)", async () => {
    const r = await new HealthController(dbDown as never).check();
    expect(r.success).toBe(true);
    expect(r.data.status).toBe("degraded");
    expect(r.data.db).toBe("down");
  });
});
