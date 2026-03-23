import { describe, it, expect } from "vitest";

// ============================================================
// Tests for backend hardening utility logic
// These mirror the validation helpers in api-gateway/index.ts
// ============================================================

// Replicate validation helpers (same logic as edge function)
function validateAmount(amount: unknown): { valid: boolean; value: number; error?: string } {
  const v = Number(amount);
  if (isNaN(v) || v <= 0) return { valid: false, value: 0, error: "Amount must be a positive number" };
  if (v > 1_000_000) return { valid: false, value: 0, error: "Amount exceeds maximum allowed value" };
  return { valid: true, value: Math.round(v * 100) / 100 };
}

function validatePagination(page: unknown, limit: unknown): { page: number; limit: number } {
  const rawPage = page !== undefined && page !== null && page !== "" ? parseInt(String(page), 10) : 1;
  const rawLimit = limit !== undefined && limit !== null && limit !== "" ? parseInt(String(limit), 10) : 25;
  const p = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const l = Math.min(100, Math.max(1, isNaN(rawLimit) ? 25 : rawLimit));
  return { page: p, limit: l };
}

function validateUuid(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ============================================================
// validateAmount tests
// ============================================================
describe("validateAmount", () => {
  it("accepts valid positive amounts", () => {
    expect(validateAmount(100).valid).toBe(true);
    expect(validateAmount(100).value).toBe(100);
  });

  it("rounds to 2 decimal places", () => {
    expect(validateAmount(99.999).value).toBe(100);
    expect(validateAmount(10.125).value).toBe(10.13);
  });

  it("rejects zero", () => {
    const result = validateAmount(0);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  it("rejects negative numbers", () => {
    expect(validateAmount(-50).valid).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(validateAmount("abc").valid).toBe(false);
    expect(validateAmount(null).valid).toBe(false);
    expect(validateAmount(undefined).valid).toBe(false);
  });

  it("rejects amounts exceeding maximum", () => {
    const result = validateAmount(2_000_000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/maximum/i);
  });

  it("accepts the maximum boundary", () => {
    expect(validateAmount(1_000_000).valid).toBe(true);
  });

  it("accepts decimal amounts", () => {
    expect(validateAmount(9.99).valid).toBe(true);
    expect(validateAmount(9.99).value).toBe(9.99);
  });
});

// ============================================================
// validatePagination tests
// ============================================================
describe("validatePagination", () => {
  it("returns defaults when no arguments provided", () => {
    const { page, limit } = validatePagination(undefined, undefined);
    expect(page).toBe(1);
    expect(limit).toBe(25);
  });

  it("enforces minimum page of 1", () => {
    expect(validatePagination(0, 10).page).toBe(1);
    expect(validatePagination(-5, 10).page).toBe(1);
  });

  it("enforces maximum limit of 100", () => {
    expect(validatePagination(1, 500).limit).toBe(100);
    expect(validatePagination(1, 101).limit).toBe(100);
  });

  it("enforces minimum limit of 1", () => {
    expect(validatePagination(1, 0).limit).toBe(1);
    expect(validatePagination(1, -1).limit).toBe(1);
  });

  it("accepts valid page and limit", () => {
    const { page, limit } = validatePagination(3, 50);
    expect(page).toBe(3);
    expect(limit).toBe(50);
  });

  it("handles string numbers", () => {
    const { page, limit } = validatePagination("2", "30");
    expect(page).toBe(2);
    expect(limit).toBe(30);
  });

  it("handles non-numeric strings by defaulting", () => {
    const { page, limit } = validatePagination("abc", "xyz");
    expect(page).toBe(1);
    expect(limit).toBe(25);
  });
});

// ============================================================
// validateUuid tests
// ============================================================
describe("validateUuid", () => {
  it("accepts valid lowercase UUID v4", () => {
    expect(validateUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts valid uppercase UUID", () => {
    expect(validateUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(validateUuid(123)).toBe(false);
    expect(validateUuid(null)).toBe(false);
    expect(validateUuid(undefined)).toBe(false);
  });

  it("rejects malformed UUID", () => {
    expect(validateUuid("not-a-uuid")).toBe(false);
    expect(validateUuid("550e8400-e29b-41d4-a716")).toBe(false);
    expect(validateUuid("")).toBe(false);
  });

  it("rejects UUID with extra characters", () => {
    expect(validateUuid("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false);
  });
});

// ============================================================
// Rate limit configuration sanity check
// ============================================================
describe("Rate limit configuration", () => {
  const RATE_LIMITS: Record<string, [number, number]> = {
    wallet: [30, 1],
    keys: [60, 1],
    products: [120, 1],
    marketplace: [120, 1],
    resellers: [60, 1],
    ai: [20, 1],
    default: [120, 1],
  };

  it("all rate limit values are positive", () => {
    for (const [module, [maxReq, windowMin]] of Object.entries(RATE_LIMITS)) {
      expect(maxReq).toBeGreaterThan(0);
      expect(windowMin).toBeGreaterThan(0);
      expect(typeof module).toBe("string");
    }
  });

  it("wallet rate limit is stricter than default", () => {
    const walletLimit = RATE_LIMITS["wallet"][0];
    const defaultLimit = RATE_LIMITS["default"][0];
    expect(walletLimit).toBeLessThan(defaultLimit);
  });

  it("ai has the strictest rate limit overall", () => {
    const aiLimit = RATE_LIMITS["ai"][0];
    for (const [module, [maxReq]] of Object.entries(RATE_LIMITS)) {
      if (module !== "ai") {
        expect(aiLimit).toBeLessThanOrEqual(maxReq);
      }
    }
  });

  it("has a fallback default entry", () => {
    expect(RATE_LIMITS["default"]).toBeDefined();
  });
});
