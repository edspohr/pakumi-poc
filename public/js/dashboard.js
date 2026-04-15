(function () {
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const content = document.getElementById("content");

  const successHeadline = document.getElementById("successHeadline");
  const petNameEl = document.getElementById("petName");
  const petSpeciesEl = document.getElementById("petSpecies");
  const petAgeEl = document.getElementById("petAge");
  const petConditionEl = document.getElementById("petCondition");
  const waPetName1 = document.getElementById("waPetName1");
  const waPetName2 = document.getElementById("waPetName2");
  const qrPetName = document.getElementById("qrPetName");
  const qrCanvas = document.getElementById("qrCanvas");
  const qrUrl = document.getElementById("qrUrl");
  const downloadQrBtn = document.getElementById("downloadQrBtn");

  const signOutBtn = document.getElementById("signOutBtn");
  const footerSignOutBtn = document.getElementById("footerSignOutBtn");

  function getPetIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("petId");
  }

  function showError(msg) {
    loadingState.classList.add("hidden");
    content.classList.add("hidden");
    errorMessage.textContent = msg;
    errorState.classList.remove("hidden");
  }

  function showContent() {
    loadingState.classList.add("hidden");
    errorState.classList.add("hidden");
    content.classList.remove("hidden");
  }

  async function signOutAndRedirect() {
    await auth.signOut();
    window.location.href = "index.html";
  }

  signOutBtn.addEventListener("click", signOutAndRedirect);
  footerSignOutBtn.addEventListener("click", signOutAndRedirect);

  function renderPet(petId, pet) {
    const name = pet.name || "Tu mascota";

    successHeadline.textContent = `✅ ¡${name} fue registrado exitosamente!`;
    petNameEl.textContent = name;
    petSpeciesEl.textContent = pet.species || "—";
    petAgeEl.textContent = pet.age || "—";
    petConditionEl.textContent = pet.condition || "Sin condiciones registradas";

    waPetName1.textContent = name;
    waPetName2.textContent = name;
    qrPetName.textContent = name;

    const emergencyUrl = `https://pakumi-poc.web.app/emergency.html?id=${encodeURIComponent(petId)}`;
    qrUrl.textContent = emergencyUrl;

    QRCode.toCanvas(
      qrCanvas,
      emergencyUrl,
      {
        width: 250,
        margin: 2,
        color: { dark: "#111827", light: "#ffffff" },
      },
      (err) => {
        if (err) console.error("QR error", err);
      }
    );

    downloadQrBtn.addEventListener("click", () => {
      const dataUrl = qrCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `pakumi-qr-${name.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    showContent();
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const petId = getPetIdFromUrl();
    if (!petId) {
      showError("No se especificó una mascota. Vuelve al inicio para registrar una.");
      return;
    }

    try {
      const doc = await db.collection("pets").doc(petId).get();
      if (!doc.exists) {
        showError("No encontramos esta mascota en tu cuenta.");
        return;
      }
      const pet = doc.data();
      if (pet.userId !== user.uid) {
        showError("No tienes permiso para ver esta mascota.");
        return;
      }
      renderPet(petId, pet);
    } catch (err) {
      console.error(err);
      showError("No se pudo cargar la información. Revisa tu conexión.");
    }
  });
})();
