import { describe, expect, it } from "vitest";
import { containsCardNumber, redactCardNumbers } from "./redact";

describe("redactCardNumbers", () => {
  it("masks card numbers in any common format, keeping the last 4", () => {
    // Standard Visa test number.
    expect(redactCardNumbers("Credit Card Number 4111111111111111")).toBe("Credit Card Number ************1111");
    expect(redactCardNumbers("card 4111 1111 1111 1111.")).toBe("card ************1111.");
    expect(redactCardNumbers("card 4111-1111-1111-1111")).toBe("card ************1111");
  });

  it("leaves reference numbers that aren't card numbers alone", () => {
    // 13 digits like a GCash reference, failing the Luhn check.
    expect(redactCardNumbers("Ref No. 4000000000001")).toBe("Ref No. 4000000000001");
    expect(redactCardNumbers("InstaPay Trace No. 000000000000001")).toBe("InstaPay Trace No. 000000000000001");
    expect(redactCardNumbers("PHP 22,170.00 on Sep 14 2026")).toBe("PHP 22,170.00 on Sep 14 2026");
  });

  it("doesn't touch already-masked numbers", () => {
    expect(redactCardNumbers("Transfer To XXXXXXXXXX5678 and ******5678")).toBe("Transfer To XXXXXXXXXX5678 and ******5678");
  });

  it("detects card numbers", () => {
    expect(containsCardNumber("pay 5555555555554444 now")).toBe(true);
    expect(containsCardNumber("nothing here 12345")).toBe(false);
  });
});
