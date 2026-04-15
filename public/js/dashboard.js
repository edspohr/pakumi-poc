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
  const qrContainer = document.getElementById("qrContainer");
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

  function renderQr(emergencyUrl) {
    if (typeof QRCode !== "function") {
      console.error(
        "[dashboard] QRCode constructor is not available — check the CDN script tag."
      );
      qrContainer.innerHTML =
        '<p class="text-xs text-gray-500 text-center px-4">No se pudo generar el QR. Guarda el enlace manualmente.</p>';
      return;
    }

    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: emergencyUrl,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
    });
  }

  function handleDownload(petName) {
    // Give the lib a moment to paint the <img> before we try to grab it.
    setTimeout(() => {
      const img = qrContainer.querySelector("img");
      if (!img || !img.src) {
        console.warn("[dashboard] QR image not ready yet.");
        return;
      }
      const a = document.createElement("a");
      a.href = img.src;
      a.download = `pakumi-qr-${petName.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 500);
  }

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

    // Show content FIRST so pet info + WhatsApp instructions always render,
    // even if QR generation explodes.
    showContent();

    try {
      renderQr(emergencyUrl);
    } catch (err) {
      console.error("[dashboard] QR render failed:", err);
      qrContainer.innerHTML =
        '<p class="text-xs text-gray-500 text-center px-4">No se pudo generar el QR. Intenta recargar la página.</p>';
    }

    downloadQrBtn.addEventListener("click", () => handleDownload(name));
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log("[dashboard] no auth user, redirecting to index");
      window.location.href = "index.html";
      return;
    }

    const petId = getPetIdFromUrl();
    console.log("[dashboard] petId from URL:", petId, "uid:", user.uid);

    if (!petId) {
      showError("No se especificó una mascota. Vuelve al inicio para registrar una.");
      return;
    }

    try {
      const ref = db.collection("pets").doc(petId);
      const doc = await ref.get();
      console.log("[dashboard] fetch result:", {
        exists: doc.exists,
        id: doc.id,
        data: doc.exists ? doc.data() : null,
      });

      if (!doc.exists) {
        showError("No encontramos esta mascota en tu cuenta.");
        return;
      }
      const pet = doc.data();
      if (pet.userId !== user.uid) {
        console.warn("[dashboard] userId mismatch", {
          docUserId: pet.userId,
          authUid: user.uid,
        });
        showError("No tienes permiso para ver esta mascota.");
        return;
      }
      renderPet(petId, pet);
    } catch (err) {
      console.error("[dashboard] fetch error:", err.code, err.message, err);
      showError(
        "No se pudo cargar la información. Revisa la consola del navegador para más detalle."
      );
    }
  });
})();
