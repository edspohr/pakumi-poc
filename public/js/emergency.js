(function () {
  const loadingState = document.getElementById("loadingState");
  const notFoundState = document.getElementById("notFoundState");
  const content = document.getElementById("content");

  const petNameEl = document.getElementById("petName");
  const petMetaEl = document.getElementById("petMeta");
  const conditionBox = document.getElementById("conditionBox");
  const conditionText = document.getElementById("conditionText");
  const ownerNameEl = document.getElementById("ownerName");
  const contactBtn = document.getElementById("contactBtn");

  function getIdFromUrl() {
    return new URLSearchParams(window.location.search).get("id");
  }

  function showNotFound() {
    loadingState.classList.add("hidden");
    content.classList.add("hidden");
    notFoundState.classList.remove("hidden");
  }

  function showContent() {
    loadingState.classList.add("hidden");
    notFoundState.classList.add("hidden");
    content.classList.remove("hidden");
  }

  function toWhatsAppNumber(raw) {
    // wa.me expects digits only (country code + number, no +).
    // Stored phone is already in E.164 format like "+51987654321".
    const digits = (raw || "").replace(/\D/g, "");
    return digits || null;
  }

  function renderProfile(data) {
    const name = data.name || "Mascota";
    petNameEl.textContent = name;

    const metaParts = [];
    if (data.species) metaParts.push(data.species);
    if (data.age) metaParts.push(data.age);
    petMetaEl.textContent = metaParts.join(" · ");

    const condition = (data.condition || "").trim();
    if (condition) {
      conditionText.textContent = condition;
      conditionBox.classList.remove("hidden");
    }

    ownerNameEl.textContent = data.ownerName || "No disponible";

    const waNumber = toWhatsAppNumber(data.ownerPhone);
    if (waNumber) {
      const greeting = encodeURIComponent(
        `Hola, encontré a ${name} y estoy usando su QR de emergencia de Pakumi.`
      );
      contactBtn.href = `https://wa.me/${waNumber}?text=${greeting}`;
    } else {
      contactBtn.classList.add("opacity-60", "pointer-events-none");
      contactBtn.textContent = "Contacto no disponible";
    }

    showContent();
  }

  async function load() {
    const petId = getIdFromUrl();
    if (!petId) {
      showNotFound();
      return;
    }

    try {
      const doc = await db.collection("emergency_profiles").doc(petId).get();
      if (!doc.exists) {
        showNotFound();
        return;
      }
      renderProfile(doc.data());
    } catch (err) {
      console.error(err);
      showNotFound();
    }
  }

  load();
})();
