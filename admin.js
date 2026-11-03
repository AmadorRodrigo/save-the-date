import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "./supabase-config.js";
let supabase = null;
const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const dashboardError = document.querySelector("#dashboard-error");
const recordsEl = document.querySelector("#records");
const summary = document.querySelector("#summary");
let allRecords = [];
const statusLabels = { yes: "Confirmado", maybe: "Ainda não sabe", no: "Não poderá ir" };
const dateFormat = value => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

async function connectSupabase() {
  if (supabase) return supabase;
  if (!supabaseConfigured) return null;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) { dashboard.hidden = true; loginPanel.hidden = false; }
  });
  return supabase;
}

async function refreshSession() {
  try {
    const client = await connectSupabase();
    if (!client) { loginError.textContent = "Configure a URL e a chave publicável do Supabase em supabase-config.js."; return; }
    const { data } = await client.auth.getSession();
    if (data.session) await loadRecords();
  } catch (error) {
    console.error(error);
    loginError.textContent = "Não foi possível conectar ao Supabase. Confira a configuração e a conexão.";
  }
}
loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginError.textContent = "";
  let client;
  try { client = await connectSupabase(); }
  catch (error) { console.error(error); loginError.textContent = "Não foi possível conectar ao Supabase. Confira a configuração e a conexão."; return; }
  if (!client) { loginError.textContent = "Configure a URL e a chave publicável do Supabase em supabase-config.js."; return; }
  const { error } = await client.auth.signInWithPassword({ email: document.querySelector("#email").value.trim(), password: document.querySelector("#password").value });
  if (error) { loginError.textContent = "Não foi possível entrar. Confira os dados e se este e-mail foi autorizado."; return; }
  await loadRecords();
});
document.querySelector("#logout-button").addEventListener("click", async () => { await supabase.auth.signOut(); dashboard.hidden = true; loginPanel.hidden = false; });
document.querySelector("#search").addEventListener("input", renderRecords);
document.querySelector("#filter").addEventListener("change", renderRecords);
document.querySelector("#export-button").addEventListener("click", exportCsv);

async function loadRecords() {
  dashboardError.textContent = "";
  const { data, error } = await supabase.from("rsvps").select("id,full_name,phone,response,spouse_coming,spouse_name,children,party_size,message,privacy_consent,privacy_consent_at,privacy_notice_version,children_consent,children_consent_at,created_at").order("created_at", { ascending: false });
  if (error) { dashboardError.textContent = "Não foi possível carregar registros. Verifique a autorização administrativa e as políticas RLS."; return; }
  allRecords = data || [];
  loginPanel.hidden = true;
  dashboard.hidden = false;
  renderRecords();
}
function renderRecords() {
  if (dashboard.hidden) return;
  const query = document.querySelector("#search").value.trim().toLocaleLowerCase("pt-BR");
  const filter = document.querySelector("#filter").value;
  const queryDigits = query.replace(/\D/g, "");
  const rows = allRecords.filter(row => {
    const searchText = [row.full_name, row.phone, row.spouse_name, ...(row.children || []).map(child => child.name)].join(" ").toLocaleLowerCase("pt-BR");
    const phoneMatches = queryDigits.length > 0 && String(row.phone || "").replace(/\D/g, "").includes(queryDigits);
    return (filter === "all" || row.response === filter) && (searchText.includes(query) || phoneMatches);
  });
  const confirmed = allRecords.filter(row => row.response === "yes");
  const totalPeople = confirmed.reduce((sum, row) => sum + (row.party_size || 1), 0);
  summary.textContent = `${confirmed.length} grupo(s) confirmado(s) · ${totalPeople} pessoa(s) confirmada(s) · ${allRecords.length} resposta(s) no total`;
  if (!rows.length) { recordsEl.innerHTML = '<div class="empty-state">Nenhuma resposta encontrada.</div>'; return; }
  recordsEl.innerHTML = rows.map(row => {
    const phone = String(row.phone || "").replace(/\D/g, "");
    const phoneDisplay = phone.length === 11 ? `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}` : "Não informado";
    const people = [
      ...(row.spouse_coming && row.spouse_name ? [`Cônjuge: ${escapeHtml(row.spouse_name)}`] : []),
      ...(row.children || []).map(child => `Filho(a): ${escapeHtml(child.name)} — ${escapeHtml(child.age)} anos`)
    ];
    const consentDetails = `Consentimento: ${row.privacy_consent ? `sim, ${dateFormat(row.privacy_consent_at)}` : "não registrado"}${row.children_consent ? ` · Responsável por menores: sim, ${dateFormat(row.children_consent_at)}` : ""}`;
    return `<article class="record"><div class="record-head"><div><h3>${escapeHtml(row.full_name)}</h3><p class="record-meta">Celular: ${phone ? `<a href="tel:${phone}">${escapeHtml(phoneDisplay)}</a>` : phoneDisplay}</p></div><span class="status ${escapeHtml(row.response)}">${statusLabels[row.response] || "Resposta"}</span></div>
      <p class="record-meta">Recebido em ${dateFormat(row.created_at)}${row.party_size ? ` · Grupo de ${row.party_size} pessoa(s)` : ""}</p>
      ${people.length ? `<ul class="companion-list">${people.map(person => `<li>${person}</li>`).join("")}</ul>` : "<p class=\"record-meta\">Sem cônjuge ou filhos informados.</p>"}
      <p class="record-meta">${escapeHtml(consentDetails)}${row.privacy_notice_version ? ` · Aviso ${escapeHtml(row.privacy_notice_version)}` : ""}</p>
      ${row.message ? `<p><strong>Observação:</strong> ${escapeHtml(row.message)}</p>` : ""}</article>`;
  }).join("");
}
function exportCsv() {
  const headers = ["Convidado", "Celular", "Cônjuge", "Filhos", "Resposta", "Total do grupo", "Data", "Consentimento", "Consentimento responsável", "Versão do aviso"];
  const rows = allRecords.map(row => [row.full_name, row.phone || "", row.spouse_coming ? row.spouse_name : "", (row.children || []).map(child => `${child.name} (${child.age} anos)`).join("; "), statusLabels[row.response] || row.response, row.party_size ?? "", dateFormat(row.created_at), row.privacy_consent_at ? dateFormat(row.privacy_consent_at) : "", row.children_consent_at ? dateFormat(row.children_consent_at) : "", row.privacy_notice_version || ""]);
  const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = "convidados-save-the-date.csv"; a.click(); URL.revokeObjectURL(url);
}
refreshSession();
