(function () {
  const petForm = document.getElementById("petForm");
  const petError = document.getElementById("petError");
  const petSubmitBtn = document.getElementById("petSubmitBtn");
  const petSubmitLabel = document.getElementById("petSubmitLabel");

  const fields = {
    name: document.getElementById("petName"),
    species: document.getElementById("petSpecies"),
    breed: document.getElementById("petBreed"),
    age: document.getElementById("petAge"),
    weight: document.getElementById("petWeight"),
    condition: document.getElementById("petCondition"),
    ownerName: document.getElementById("ownerName"),
    ownerPhone: document.getElementById("ownerPhone"),
  };

  function showError(msg) {
    petError.textContent = msg;
    petError.classList.remove("hidden");
  }

  function clearError() {
    petError.textContent = "";
    petError.classList.add("hidden");
  }

  function normalizePhone(raw) {
    const digits = (raw || "").replace(/\s+/g, "");
    return digits;
  }

  function isValidChileanMobile(phone) {
    // +569 followed by 8 digits
    return /^\+569\d{8}$/.test(phone);
  }

  function setLoading(loading) {
    petSubmitBtn.disabled = loading;
    petSubmitLabel.textContent = loading
      ? "Guardando..."
      : "Registrar mascota";
  }

  petForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const user = auth.currentUser;
    if (!user) {
      showError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    const name = fields.name.value.trim();
    const species = fields.species.value;
    const breed = fields.breed.value.trim();
    const age = fields.age.value.trim();
    const weight = fields.weight.value.trim();
    const condition = fields.condition.value.trim();
    const ownerName = fields.ownerName.value.trim();
    const ownerPhone = normalizePhone(fields.ownerPhone.value);

    if (!name) return showError("Ingresa el nombre de tu mascota.");
    if (!species) return showError("Selecciona la especie.");
    if (!ownerName) return showError("Ingresa tu nombre.");
    if (!isValidChileanMobile(ownerPhone)) {
      return showError(
        "Ingresa un WhatsApp válido en formato +569 seguido de 8 dígitos."
      );
    }

    setLoading(true);
    try {
      const petRef = db.collection("pets").doc();
      const petId = petRef.id;
      const now = firebase.firestore.FieldValue.serverTimestamp();

      const petDoc = {
        userId: user.uid,
        name,
        species,
        breed,
        age,
        weight,
        condition,
        ownerName,
        ownerPhone,
        createdAt: now,
      };

      const emergencyDoc = {
        userId: user.uid,
        name,
        species,
        age,
        condition,
        ownerPhone,
        ownerName,
      };

      const batch = db.batch();
      batch.set(petRef, petDoc);
      batch.set(db.collection("emergency_profiles").doc(petId), emergencyDoc);
      await batch.commit();

      window.location.href = `dashboard.html?petId=${encodeURIComponent(petId)}`;
    } catch (err) {
      console.error(err);
      showError(
        "No se pudo guardar la mascota. Revisa tu conexión e intenta de nuevo."
      );
      setLoading(false);
    }
  });
})();
