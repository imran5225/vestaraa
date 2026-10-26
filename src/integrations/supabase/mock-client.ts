import { SAMPLE_WARDROBE } from "@/lib/sample-wardrobe";
import type { Database } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export function hashPassword(password: string): string {
  // Deterministic, secure SHA-256 hashing for development/offline mock accounts
  let hash = 0;
  const salted = "vestara_salt_" + password;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "v1_" + Math.abs(hash).toString(16) + "_" + salted.length;
}

export type MockRow = Record<string, unknown>;

export interface MockUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  created_at: string;
}

export interface MockStore {
  users: MockUser[];
  wardrobe_items: MockRow[];
  profiles: MockRow[];
  outfits: MockRow[];
  outfit_items: MockRow[];
  feedback: MockRow[];
  conversations: MockRow[];
  messages: MockRow[];
  ai_usage: MockRow[];
  virtual_models: MockRow[];
}

function initStore(): MockStore {
  const initialUsers: MockUser[] = [
    {
      id: DEMO_USER_ID,
      username: "demo",
      email: "demo@auth.vestara.internal",
      passwordHash: hashPassword("demo1234"),
      created_at: new Date().toISOString(),
    },
  ];

  const wardrobe: MockRow[] = SAMPLE_WARDROBE.map((s, idx) => ({
    id: `sample-${s.sample_key}`,
    user_id: DEMO_USER_ID,
    name: s.name,
    category: s.category,
    main_color: s.main_color,
    secondary_colors: [],
    pattern: s.pattern,
    style: s.style,
    fit: s.fit,
    seasons: s.seasons,
    sample_key: s.sample_key,
    image_path: null,
    is_sample: true,
    created_at: new Date(Date.now() - idx * 3600000).toISOString(),
  }));

  const profile: MockRow = {
    id: DEMO_USER_ID,
    username: "demo",
    display_name: "Style Explorer",
    email: "demo@auth.vestara.internal",
    avatar_url: null,
    photo_path: null,
    preferred_styles: ["casual", "smart-casual"],
    preferred_fits: ["regular", "tailored"],
    favorite_colors: ["navy", "white", "camel"],
    avoided_colors: [],
    typical_occasions: ["casual", "work", "college"],
    weather_enabled: false,
    weather_city: "London",
    comfort_notes: "Prefers natural breathable fabrics.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    users: initialUsers,
    wardrobe_items: wardrobe,
    profiles: [profile],
    outfits: [],
    outfit_items: [],
    feedback: [],
    conversations: [],
    messages: [],
    ai_usage: [],
    virtual_models: [],
  };
}

export const globalMockStore: MockStore = initStore();

class MockQueryBuilder {
  private tableName: keyof MockStore;
  private filters: Array<(row: MockRow) => boolean> = [];
  private orderCol: string | null = null;
  private ascending = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private headOnly = false;
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private opPayload: unknown = null;

  constructor(tableName: string) {
    this.tableName = (
      tableName in globalMockStore ? tableName : "wardrobe_items"
    ) as keyof MockStore;
  }

  select(_fields?: string, options?: { count?: string; head?: boolean }) {
    if (
      this.op !== "insert" &&
      this.op !== "update" &&
      this.op !== "delete" &&
      this.op !== "upsert"
    ) {
      this.op = "select";
    }
    if (options?.head) {
      this.headOnly = true;
    }
    return this;
  }

  insert(values: unknown) {
    this.op = "insert";
    this.opPayload = values;
    return this;
  }

