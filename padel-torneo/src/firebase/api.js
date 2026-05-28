// src/firebase/api.js
const API_KEY = "AIzaSyBeTV96C38qBtPTKa0wATEJ_S2wtbClpDg";
const PROJECT = "app-padel-torneo";
const URL = (c) => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/torneos/${c}?key=${API_KEY}`;

export async function fbGet(code) {
  try {
    const r = await fetch(URL(code));
    if (!r.ok) return null;
    const d = await r.json();
    return d.fields ? JSON.parse(d.fields.data.stringValue) : null;
  } catch (e) {
    return null;
  }
}

export async function fbSet(code, state) {
  try {
    await fetch(URL(code), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: { data: { stringValue: JSON.stringify(state) } },
      }),
    });
  } catch (e) {
    console.error(e);
  }
}