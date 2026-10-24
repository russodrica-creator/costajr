// Camada de dados do portal: modo local (localStorage) ou Supabase (equipe).
// Cada registro é guardado inteiro como JSON; a interface não precisa saber onde.
(function () {
  "use strict";

  const CFG = window.PORTAL_CONFIG || {};
  const TABLES = { terrenos: "nn_terrenos", leads: "nn_leads" };
  const LOCAL_PREFIX = "cjr.nn.";
  const SESSION_KEY = "cjr.session";

  class AuthError extends Error {}

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new Error("Não foi possível salvar neste navegador (armazenamento bloqueado ou cheio).");
    }
  }

  const local = {
    mode: "local",
    needsLogin: () => false,
    user: () => null,
    async list(col) {
      return readJSON(LOCAL_PREFIX + col, []);
    },
    async upsert(col, rec) {
      const rows = await this.list(col);
      const i = rows.findIndex((r) => r.id === rec.id);
      if (i >= 0) rows[i] = rec;
      else rows.unshift(rec);
      writeJSON(LOCAL_PREFIX + col, rows);
      return rec;
    },
    async remove(col, id) {
      const rows = (await this.list(col)).filter((r) => r.id !== id);
      writeJSON(LOCAL_PREFIX + col, rows);
    },
    async signIn() {},
    signOut() {},
  };

  const base = (CFG.supabaseUrl || "").replace(/\/+$/, "");
  const anon = CFG.supabaseAnonKey || "";

  const remote = {
    mode: "remote",
    session: readJSON(SESSION_KEY, null),

    needsLogin() {
      return !this.session;
    },
    user() {
      return this.session ? this.session.email : null;
    },

    saveSession(data) {
      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        email: (data.user && data.user.email) || (this.session && this.session.email) || "",
      };
      writeJSON(SESSION_KEY, this.session);
    },

    async auth(grant, body) {
      const res = await fetch(`${base}/auth/v1/token?grant_type=${grant}`, {
        method: "POST",
        headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new AuthError(data.error_description || data.msg || "Login não autorizado.");
      }
      this.saveSession(data);
    },

    async signIn(email, password) {
      await this.auth("password", { email, password });
    },

    signOut() {
      this.session = null;
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
    },

    async token() {
      if (!this.session) throw new AuthError("Faça login para continuar.");
      if (this.session.expires_at - 60000 < Date.now()) {
        try {
          await this.auth("refresh_token", { refresh_token: this.session.refresh_token });
        } catch (e) {
          this.signOut();
          throw new AuthError("Sua sessão expirou. Entre novamente.");
        }
      }
      return this.session.access_token;
    },

    async req(path, opts = {}) {
      const token = await this.token();
      const res = await fetch(`${base}/rest/v1/${path}`, {
        ...opts,
        headers: {
          apikey: anon,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(opts.headers || {}),
        },
      });
      if (res.status === 401) {
        this.signOut();
        throw new AuthError("Sua sessão expirou. Entre novamente.");
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erro ao acessar o banco (${res.status}): ${txt.slice(0, 200)}`);
      }
      return res.status === 204 ? null : res.json().catch(() => null);
    },

    async list(col) {
      const rows = await this.req(`${TABLES[col]}?select=data&order=updated_at.desc`);
      return (rows || []).map((r) => r.data);
    },

    async upsert(col, rec) {
      await this.req(TABLES[col], {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: rec.id,
          data: rec,
          updated_at: new Date().toISOString(),
          updated_by: this.user(),
        }),
      });
      return rec;
    },

    async remove(col, id) {
      await this.req(`${TABLES[col]}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };

  window.Store = base && anon ? remote : local;
  window.Store.AuthError = AuthError;
})();
