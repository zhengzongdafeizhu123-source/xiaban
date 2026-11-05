(function () {
  'use strict';
  const rules = XiabanWalletRules, key = 'wallet';
  const scope = new URL('.', location.href).pathname;
  const databaseName = 'xiaban-save:' + scope;
  let opening, syncing, save, ready = false;
  let cachedView, viewedAt;
  const updates = typeof BroadcastChannel === 'function' ? new BroadcastChannel(databaseName) : null;

  function openDatabase() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onerror = () => reject(Error('storage'));
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close(); opening = null; };
          resolve(database);
        };
      }).catch(error => { opening = null; throw error; });
    }
    return opening;
  }

  async function transact(mode, change) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('saves', mode);
      const store = transaction.objectStore('saves'), get = store.get(key);
      let value, failure;
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () => reject(failure || Error('storage'));
      get.onsuccess = () => {
        try {
          value = change(get.result);
          if (mode === 'readwrite') store.put(value.save, key);
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    });
  }

  function apply(next, changed) {
    save = next;
    ready = true;
    cachedView = null;
    window.dispatchEvent(new CustomEvent('walletchange', { detail: changed }));
  }

  function storageFailure(error) {
    if (error.message === 'storage' || error instanceof DOMException) {
      ready = false;
      window.dispatchEvent(new Event('walletchange'));
      throw Error('storage');
    }
    throw error;
  }

  async function write(change, notify = true) {
    try {
      const result = await transact('readwrite', existing => change(existing, Date.now()));
      apply(result.save, notify);
      if (notify) updates?.postMessage('changed');
      return result.result;
    } catch (error) { return storageFailure(error); }
  }

  function settle(existing, now) {
    const current = existing || rules.newSave(now);
    rules.settle(current, now);
    return current;
  }

  function sync() {
    if (!syncing) {
      syncing = write((existing, now) => ({ save: settle(existing, now) }), false).finally(() => { syncing = null; });
    }
    return syncing;
  }

  async function codeDigest(input) {
    const code = typeof input === 'string' ? input.trim().toUpperCase() : '';
    if (!/^[A-Z0-9-]{5,80}$/.test(code)) throw Error('cdkInvalid');
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function send(action, payload) {
    const data = action === 'redeem' ? { digest: await codeDigest(payload.code) } : payload;
    return write((existing, now) => {
      const current = settle(existing, now);
      return { save: current, result: rules.perform(current, action, data, now) };
    });
  }

  async function importSave(text) {
    let next;
    try { next = JSON.parse(text); } catch (_) { throw Error('backup'); }
    if (!rules.validSave(next)) throw Error('backup');
    return write((_current, now) => {
      rules.settle(next, now);
      return { save: next };
    });
  }

  function currentView() {
    if (!save) return null;
    const now = Date.now();
    if (!cachedView || Math.floor(now / 1000) !== viewedAt) {
      viewedAt = Math.floor(now / 1000);
      cachedView = rules.view(save, now);
    }
    return cachedView;
  }

  function refresh() { sync().catch(() => {}); }
  if (updates) updates.onmessage = () => {
    transact('readonly', current => current).then(current => { if (current) apply(current, true); }).catch(() => {});
  };
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  window.PigWallet = {
    sync, send, importSave, now: () => Date.now(), ready: () => ready,
    state: currentView,
    read: period => { const view = currentView(); return view ? view[period] / SkinCatalog.micro : null; },
    exportSave: async () => {
      await sync();
      return JSON.stringify(save, null, 2);
    }
  };
  refresh();
})();
