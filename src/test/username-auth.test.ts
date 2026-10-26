import { describe, expect, it, beforeEach } from "vitest";
import {
  registerUser,
  loginUser,
  normalizeUsername,
  usernameToInternalEmail,
} from "@/lib/auth.server";
import { globalMockStore } from "@/integrations/supabase/mock-client";

describe("Username-and-Password Authentication System", () => {
  beforeEach(() => {
    // Reset test users before each test
    globalMockStore.users = globalMockStore.users.filter((u) => u.username === "demo");
  });

  describe("Username formatting and mapping", () => {
    it("normalizes username by trimming and lowercasing", () => {
      expect(normalizeUsername("  Alex_Smith  ")).toBe("alex_smith");
      expect(normalizeUsername("Charlotte99")).toBe("charlotte99");
    });

    it("generates an internal synthetic auth email identifier", () => {
      expect(usernameToInternalEmail("alex_smith")).toBe("alex_smith@vestara.net");
      expect(usernameToInternalEmail("  MARCUS  ")).toBe("marcus@vestara.net");
    });
  });

  describe("Registration Flow", () => {
    it("successfully registers a new unique user without requiring email or OTP", async () => {
      const result = await registerUser({
        username: "eleanor_vance",
        password: "securePassword123",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.username).toBe("eleanor_vance");
        expect(result.session.access_token).toBeDefined();
        expect(result.session.access_token.length).toBeGreaterThan(0);
      }
    });

    it("rejects duplicate username registration with clear error message", async () => {
      // First registration
      const first = await registerUser({
        username: "clara_oswald",
        password: "firstPassword123",
      });
      expect(first.ok).toBe(true);

      // Duplicate registration attempt (different case)
      const duplicate = await registerUser({
        username: "CLARA_OSWALD",
        password: "secondPassword456",
      });

      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error).toContain('Username "clara_oswald" is already taken');
      }
    });
  });

  describe("Login Flow", () => {
    it("successfully authenticates with valid username and password", async () => {
      const reg = await registerUser({
        username: "roary_williams",
        password: "centurionPassword2026",
      });
      expect(reg.ok).toBe(true);

      const login = await loginUser({
        username: "roary_williams",
        password: "centurionPassword2026",
      });

      expect(login.ok).toBe(true);
      if (login.ok) {
        expect(login.user.username).toBe("roary_williams");
        expect(login.session.access_token).toBeDefined();
      }
    });

    it("allows case-insensitive username login", async () => {
      await registerUser({
        username: "amy_pond",
        password: "tardisPassword999",
      });

      const login = await loginUser({
        username: "AMY_POND",
        password: "tardisPassword999",
      });

      expect(login.ok).toBe(true);
      if (login.ok) {
        expect(login.user.username).toBe("amy_pond");
      }
    });

    it("rejects invalid password with helpful error message", async () => {
      await registerUser({
        username: "river_song",
        password: "correctPassword123",
      });

      const login = await loginUser({
        username: "river_song",
        password: "wrongPassword!",
      });

      expect(login.ok).toBe(false);
      if (!login.ok) {
        expect(login.error).toBe(
          "Invalid username or password. Please verify your credentials and try again.",
        );
      }
    });

    it("rejects non-existent username with helpful error message", async () => {
      const login = await loginUser({
        username: "non_existent_user_99",
        password: "somePassword123",
      });

      expect(login.ok).toBe(false);
      if (!login.ok) {
        expect(login.error).toBe(
          "Invalid username or password. Please verify your credentials and try again.",
        );
      }
    });
  });

  describe("Initial Seed Demo User", () => {
    it("allows logging in with default demo username", async () => {
      const login = await loginUser({
        username: "demo",
        password: "demo1234",
      });

      expect(login.ok).toBe(true);
      if (login.ok) {
        expect(login.user.username).toBe("demo");
      }
    });
  });
});
