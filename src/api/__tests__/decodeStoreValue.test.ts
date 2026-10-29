import { encrypt } from "@/utils/encryption";
import { describe, expect, it } from "vitest";
import { decodeStoreValue } from "../decodeStoreValue";

const license = {
  uuid: "license-1",
  type: "once",
  license_key: "FA-TEST",
  expires_at: null,
  last_checked_at: "2026-10-24T00:00:00.000Z",
};

describe("decodeStoreValue", () => {
  it("reads encrypted and legacy plain-JSON licenses", async () => {
    const encrypted = await encrypt(JSON.stringify(license));
    await expect(decodeStoreValue("license", encrypted)).resolves.toEqual(license);
    await expect(decodeStoreValue("license", JSON.stringify(license))).resolves.toEqual(license);
  });

  it("rejects corrupt license values rather than replacing stored data", async () => {
    await expect(decodeStoreValue("license", "corrupt data")).rejects.toThrow(
      "Invalid stored license data"
    );
    await expect(decodeStoreValue("license", '"not a license"')).rejects.toThrow(
      "Invalid stored license data"
    );
  });

  it("preserves known legacy plain strings and rejects wrong-typed settings", async () => {
    await expect(decodeStoreValue("defaultPath", "/Users/test/Desktop"))
      .resolves.toBe("/Users/test/Desktop");
    await expect(decodeStoreValue("autoOpenFolder", "true")).resolves.toBe(true);
    await expect(decodeStoreValue("autoOpenFolder", "corrupt data")).resolves.toBeNull();
  });
});
