import { describe, expect, it } from "vitest";
import { exceedsLimit } from "../../lib/auth/rate-limit";

describe("exceedsLimit", () => {
  it("no bloquea por debajo del máximo", () => {
    expect(exceedsLimit(4, 5)).toBe(false);
  });

  it("bloquea al llegar al máximo", () => {
    expect(exceedsLimit(5, 5)).toBe(true);
  });

  it("bloquea por encima del máximo", () => {
    expect(exceedsLimit(9, 5)).toBe(true);
  });
});