require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing Supabase settings. Copy .env.example to .env and add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

function validateContact(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const group = typeof body.contact_group === "string"
    ? body.contact_group.trim()
    : "Other";

  if (!name) return { error: "Name is required." };
  if (name.length > 100) return { error: "Name must be 100 characters or fewer." };
  if (phone.length > 30) return { error: "Phone must be 30 characters or fewer." };
  if (email.length > 254) return { error: "Email must be 254 characters or fewer." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (group.length > 50) return { error: "Group must be 50 characters or fewer." };

  return {
    value: {
      name,
      phone: phone || null,
      email: email || null,
      contact_group: group || "Other"
    }
  };
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Contact Book API is running." });
});

app.get("/api/contacts", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, phone, email, contact_group, created_at")
      .order("name", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("Supabase list error:", error.message);
      return res.status(500).json({
        error: "Could not load contacts. Check that the contacts table exists and your Supabase settings are correct."
      });
    }

    const search = String(req.query.search || "").trim().toLowerCase();
    const group = String(req.query.group || "").trim().toLowerCase();

    const filtered = (data || []).filter((contact) => {
      const matchesSearch = !search || [
        contact.name, contact.phone, contact.email, contact.contact_group
      ].some((value) => String(value || "").toLowerCase().includes(search));
      const matchesGroup = !group || group === "all" ||
        String(contact.contact_group || "").toLowerCase() === group;
      return matchesSearch && matchesGroup;
    });

    res.json(filtered);
  } catch (error) {
    console.error("List contacts error:", error);
    res.status(500).json({ error: "Unexpected server error while loading contacts." });
  }
});

app.post("/api/contacts", async (req, res) => {
  const validation = validateContact(req.body || {});
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const { data, error } = await supabase
      .from("contacts")
      .insert(validation.value)
      .select("id, name, phone, email, contact_group, created_at")
      .single();

    if (error) {
      console.error("Supabase create error:", error.message);
      return res.status(500).json({ error: "Could not save the contact to Supabase." });
    }
    res.status(201).json(data);
  } catch (error) {
    console.error("Create contact error:", error);
    res.status(500).json({ error: "Unexpected server error while saving the contact." });
  }
});

app.get("/api/contacts/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid contact ID." });

  try {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, phone, email, contact_group, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Supabase get error:", error.message);
      return res.status(500).json({ error: "Could not retrieve this contact." });
    }
    if (!data) return res.status(404).json({ error: "Contact not found." });
    res.json(data);
  } catch (error) {
    console.error("Get contact error:", error);
    res.status(500).json({ error: "Unexpected server error while retrieving the contact." });
  }
});

app.put("/api/contacts/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid contact ID." });

  const validation = validateContact(req.body || {});
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const { data, error } = await supabase
      .from("contacts")
      .update(validation.value)
      .eq("id", id)
      .select("id, name, phone, email, contact_group, created_at")
      .maybeSingle();

    if (error) {
      console.error("Supabase update error:", error.message);
      return res.status(500).json({ error: "Could not update the contact." });
    }
    if (!data) return res.status(404).json({ error: "Contact not found." });
    res.json(data);
  } catch (error) {
    console.error("Update contact error:", error);
    res.status(500).json({ error: "Unexpected server error while updating the contact." });
  }
});

app.delete("/api/contacts/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid contact ID." });

  try {
    const { data, error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Supabase delete error:", error.message);
      return res.status(500).json({ error: "Could not delete the contact." });
    }
    if (!data) return res.status(404).json({ error: "Contact not found." });
    res.json({ message: "Contact deleted successfully." });
  } catch (error) {
    console.error("Delete contact error:", error);
    res.status(500).json({ error: "Unexpected server error while deleting the contact." });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Contact Book is running at http://localhost:${PORT}`);
});
