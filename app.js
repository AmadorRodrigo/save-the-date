import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "./supabase-config.js";

let supabase = null;
const dialog = document.querySelector("#rsvp-dialog");
const form = document.querySelector("#rsvp-form");
const errorBox = document.querySelector("#form-error");
const submitButton = document.querySelector("#submit-button");
const toast = document.querySelector("#toast");
const childrenList = document.querySelector("#children-list");
const spouseComing = document.querySelector("#spouse-coming");
const spouseName = document.querySelector("#spouse-name");
const privacyConsent = document.querySelector("#privacy-consent");
const childrenConsent = document.querySelector("#children-consent");
const childrenConsentField = document.querySelector("#children-consent-field");
let selectedResponse = "yes";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 4200);
}

function addChild() {
  if (childrenList.children.length >= 20) {
    errorBox.textContent = "É possível cadastrar até 20 filhos por convite.";
    return;
  }
  errorBox.textContent = "";
  const card = document.createElement("fieldset");
  card.className = "child-card family-card";
  const number = childrenList.children.length + 1;
  const legend = document.createElement("legend");
  legend.textContent = `Filho(a) ${number}`;
  const fields = document.createElement("div");
  fields.className = "child-fields";
  const nameField = document.createElement("div");
  nameField.className = "field";
  const nameLabel = document.createElement("label");
  const name = document.createElement("input");
  name.type = "text";
  name.id = `child-name-${number}`;
  name.maxLength = 150;
  name.autocomplete = "off";
  name.required = true;
  nameLabel.htmlFor = name.id;
  nameLabel.textContent = "Nome completo *";
  nameField.append(nameLabel, name);
  const ageField = document.createElement("div");
  ageField.className = "field";
  const ageLabel = document.createElement("label");
  const age = document.createElement("input");
  age.id = `child-age-${number}`;
  age.type = "number";
  age.min = "0";
  age.max = "120";
  age.step = "1";
  age.required = true;
  age.inputMode = "numeric";
  ageLabel.htmlFor = age.id;
  ageLabel.textContent = "Idade *";
  ageField.append(ageLabel, age);
  age.addEventListener("input", updateChildrenConsent);
  fields.append(nameField, ageField);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-child";
  remove.textContent = "Remover filho";
  remove.addEventListener("click", () => { card.remove(); renumberChildren(); updateChildrenConsent(); });
  card.append(legend, fields, remove);
  childrenList.append(card);
  updateChildrenConsent();
}

function updateChildrenConsent() {
  const hasMinor = [...childrenList.querySelectorAll('input[type="number"]')]
    .some(input => input.value !== "" && Number(input.value) < 18);
  childrenConsentField.hidden = !hasMinor;
  childrenConsent.required = hasMinor;
  if (!hasMinor) childrenConsent.checked = false;
}

function renumberChildren() {
  [...childrenList.children].forEach((card, index) => {
    const number = index + 1;
    card.querySelector("legend").textContent = `Filho(a) ${number}`;
    const [name, age] = card.querySelectorAll("input");
    name.id = `child-name-${number}`;
    name.previousElementSibling.htmlFor = name.id;
    age.id = `child-age-${number}`;
    age.previousElementSibling.htmlFor = age.id;
  });
}

function isFullName(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length >= 2;
}

function normalizeBrazilianMobile(value) {
  const digits = String(value).replace(/\D/g, "");
  return digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits;
}

function isBrazilianMobile(value) {
  return /^[1-9]\d9\d{8}$/.test(value);
}

document.querySelector("#add-child").addEventListener("click", addChild);
spouseComing.addEventListener("change", () => {
  document.querySelector("#spouse-name-field").hidden = !spouseComing.checked;
  spouseName.required = spouseComing.checked;
  if (!spouseComing.checked) spouseName.value = "";
});

function openForm(response) {
  selectedResponse = response;
  form.reset();
  childrenList.replaceChildren();
  updateChildrenConsent();
  document.querySelector("#spouse-name-field").hidden = true;
  spouseName.required = false;
  errorBox.textContent = "";
  const title = document.querySelector("#form-title");
  const description = document.querySelector("#form-description");
  const attendeeSection = document.querySelector("#attendee-section");
  if (response === "yes") {
    title.textContent = "Confirme sua presença";
    description.textContent = "Informe seus dados e, se for o caso, de seu cônjuge e filhos.";
    attendeeSection.hidden = false;
    submitButton.textContent = "Confirmar presença";
  } else if (response === "no") {
    title.textContent = "Sentiremos sua falta";
    description.textContent = "Avise que você não poderá comparecer.";
    attendeeSection.hidden = true;
    submitButton.textContent = "Enviar resposta";
  } else {
    title.textContent = "Ainda está decidindo?";
    description.textContent = "Registre sua resposta como pendente. Você poderá nos avisar depois.";
    attendeeSection.hidden = true;
    submitButton.textContent = "Registrar resposta";
  }
  dialog.showModal();
}

