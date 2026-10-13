/* ---------- хранилища: игра и настройки лежат в localStorage под разными ключами ---------- */
const SAVE_KEY = MENUAPI.SAVE_KEY;
/* SaveStore: load / save / clear. Чтобы подключить аккаунты, заменить эту реализацию другой с теми же методами. */
const SAVE_STORE = {
  load() {
    if (SBX.on) return { kind: 'none' };
    try { return MENUAPI.readSave(localStorage.getItem(SAVE_KEY)); } catch (e) { return { kind: 'none' }; }
  },
  save(d) { if (SBX.on) return; try { localStorage.setItem(SAVE_KEY, MENUAPI.serializeSave(d)); } catch (e) { /* без сохранения тоже можно играть */ } },
  clear() { if (SBX.on) return; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ничего */ } },
  /* битое сохранение откладывается в сторону, чтобы его можно было достать вручную */
  quarantine() { if (SBX.on) return; try { const raw = localStorage.getItem(SAVE_KEY); if (raw) localStorage.setItem(SAVE_KEY + '-broken', raw); localStorage.removeItem(SAVE_KEY); } catch (e) { /* ничего */ } }
};
const SETTINGS_STORE = {
  load() { try { return MENUAPI.parseSettings(localStorage.getItem(MENUAPI.SETTINGS_KEY)); } catch (e) { return MENUAPI.parseSettings(null); } },
  save(s) { try { localStorage.setItem(MENUAPI.SETTINGS_KEY, MENUAPI.serializeSettings(s)); } catch (e) { /* настройки не сохранятся */ } }
};
let SET = SETTINGS_STORE.load();
muted = !SET.sfxOn;
function loadSave() { const r = SAVE_STORE.load(); return r.kind === 'ok' ? r.data : null; }
/* Сохраняется состояние на начало дня (деньги и рейтинг без прогресса текущей смены), как и раньше. */
function saveGame() {
  SAVE_STORE.save({ rank: G.rank, served: G.served, money: G.money, day: G.day, rating: G.rating, pace: G.pace, grindSet: G.grindSet, tutorialSeen: G.tutorialSeen, up: SHOP.filter(i => G[i.id]).map(i => i.id) });
}
function clearSave() { SAVE_STORE.clear(); }
