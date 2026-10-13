/* ---------- сохранение ---------- */
const SAVE_KEY = MENUAPI.SAVE_KEY;
function loadSave() {
  try { return MENUAPI.parseSave(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ rank: G.rank, served: G.served, money: G.money, day: G.day, rating: G.rating, pace: G.pace, grindSet: G.grindSet, up: SHOP.filter(i => G[i.id]).map(i => i.id) })); } catch (e) { /* без сохранения тоже можно играть */ }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ничего */ } }