document.querySelectorAll("[data-response]").forEach(button => button.addEventListener("click", () => openForm(button.dataset.response)));
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

form.addEventListener("submit", async event => {
  event.preventDefault();
  errorBox.textContent = "";
  const fullName = document.querySelector("#full-name").value.trim();
  const phoneInput = document.querySelector("#phone");
  const phone = normalizeBrazilianMobile(phoneInput.value);
  if (!isFullName(fullName)) {
    errorBox.textContent = "Informe seu nome completo.";
    return;
  }
  if (!isBrazilianMobile(phone)) {
    errorBox.textContent = "Informe um celular brasileiro válido com DDD (ex.: (11) 99999-9999).";
    phoneInput.focus();
    return;
  }
  if (!privacyConsent.checked) {
    errorBox.textContent = "Leia o aviso de privacidade e marque a autorização para continuar.";
    return;
  }
  let spouse = null;
  let children = [];
  if (selectedResponse === "yes") {
    if (spouseComing.checked) {
      spouse = spouseName.value.trim();
      if (!isFullName(spouse)) { errorBox.textContent = "Informe o nome completo do cônjuge."; return; }
    }
    children = [...childrenList.querySelectorAll(".child-card")].map(card => ({
      name: card.querySelector('input[type="text"]').value.trim(),
      age: card.querySelector('input[type="number"]').value.trim() === "" ? Number.NaN : Number(card.querySelector('input[type="number"]').value)
    }));
    if (children.some(child => !isFullName(child.name) || !Number.isInteger(child.age) || child.age < 0 || child.age > 120)) {
      errorBox.textContent = "Informe o nome completo e uma idade válida (0 a 120) para cada filho.";
      return;
    }
    if (children.some(child => child.age < 18) && !childrenConsent.checked) {
      errorBox.textContent = "Para informar menores de 18 anos, confirme que você é responsável legal e autorizou o uso desses dados.";
      return;
    }
  }
  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";
  const payload = {
    full_name: fullName,
    phone,
    response: selectedResponse,
    spouse_coming: selectedResponse === "yes" && spouse !== null,
    spouse_name: selectedResponse === "yes" ? spouse : null,
    children: selectedResponse === "yes" ? children : [],
    privacy_consent: privacyConsent.checked,
    privacy_notice_version: "2026-11-v2",
    children_consent: selectedResponse === "yes" && children.some(child => child.age < 18) && childrenConsent.checked,
    party_size: selectedResponse === "yes" ? 1 + (spouse ? 1 : 0) + children.length : null,
  };
  if (!supabaseConfigured) {
    errorBox.textContent = "O Supabase ainda não foi configurado. Sua resposta não foi salva. Siga o passo a passo no README.md.";
    return;
  }
  let error;
  try {
    if (!supabase) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    ({ error } = await supabase.from("rsvps").insert(payload));
  } catch (cause) {
    error = cause;
  }
  submitButton.disabled = false;
  submitButton.textContent = selectedResponse === "yes" ? "Confirmar presença" : selectedResponse === "maybe" ? "Registrar resposta" : "Enviar resposta";
  if (error) {
    console.error(error);
    errorBox.textContent = "Não foi possível salvar sua resposta no Supabase. Tente novamente em instantes.";
    return;
  }
  dialog.close();
  showToast(selectedResponse === "yes" ? "Presença registrada! Obrigado por confirmar. ❤️" : selectedResponse === "no" ? "Resposta registrada. Obrigado por nos avisar." : "Resposta registrada! Você pode confirmar novamente quando decidir.");
  form.reset();
  childrenList.replaceChildren();
});

const video = document.querySelector(".couple-video");
const videoHelp = document.querySelector("#video-help");
video.addEventListener("progress", () => {
  if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return;
  const buffered = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
  const percent = video.duration ? Math.min(100, Math.round(buffered / video.duration * 100)) : 0;
  videoHelp.textContent = percent ? `Preparando o vídeo para reprodução… ${percent}%` : "Preparando o vídeo para reprodução…";
  videoHelp.hidden = false;
});
video.addEventListener("error", () => {
  videoHelp.textContent = "Não foi possível carregar o vídeo. Confira o arquivo MP4 e o caminho no index.html.";
  videoHelp.hidden = false;
});
video.addEventListener("loadedmetadata", () => {
  if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
    videoHelp.textContent = "Preparando o vídeo para reprodução…";
    videoHelp.hidden = false;
  }
});
video.addEventListener("canplaythrough", () => { videoHelp.hidden = true; });
video.addEventListener("waiting", () => {
  videoHelp.textContent = "Carregando o vídeo…";
  videoHelp.hidden = false;
});
video.addEventListener("playing", () => { videoHelp.hidden = true; });
