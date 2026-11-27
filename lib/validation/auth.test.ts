import { describe, expect, it } from "vitest";
import { registerSchema, resetPasswordSchema, signInSchema } from "./auth";

const valid = {
  name: "Ana López",
  email: "  Ana@Example.COM ",
  phone: "55 1234 5678",
  password: "una-clave-segura",
  passwordConfirm: "una-clave-segura",
  terms: "on",
};

describe("registerSchema", () => {
  it("accepts a valid registration and normalizes the email", () => {
    const result = registerSchema.parse(valid);
    expect(result.email).toBe("ana@example.com");
    expect(result.name).toBe("Ana López");
  });

  it.each(["+52 55 1234 5678", "(55) 1234-5678", "5512345678"])("accepts phone %j", (phone) => {
    expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });

  it.each(["12345", "55-12ab-5678", "+52 55 1234 5678 1234"])("rejects phone %j", (phone) => {
    expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it("requires accepting the terms", () => {
    const result = registerSchema.safeParse({ ...valid, terms: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["terms"]);
  });

  it("requires matching passwords of at least 10 characters", () => {
    expect(registerSchema.safeParse({ ...valid, passwordConfirm: "otra-clave-segura" }).error?.issues[0].path).toEqual(["passwordConfirm"]);
    expect(registerSchema.safeParse({ ...valid, password: "corta", passwordConfirm: "corta" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "ana@" }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("normalizes the email and requires a password", () => {
    expect(signInSchema.parse({ email: "ADMIN@x.io", password: "x" }).email).toBe("admin@x.io");
    expect(signInSchema.safeParse({ email: "admin@x.io", password: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires a token and matching passwords", () => {
    expect(resetPasswordSchema.safeParse({ token: "t", password: "una-clave-segura", passwordConfirm: "una-clave-segura" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "", password: "una-clave-segura", passwordConfirm: "una-clave-segura" }).success).toBe(false);
  });
});
