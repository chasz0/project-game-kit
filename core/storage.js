// Unified save-data manager supporting LocalStorage, Root File, and Supabase backends.
//
//   await storage.useFile({ filename: 'gamekit-save.json' });
//   await storage.useSupabase({ url: 'https://...', anonKey: '...', profileId: 'slot_1' });
//   storage.set('highScore', 12400);
//   const score = storage.get('highScore', 0);

export class StorageManager {
  constructor({ namespace = 'gamekit' } = {}) {
    this.namespace = namespace;
    this.mode = 'local';
    this.cache = new Map();
    this.lastSyncAt = null;
    this.lastError = null;

    this.fileConfig = {
      endpoint: '/__gamekit_storage',
      filename: 'gamekit-save.json'
    };

    this.supabaseConfig = {
      url: '',
      anonKey: '',
      table: 'gamekit_saves',
      profileId: 'default_profile',
      client: null
    };

    this._loadFromLocalStorage();
  }

  // Configures browser localStorage as the active backend.
  async useLocal({ namespace = this.namespace } = {}) {
    this.namespace = namespace;
    this.mode = 'local';
    this.lastError = null;
    this._loadFromLocalStorage();
    this.lastSyncAt = Date.now();
    return this.getAll();
  }

  // Configures a JSON file in the project root as the active backend.
  async useFile({ filename = 'gamekit-save.json', endpoint = '/__gamekit_storage' } = {}) {
    this.mode = 'file';
    this.lastError = null;
    this.fileConfig = { filename, endpoint };
    await this.load();
    return this.getAll();
  }

  // Establishes a Supabase connection (via REST URL + anonKey or an existing supabase-js client).
  async useSupabase({
    url = '',
    anonKey = '',
    table = 'gamekit_saves',
    profileId = 'default_profile',
    client = null
  } = {}) {
    if (!client && (!url || !anonKey)) {
      throw new Error('StorageManager.useSupabase: provide { url, anonKey } or { client }');
    }
    this.mode = 'supabase';
    this.lastError = null;
    this.supabaseConfig = {
      url: url.replace(/\/+$/, ''),
      anonKey,
      table,
      profileId,
      client
    };
    await this.load();
    return this.getAll();
  }

  // Reads a value synchronously from the active memory cache.
  get(key, fallback = null) {
    if (!this.cache.has(key)) return fallback;
    return this.cache.get(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  // Writes a value to the cache immediately and flushes to the active backend.
  set(key, value) {
    this.cache.set(key, value);
    this._saveToLocalStorage();
    return this.flush();
  }

  // Sets multiple keys at once and performs a single backend flush.
  setMany(entries = {}) {
    for (const [k, v] of Object.entries(entries)) {
      this.cache.set(k, v);
    }
    this._saveToLocalStorage();
    return this.flush();
  }

  remove(key) {
    const existed = this.cache.delete(key);
    this._saveToLocalStorage();
    this.flush();
    return existed;
  }

  clear() {
    this.cache.clear();
    this._saveToLocalStorage();
    return this.flush();
  }

  getAll() {
    const out = {};
    for (const [k, v] of this.cache.entries()) {
      out[k] = v;
    }
    return out;
  }

  // Pulls the latest save payload from the active backend into the cache.
  async load() {
    this.lastError = null;
    try {
      if (this.mode === 'local') {
        this._loadFromLocalStorage();
      } else if (this.mode === 'file') {
        const data = await this._readFromFile();
        this._replaceCache(data);
      } else if (this.mode === 'supabase') {
        const data = await this._readFromSupabase();
        if (data) this._replaceCache(data);
      }
      this.lastSyncAt = Date.now();
    } catch (err) {
      this.lastError = err.message;
      throw err;
    }
    return this.getAll();
  }

  // Pushes the current cache state to the active backend.
  async flush() {
    this.lastError = null;
    const payload = this.getAll();

    try {
      if (this.mode === 'local') {
        this._saveToLocalStorage();
      } else if (this.mode === 'file') {
        await this._writeToFile(payload);
      } else if (this.mode === 'supabase') {
        await this._writeToSupabase(payload);
      }
      this.lastSyncAt = Date.now();
    } catch (err) {
      this.lastError = err.message;
      throw err;
    }
    return payload;
  }

  // Downloads the current save state as a .json file in the browser.
  downloadFile(filename = this.fileConfig.filename) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([JSON.stringify(this.getAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Imports a JSON string or object into the cache and flushes to the active backend.
  async importJSON(jsonOrObject) {
    const parsed = typeof jsonOrObject === 'string' ? JSON.parse(jsonOrObject) : jsonOrObject;
    if (!parsed || typeof parsed !== 'object') {
      throw new TypeError('StorageManager.importJSON: expected a JSON object');
    }
    this._replaceCache(parsed);
    this._saveToLocalStorage();
    return this.flush();
  }

  _storageKey() {
    return `${this.namespace}:save`;
  }

  _replaceCache(obj = {}) {
    this.cache.clear();
    for (const [k, v] of Object.entries(obj)) {
      this.cache.set(k, v);
    }
  }

  _loadFromLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (raw) {
        this._replaceCache(JSON.parse(raw));
      }
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }

  _saveToLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify(this.getAll()));
    } catch {
      // Ignore storage quota errors
    }
  }

  async _readFromFile() {
    const { endpoint, filename } = this.fileConfig;
    if (typeof fetch !== 'undefined' && typeof window !== 'undefined') {
      const res = await fetch(`${endpoint}?file=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(`File read failed (${res.status})`);
      return await res.json();
    }
    return {};
  }

  async _writeToFile(payload) {
    const { endpoint, filename } = this.fileConfig;
    if (typeof fetch !== 'undefined' && typeof window !== 'undefined') {
      const res = await fetch(`${endpoint}?file=${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload, null, 2)
      });
      if (!res.ok) throw new Error(`File write failed (${res.status})`);
    }
  }

  async _readFromSupabase() {
    const { url, anonKey, table, profileId, client } = this.supabaseConfig;

    if (client) {
      const { data, error } = await client
        .from(table)
        .select('data')
        .eq('profile_id', profileId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? data.data : {};
    }

    const queryUrl = `${url}/rest/v1/${encodeURIComponent(table)}?profile_id=eq.${encodeURIComponent(profileId)}&select=data`;
    const res = await fetch(queryUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase GET error (${res.status}): ${text}`);
    }

    const rows = await res.json();
    return rows.length > 0 && rows[0].data ? rows[0].data : {};
  }

  async _writeToSupabase(payload) {
    const { url, anonKey, table, profileId, client } = this.supabaseConfig;
    const row = {
      profile_id: profileId,
      data: payload,
      updated_at: new Date().toISOString()
    };

    if (client) {
      const { error } = await client
        .from(table)
        .upsert(row, { onConflict: 'profile_id' });
      if (error) throw new Error(error.message);
      return;
    }

    const upsertUrl = `${url}/rest/v1/${encodeURIComponent(table)}?on_conflict=profile_id`;
    const res = await fetch(upsertUrl, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(row)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase UPSERT error (${res.status}): ${text}`);
    }
  }
}

export const storage = new StorageManager();