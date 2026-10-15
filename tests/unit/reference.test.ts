import { describe, expect, it } from "vitest";
import { REFERENCE_PREFIXES, generateReference, normalizeReference } from "@/lib/reference";
import { UUID_RE, uuidv7 } from "@/lib/uuid";

describe("generateReference", () => {
  it("uses the kind prefix and Crockford base32 body", () => {
    const ref = generateReference("booking");
    expect(ref).toMatch(/^BK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it("is not sequential or repeated across many draws", () => {
    const refs = new Set(Array.from({ length: 5_000 }, () => generateReference("enquiry")));
    expect(refs.size).toBe(5_000);
  });

  it("has a unique prefix per kind", () => {
    const prefixes = Object.values(REFERENCE_PREFIXES);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe("normalizeReference", () => {
  it("accepts lower case and missing dashes", () => {
    expect(normalizeReference("bk7k3mq9xp")).toBe("BK-7K3M-Q9XP");
    expect(normalizeReference(" bk-7k3m-q9xp ")).toBe("BK-7K3M-Q9XP");
  });

  it("maps ambiguous characters in the body only", () => {
    expect(normalizeReference("BK-7K3M-Q9OI")).toBe("BK-7K3M-Q901");
    // "IN" prefix must survive: the I is not turned into 1.
    expect(normalizeReference("IN-ABCD-EFGH")).toBe("IN-ABCD-EFGH");
  });

  it("rejects unknown prefixes, bad lengths and invalid characters", () => {
    expect(normalizeReference("ZZ-ABCD-EFGH")).toBeNull();
    expect(normalizeReference("BK-ABC")).toBeNull();
    expect(normalizeReference("BK-ABCD-EFGU")).toBeNull();
    expect(normalizeReference("")).toBeNull();
  });
});

describe("uuidv7", () => {
  it("produces RFC 9562 version 7 UUIDs", () => {
    const id = uuidv7();
    expect(id).toMatch(UUID_RE);
    expect(id[14]).toBe("7");
  });

  it("is time-ordered", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a < b).toBe(true);
  });
});
