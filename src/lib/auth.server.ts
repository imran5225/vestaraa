import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createMockSupabaseClient, globalMockStore } from "@/integrations/supabase/mock-client";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameToInternalEmail(username: string): string {
  return `${normalizeUsername(username)}@auth.vestara.internal`;
}

function isPlaceholderSupabase(): boolean {
  const key =
    process.env["VITE_SUPABASE_ANON_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return !key || key === "your-anon-publishable-key" || key === "mock-anon-key";
}

export async function registerUser(input: { username: string; password: string }): Promise<
  | {
      ok: true;
      session: { access_token: string; refresh_token?: string };
      user: { id: string; username: string };
    }
  | { ok: false; error: string }
> {
  const username = normalizeUsername(input.username);
  const email = usernameToInternalEmail(username);

  // If in local/standalone or placeholder mode, use our secure in-memory auth provider
  if (isPlaceholderSupabase()) {
    const mock = createMockSupabaseClient();
    const { data, error } = await mock.auth.signUp({
      email,
      password: input.password,
      options: { data: { username, display_name: username } },
    });

    if (error || !data.user || !data.session) {
      if (error && /already registered/i.test(error.message)) {
        return {
          ok: false,
          error: `Username "${username}" is already taken. Please choose another.`,
        };
      }
      return { ok: false, error: error?.message || "Registration failed. Please try again." };
    }

    return {
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      user: {
        id: data.user.id,
        username,
      },
    };
  }

  // Real Supabase environment
  const SUPABASE_URL =
    process.env["VITE_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    "https://yvjdsbrioaycwcflfvts.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["VITE_SUPABASE_ANON_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  // 1. Verify username uniqueness in public profiles table
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .or(`display_name.eq.${username},username.eq.${username}`)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        error: `Username "${username}" is already taken. Please choose another.`,
      };
    }
  } catch {
    // If column doesn't exist yet, proceed to auth check
  }

  // 2. Register user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        username,
        display_name: username,
      },
    },
  });

  if (error) {
    if (/already registered|already exists|unique constraint/i.test(error.message)) {
      return {
        ok: false,
        error: `Username "${username}" is already taken. Please choose another.`,
      };
    }
    return { ok: false, error: error.message };
  }

  // If session returned immediately
  if (data.session && data.user) {
    try {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: username,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Continue even if profile creation was handled by trigger
    }

    return {
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      user: {
        id: data.user.id,
        username,
      },
    };
  }

  // Attempt immediate sign-in to retrieve tokens without verification delays
  const signInRes = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signInRes.data?.session && signInRes.data.user) {
    try {
      await supabase.from("profiles").upsert({
        id: signInRes.data.user.id,
        display_name: username,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Ignore profile collision
    }

    return {
      ok: true,
      session: {
        access_token: signInRes.data.session.access_token,
        refresh_token: signInRes.data.session.refresh_token,
      },
      user: {
        id: signInRes.data.user.id,
        username,
      },
    };
  }

  if (signInRes.error) {
    return { ok: false, error: signInRes.error.message };
  }

  return { ok: false, error: "Registration completed but session initialization failed." };
}

export async function loginUser(input: { username: string; password: string }): Promise<
  | {
      ok: true;
      session: { access_token: string; refresh_token?: string };
      user: { id: string; username: string };
    }
  | { ok: false; error: string }
> {
  const username = normalizeUsername(input.username);
  const email = usernameToInternalEmail(username);

  // If in local/standalone or placeholder mode, use mock auth provider
  if (isPlaceholderSupabase()) {
    const mock = createMockSupabaseClient();
    const { data, error } = await mock.auth.signInWithPassword({
      email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      return {
        ok: false,
        error: "Invalid username or password. Please verify your credentials and try again.",
      };
    }

    return {
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      user: {
        id: data.user.id,
        username: (data.user.user_metadata?.username as string) || username,
      },
    };
  }

  // Real Supabase
  const SUPABASE_URL =
    process.env["VITE_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    "https://yvjdsbrioaycwcflfvts.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["VITE_SUPABASE_ANON_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error || !data.session || !data.user) {
    return {
      ok: false,
      error: "Invalid username or password. Please verify your credentials and try again.",
    };
  }

  return {
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    user: {
      id: data.user.id,
      username,
    },
  };
}
