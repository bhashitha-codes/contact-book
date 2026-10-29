const form = document.getElementById("contactForm");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const groupInput = document.getElementById("contact_group");
const formTitle = document.getElementById("formTitle");
const saveButton = document.getElementById("saveButton");
const cancelEditButton = document.getElementById("cancelEdit");
const formMessage = document.getElementById("formMessage");
const pageMessage = document.getElementById("pageMessage");
const contactsList = document.getElementById("contactsList");
const searchInput = document.getElementById("searchInput");
const groupFilter = document.getElementById("groupFilter");
const totalCount = document.getElementById("totalCount");
const showingCount = document.getElementById("showingCount");
const headingCount = document.getElementById("headingCount");
const deleteDialog = document.getElementById("deleteDialog");
const deletePrompt = document.getElementById("deletePrompt");
const confirmDeleteButton = document.getElementById("confirmDelete");
const keepContactButton = document.getElementById("keepContact");

let editingId = null;
let pendingDeleteId = null;
let searchTimer = null;
let currentContacts = [];

function showMessage(element, message, type = "error") {
  element.textContent = message;
  element.className = `message show ${type}`;
}
function clearMessage(element) {
  element.textContent = "";
  element.className = "message";
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`);
  }
  return payload;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
function setFormMode(contact = null) {
  editingId = contact ? contact.id : null;
  formTitle.textContent = contact ? "Edit contact" : "Add a contact";
  saveButton.textContent = contact ? "Update contact" : "Save contact";
  cancelEditButton.classList.toggle("hidden", !contact);
  if (contact) {
    nameInput.value = contact.name || "";
    phoneInput.value = contact.phone || "";
    emailInput.value = contact.email || "";
    groupInput.value = contact.contact_group || "Other";
    nameInput.focus();
  } else {
    form.reset();
    groupInput.value = "Other";
  }
  clearMessage(formMessage);
}
function renderContacts(contacts) {
  currentContacts = contacts;
  showingCount.textContent = String(contacts.length);
  headingCount.textContent = String(contacts.length);

  if (!contacts.length) {
    contactsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">◎</span>
        <strong>No contacts found</strong><br>
        Add a contact using the form, or try another search.
      </div>`;
    return;
  }

  contactsList.innerHTML = contacts.map((contact) => `
    <article class="contact-card">
      <div class="avatar" aria-hidden="true">${escapeHtml(initials(contact.name))}</div>
      <div class="contact-info">
        <h3 class="contact-name">${escapeHtml(contact.name)}</h3>
        ${contact.phone ? `<p class="contact-detail">☎ ${escapeHtml(contact.phone)}</p>` : ""}
        ${contact.email ? `<p class="contact-detail">✉ ${escapeHtml(contact.email)}</p>` : ""}
        <div class="contact-meta"><span class="group-pill">${escapeHtml(contact.contact_group || "Other")}</span></div>
      </div>
      <div class="contact-actions">
        <button class="icon-button" type="button" data-action="edit" data-id="${contact.id}" aria-label="Edit ${escapeHtml(contact.name)}" title="Edit">✎</button>
        <button class="icon-button delete" type="button" data-action="delete" data-id="${contact.id}" aria-label="Delete ${escapeHtml(contact.name)}" title="Delete">×</button>
      </div>
    </article>`).join("");
}
async function loadContacts() {
  clearMessage(pageMessage);
  contactsList.innerHTML = '<div class="loading-state">Loading your contacts…</div>';
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  if (groupFilter.value !== "all") params.set("group", groupFilter.value);

  try {
    const contacts = await api(`/api/contacts?${params.toString()}`);
    renderContacts(contacts);
    // Total reflects the currently loaded list; showing reflects active filters.
    totalCount.textContent = String(contacts.length);
  } catch (error) {
    contactsList.innerHTML = '<div class="empty-state">Contacts could not be loaded.</div>';
    showMessage(pageMessage, `${error.message} Check your server and Supabase setup.`);
  }
}
function collectForm() {
  return {
    name: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    email: emailInput.value.trim(),
    contact_group: groupInput.value
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(formMessage);
  const payload = collectForm();
  if (!payload.name) {
    showMessage(formMessage, "Please enter the contact's name.");
    nameInput.focus();
    return;
  }

  const wasEditing = editingId !== null;
  saveButton.disabled = true;
  saveButton.textContent = wasEditing ? "Updating…" : "Saving…";
  try {
    await api(wasEditing ? `/api/contacts/${editingId}` : "/api/contacts", {
      method: wasEditing ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    setFormMode();
    showMessage(formMessage, wasEditing ? "Contact updated." : "Contact saved.", "success");
    await loadContacts();
  } catch (error) {
    showMessage(formMessage, error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId !== null ? "Update contact" : "Save contact";
  }
});

cancelEditButton.addEventListener("click", () => setFormMode());
contactsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const contact = currentContacts.find((item) => Number(item.id) === id);
  if (!contact) return;

  if (action === "edit") {
    setFormMode(contact);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (action === "delete") {
    pendingDeleteId = id;
    deletePrompt.textContent = `Delete "${contact.name}"? This action cannot be undone.`;
    deleteDialog.showModal();
  }
});

keepContactButton.addEventListener("click", () => {
  pendingDeleteId = null;
  deleteDialog.close();
});
confirmDeleteButton.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  confirmDeleteButton.disabled = true;
  confirmDeleteButton.textContent = "Deleting…";
  try {
    await api(`/api/contacts/${pendingDeleteId}`, { method: "DELETE" });
    if (Number(editingId) === pendingDeleteId) setFormMode();
    deleteDialog.close();
    pendingDeleteId = null;
    await loadContacts();
    showMessage(pageMessage, "Contact deleted successfully.", "success");
  } catch (error) {
    deleteDialog.close();
    showMessage(pageMessage, error.message);
  } finally {
    confirmDeleteButton.disabled = false;
    confirmDeleteButton.textContent = "Delete contact";
  }
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadContacts, 250);
});
groupFilter.addEventListener("change", loadContacts);

async function startApp() {
  try {
    await api("/api/health");
    await loadContacts();
  } catch (error) {
    contactsList.innerHTML = '<div class="empty-state">The backend server is not responding.</div>';
    showMessage(pageMessage, "Start the app with `npm start`, then open http://localhost:3000.");
  }
}
startApp();
