(function () {
  const petForm = document.getElementById("petForm");
  if (!petForm) {
    console.error("[register-pet] #petForm not found — wrong page or stale HTML.");
    return;
  }

  const REQUIRED_IDS = [
    "petError",
    "petSubmitBtn",
    "petSubmitLabel",
    "petName",
    "petSpecies",
    "petBreed",
    "petAge",
    "petWeight",
    "petCondition",
    "ownerName",
    "ownerPhoneCountry",
    "ownerPhoneLocal",
  ];

  // Startup audit — surfaces any HTML/JS id mismatch immediately.
  const missingAtLoad = REQUIRED_IDS.filter((id) => !document.getElementById(id));
  if (missingAtLoad.length) {
    console.error(
      "[register-pet] Missing elements at load:",
      missingAtLoad.join(", "),
      "— likely a stale cached index.html. Hard-reload the page."
    );
  }

  const petError = document.getElementById("petError");
  const petSubmitBtn = document.getElementById("petSubmitBtn");
  const petSubmitLabel = document.getElementById("petSubmitLabel");

  function showError(msg) {
    if (petError) {
      petError.textContent = msg;
      petError.classList.remove("hidden");
    } else {
      alert(msg);
    }
  }

  function clearError() {
    if (!petError) return;
    petError.textContent = "";
    petError.classList.add("hidden");
  }

  function buildPhone(countryCode, localRaw) {
    const localDigits = (localRaw || "").replace(/\D/g, "");
    if (!localDigits) return "";
    return `${countryCode}${localDigits}`;
  }

  function isValidInternationalPhone(phone) {
    // Starts with +, then 8–15 digits total after the +.
    return /^\+\d{8,15}$/.test(phone);
  }

  function setLoading(loading) {
    if (petSubmitBtn) petSubmitBtn.disabled = loading;
    if (petSubmitLabel) {
      petSubmitLabel.textContent = loading ? "Guardando..." : "Registrar mascota";
    }
  }

  // Reads element values at submit time so stale-cached HTML or late DOM
  // mutations can't pre-bind a null reference.
  function readFields() {
    const read = (id) => {
      const el = document.getElementById(id);
      if (!el) {
        console.error(`[register-pet] Missing #${id} at submit.`);
        return null;
      }
      return el;
    };

    const els = {
      name: read("petName"),
      species: read("petSpecies"),
      breed: read("petBreed"),
      age: read("petAge"),
      weight: read("petWeight"),
      condition: read("petCondition"),
      ownerName: read("ownerName"),
      ownerPhoneCountry: read("ownerPhoneCountry"),
      ownerPhoneLocal: read("ownerPhoneLocal"),
    };

    const missing = Object.entries(els)
      .filter(([, el]) => !el)
      .map(([k]) => k);
    if (missing.length) {
      return { error: `Falta el campo: ${missing.join(", ")}. Recarga la página.` };
    }

    return {
      values: {
        name: els.name.value.trim(),
        species: els.species.value,
        breed: els.breed.value.trim(),
        age: els.age.value.trim(),
        weight: els.weight.value.trim(),
        condition: els.condition.value.trim(),
        ownerName: els.ownerName.value.trim(),
        ownerPhone: buildPhone(
          els.ownerPhoneCountry.value,
          els.ownerPhoneLocal.value
        ),
      },
    };
  }

  petForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const user = auth.currentUser;
    if (!user) {
      showError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    const read = readFields();
    if (read.error) {
      showError(read.error);
      return;
    }
    const v = read.values;

    if (!v.name) return showError("Ingresa el nombre de tu mascota.");
    if (!v.species) return showError("Selecciona la especie.");
    if (!v.ownerName) return showError("Ingresa tu nombre.");
    if (!isValidInternationalPhone(v.ownerPhone)) {
      return showError(
        "Ingresa un número de WhatsApp válido (8–15 dígitos después del código de país)."
      );
    }

    setLoading(true);
    try {
      const petRef = db.collection("pets").doc();
      const petId = petRef.id;
      const now = firebase.firestore.FieldValue.serverTimestamp();

      const petDoc = {
        userId: user.uid,
        name: v.name,
        species: v.species,
        breed: v.breed,
        age: v.age,
        weight: v.weight,
        condition: v.condition,
        ownerName: v.ownerName,
        ownerPhone: v.ownerPhone,
        createdAt: now,
      };

      const emergencyDoc = {
        userId: user.uid,
        name: v.name,
        species: v.species,
        age: v.age,
        condition: v.condition,
        ownerPhone: v.ownerPhone,
        ownerName: v.ownerName,
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