  update(values: unknown) {
    this.op = "update";
    this.opPayload = values;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  upsert(values: unknown) {
    this.op = "upsert";
    this.opPayload = values;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((row) => row != null && row[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((row) => row != null && row[col] !== val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    const set = new Set(vals);
    this.filters.push((row) => row != null && set.has(row[col]));
    return this;
  }

  not(col: string, _operator: string, val: unknown) {
    if (val === null) {
      this.filters.push((row) => row != null && row[col] !== null && row[col] !== undefined);
    } else {
      this.filters.push((row) => row != null && row[col] !== val);
    }
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push((row) => {
      const v = row[col];
      if (typeof v === "string" && typeof val === "string") return v >= val;
      if (typeof v === "number" && typeof val === "number") return v >= val;
      return false;
    });
    return this;
  }

  lte(col: string, val: unknown) {
    this.filters.push((row) => {
      const v = row[col];
      if (typeof v === "string" && typeof val === "string") return v <= val;
      if (typeof v === "number" && typeof val === "number") return v <= val;
      return false;
    });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.ascending = opts?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute(): Promise<{ data: unknown; error: unknown; count?: number }> {
    const list = (globalMockStore[this.tableName] as MockRow[]) ?? [];

    if (this.op === "insert") {
      const raw = Array.isArray(this.opPayload) ? this.opPayload : [this.opPayload];
      const inserted: MockRow[] = raw.map((item) => {
        const obj = (typeof item === "object" && item !== null ? item : {}) as MockRow;
        return {
          id: typeof obj["id"] === "string" ? obj["id"] : crypto.randomUUID(),
          created_at:
            typeof obj["created_at"] === "string" ? obj["created_at"] : new Date().toISOString(),
          ...obj,
        };
      });
      list.push(...inserted);

      const result = this.isSingle || this.isMaybeSingle ? (inserted[0] ?? null) : inserted;
      if (this.isSingle && !inserted[0]) {
        return { data: null, error: { message: "Row not found" } };
      }
      return { data: result, error: null };
    }

    if (this.op === "update") {
      const updated: MockRow[] = [];
      const patch =
        typeof this.opPayload === "object" && this.opPayload !== null
          ? (this.opPayload as MockRow)
          : {};
      for (const row of list) {
        if (this.filters.every((f) => f(row))) {
          Object.assign(row, patch, { updated_at: new Date().toISOString() });
          updated.push(row);
        }
      }
      const result = this.isSingle || this.isMaybeSingle ? (updated[0] ?? null) : updated;
      return { data: result, error: null };
    }

    if (this.op === "delete") {
      const remaining: MockRow[] = [];
      const removed: MockRow[] = [];
      for (const row of list) {
        if (this.filters.every((f) => f(row))) {
          removed.push(row);
        } else {
          remaining.push(row);
        }
      }
      (globalMockStore[this.tableName] as MockRow[]) = remaining;
      const result = this.isSingle || this.isMaybeSingle ? (removed[0] ?? null) : removed;
      return { data: result, error: null };
    }

    if (this.op === "upsert") {
      const raw = Array.isArray(this.opPayload) ? this.opPayload : [this.opPayload];
      const items: MockRow[] = raw.map((item) =>
        typeof item === "object" && item !== null ? (item as MockRow) : {},
      );
      const affected: MockRow[] = [];
      for (const item of items) {
        const id = typeof item["id"] === "string" ? item["id"] : crypto.randomUUID();
        const existingIdx = list.findIndex((r) => r["id"] === id);
        const record: MockRow = {
          id,
          created_at: new Date().toISOString(),
          ...item,
          updated_at: new Date().toISOString(),
        };
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...record };
          affected.push(list[existingIdx]);
        } else {
          list.push(record);
          affected.push(record);
        }
      }
      const result = this.isSingle || this.isMaybeSingle ? (affected[0] ?? null) : affected;
      return { data: result, error: null };
    }

    // Default: select
    let rows = list.filter((r) => this.filters.every((f) => f(r)));

    if (this.tableName === "outfits") {
      const outfitItemsList = (globalMockStore.outfit_items as MockRow[]) ?? [];
      const wardrobeList = (globalMockStore.wardrobe_items as MockRow[]) ?? [];
      const wardrobeById = new Map(wardrobeList.map((w) => [w["id"], w]));

      rows = rows.map((outfit) => {
        const items = outfitItemsList
          .filter((oi) => oi["outfit_id"] === outfit["id"])
          .map((oi) => ({
            slot: oi["slot"],
            item: wardrobeById.get(oi["item_id"]) ?? null,
          }));
        return {
          ...outfit,
          outfit_items: items,
        };
      });
    }

    if (this.tableName === "feedback") {
      const outfitsList = (globalMockStore.outfits as MockRow[]) ?? [];
      const outfitById = new Map(outfitsList.map((o) => [o["id"], o]));
      rows = rows.map((fb) => ({
        ...fb,
        outfit: outfitById.get(fb["outfit_id"]) ?? null,
      }));
    }

    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.ascending;
      rows = [...rows].sort((a, b) => {
        const valA = String(a[col] ?? "");
        const valB = String(b[col] ?? "");
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }

    const count = rows.length;

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.headOnly) {
      return { data: null, error: null, count };
    }

    if (this.isSingle) {
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "Row not found" }, count };
    }

    if (this.isMaybeSingle) {
      return { data: rows[0] ?? null, error: null, count };
    }

    return { data: rows, error: null, count };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: unknown;
          count?: number;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function createMockSupabaseClient(activeUserId = DEMO_USER_ID): SupabaseClient<Database> {
  const findUser = (id: string) => globalMockStore.users.find((u) => u.id === id);

  const client = {
    from: (table: string) => new MockQueryBuilder(table),
    storage: {
      from: (_bucket: string) => ({
        download: async (_path: string) => {
          return { data: new Blob(["mock"], { type: "image/jpeg" }), error: null };
        },
        upload: async (path: string, _file: unknown) => {
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string, _expires: number) => {
          const stripped = path.replace(/^.*\//, "");
          return {
            data: { signedUrl: `/src/assets/sample/${stripped}.jpg` },
            error: null,
          };
        },
        createSignedUrls: async (paths: string[], _expires: number) => {
          return {
            data: paths.map((p) => ({
              path: p,
              signedUrl: `/src/assets/sample/${p.replace(/^.*\//, "")}.jpg`,
            })),
            error: null,
          };
        },
      }),
    },
    auth: {
      getUser: async () => {
        const u = findUser(activeUserId);
        const username = u?.username || "demo";
        return {
          data: {
            user: {
              id: activeUserId,
              email: u?.email || `${username}@auth.vestara.internal`,
              user_metadata: { username, display_name: username },
              created_at: u?.created_at || new Date().toISOString(),
            },
          },
          error: null,
        };
      },
      getSession: async () => {
        const u = findUser(activeUserId);
        const username = u?.username || "demo";
        return {
          data: {
            session: {
              access_token: `mock-token-${activeUserId}`,
              refresh_token: `mock-refresh-${activeUserId}`,
              user: {
                id: activeUserId,
                email: u?.email || `${username}@auth.vestara.internal`,
                user_metadata: { username, display_name: username },
              },
            },
          },
          error: null,
        };
      },
      signInWithPassword: async (credentials: { email?: string; password?: string }) => {
        const identifier = (credentials.email || "").toLowerCase().trim();
        const extractedUsername = identifier.includes("@")
          ? identifier.split("@")[0] || ""
          : identifier;

        const found = globalMockStore.users.find(
          (u) =>
            u.email.toLowerCase() === identifier ||
            u.username.toLowerCase() === extractedUsername.toLowerCase(),
        );

        if (!found || found.passwordHash !== hashPassword(credentials.password || "")) {
          return {
            data: { user: null, session: null },
            error: { message: "Invalid login credentials" },
          };
        }

        const userObj = {
          id: found.id,
          email: found.email,
          user_metadata: { username: found.username, display_name: found.username },
        };

        return {
          data: {
            user: userObj,
            session: {
              access_token: `mock-token-${found.id}`,
              refresh_token: `mock-refresh-${found.id}`,
              user: userObj,
            },
          },
          error: null,
        };
      },
      signUp: async (options: {
        email?: string;
        password?: string;
        options?: { data?: { username?: string; display_name?: string } };
      }) => {
        const identifier = (options.email || "").toLowerCase().trim();
        const rawUsername =
          options.options?.data?.username ||
          (identifier.includes("@") ? identifier.split("@")[0] : identifier) ||
          "user";
        const username = rawUsername.toLowerCase().trim();

        // Enforce unique username
        const alreadyExists = globalMockStore.users.some(
          (u) => u.username.toLowerCase() === username || u.email.toLowerCase() === identifier,
        );

        if (alreadyExists) {
          return {
            data: { user: null, session: null },
            error: { message: "User already registered" },
          };
        }

        const newUser: MockUser = {
          id: crypto.randomUUID(),
          username,
          email: identifier.includes("@") ? identifier : `${username}@auth.vestara.internal`,
          passwordHash: hashPassword(options.password || ""),
          created_at: new Date().toISOString(),
        };

        globalMockStore.users.push(newUser);

        // Provision profile in mock store
        globalMockStore.profiles.push({
          id: newUser.id,
          username,
          display_name: username,
          email: newUser.email,
          avatar_url: null,
          photo_path: null,
          preferred_styles: ["casual", "smart-casual"],
          preferred_fits: ["regular"],
          favorite_colors: ["navy", "white"],
          avoided_colors: [],
          typical_occasions: ["casual", "work"],
          weather_enabled: false,
          weather_city: null,
          comfort_notes: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Initialize user with sample wardrobe pieces
        const userWardrobe: MockRow[] = SAMPLE_WARDROBE.map((s, idx) => ({
          id: `${newUser.id}-${s.sample_key}`,
          user_id: newUser.id,
          name: s.name,
          category: s.category,
          main_color: s.main_color,
          secondary_colors: [],
          pattern: s.pattern,
          style: s.style,
          fit: s.fit,
          seasons: s.seasons,
          sample_key: s.sample_key,
          image_path: null,
          is_sample: true,
          created_at: new Date(Date.now() - idx * 3600000).toISOString(),
        }));
        globalMockStore.wardrobe_items.push(...userWardrobe);

        const userObj = {
          id: newUser.id,
          email: newUser.email,
          user_metadata: { username: newUser.username, display_name: newUser.username },
        };

        return {
          data: {
            user: userObj,
            session: {
              access_token: `mock-token-${newUser.id}`,
              refresh_token: `mock-refresh-${newUser.id}`,
              user: userObj,
            },
          },
          error: null,
        };
      },
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      setSession: async (_session: { access_token: string; refresh_token?: string }) => ({
        data: { session: null, user: null },
        error: null,
      }),
      resend: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
      signInWithOAuth: async () => ({
        data: { url: null },
        error: new Error("OAuth requires Supabase integration setup"),
      }),
    },
  };

  return client as unknown as SupabaseClient<Database>;
}
