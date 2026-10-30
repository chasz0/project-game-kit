import { storage } from '@core/storage.js';

const out = document.getElementById('output');
const panels = {
  local: document.getElementById('panelLocal'),
  file: document.getElementById('panelFile'),
  supabase: document.getElementById('panelSupabase')
};

let statusMsg = 'Connected to LocalStorage.';

const ensureDefaults = () => {
  if (!storage.has('level')) storage.set('level', 1);
  if (!storage.has('gold')) storage.set('gold', 100);
  if (!storage.has('highScore')) storage.set('highScore', 1200);
};

const render = () => {
  const syncTime = storage.lastSyncAt
    ? new Date(storage.lastSyncAt).toLocaleTimeString()
    : 'never';

  out.textContent =
    `Active Backend: ${storage.mode.toUpperCase()} | Last Synced: ${syncTime}\n` +
    (storage.lastError ? `Error: ${storage.lastError}\n` : '') +
    `Status: ${statusMsg}\n\n` +
    `--- Saved Payload (storage.getAll()) ---\n` +
    JSON.stringify(storage.getAll(), null, 2);
};

document.querySelectorAll('#modeTabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    document.querySelectorAll('#modeTabs button').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
    Object.entries(panels).forEach(([k, el]) =>
      el.classList.toggle('hidden', k !== mode)
    );
  });
});

document.getElementById('btnConnectLocal').addEventListener('click', async () => {
  const ns = document.getElementById('inpNamespace').value.trim() || 'gamekit_demo';
  await storage.useLocal({ namespace: ns });
  ensureDefaults();
  statusMsg = `Switched to LocalStorage (namespace: "${ns}").`;
  render();
});

document.getElementById('btnConnectFile').addEventListener('click', async () => {
  const filename = document.getElementById('inpFilename').value.trim() || 'gamekit-save.json';
  try {
    await storage.useFile({ filename });
    ensureDefaults();
    await storage.flush();
    statusMsg = `Connected to Root File "./${filename}". Check your project root folder!`;
  } catch (err) {
    statusMsg = `File mode error: ${err.message}`;
  }
  render();
});

document.getElementById('btnDownloadJson').addEventListener('click', () => {
  storage.downloadFile();
});

document.getElementById('btnConnectSupabase').addEventListener('click', async () => {
  const url = document.getElementById('inpSbUrl').value.trim();
  const anonKey = document.getElementById('inpSbKey').value.trim();
  const profileId = document.getElementById('inpSbProfile').value.trim() || 'player_one';

  try {
    statusMsg = 'Connecting to Supabase...';
    render();
    await storage.useSupabase({ url, anonKey, profileId });
    ensureDefaults();
    await storage.flush();
    statusMsg = `Synced with Supabase table "gamekit_saves" (profile: "${profileId}").`;
  } catch (err) {
    statusMsg = `Supabase error: ${err.message}`;
  }
  render();
});

document.getElementById('btnAddGold').addEventListener('click', async () => {
  await storage.set('gold', storage.get('gold', 0) + 50);
  statusMsg = 'Saved +50 Gold.';
  render();
});

document.getElementById('btnLevelUp').addEventListener('click', async () => {
  await storage.set('level', storage.get('level', 1) + 1);
  statusMsg = 'Saved Level Up.';
  render();
});

document.getElementById('btnNewHigh').addEventListener('click', async () => {
  const nextScore = storage.get('highScore', 0) + Math.floor(100 + Math.random() * 400);
  await storage.set('highScore', nextScore);
  statusMsg = `New High Score saved: ${nextScore}`;
  render();
});

document.getElementById('btnReload').addEventListener('click', async () => {
  try {
    await storage.load();
    statusMsg = `Reloaded state from ${storage.mode.toUpperCase()} backend.`;
  } catch (err) {
    statusMsg = `Reload failed: ${err.message}`;
  }
  render();
});

document.getElementById('btnClearSave').addEventListener('click', async () => {
  await storage.clear();
  ensureDefaults();
  statusMsg = 'Reset save data to defaults.';
  render();
});

ensureDefaults();
render();