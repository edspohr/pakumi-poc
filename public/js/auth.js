(function () {
  const authSection = document.getElementById("authSection");
  const petSection = document.getElementById("petSection");
  const signOutBtn = document.getElementById("signOutBtn");

  const googleBtn = document.getElementById("googleBtn");
  const emailForm = document.getElementById("emailForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailSubmitBtn = document.getElementById("emailSubmitBtn");
  const emailSubmitLabel = document.getElementById("emailSubmitLabel");
  const toggleModeBtn = document.getElementById("toggleModeBtn");
  const modeHint = document.getElementById("modeHint");
  const authError = document.getElementById("authError");

  const ownerNameInput = document.getElementById("ownerName");

  // "register" or "login"
  let mode = "register";

  const AUTH_ERRORS_ES = {
    "auth/email-already-in-use": "Este correo ya está registrado.",
    "auth/invalid-email": "Correo electrónico inválido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No existe una cuenta con este correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Credenciales inválidas.",
    "auth/too-many-requests": "Demasiados intentos. Intenta más tarde.",
    "auth/popup-closed-by-user": "Ventana cerrada. Intenta de nuevo.",
    "auth/popup-blocked": "El navegador bloqueó la ventana emergente.",
    "auth/network-request-failed": "Error de red. Revisa tu conexión.",
  };

  function showAuthError(err) {
    const msg =
      AUTH_ERRORS_ES[err && err.code] || "Algo salió mal. Intenta de nuevo.";
    authError.textContent = msg;
    authError.classList.remove("hidden");
  }

  function clearAuthError() {
    authError.textContent = "";
    authError.classList.add("hidden");
  }

  function setLoading(button, loadingText) {
    if (!button.dataset.originalLabel) {
      const label = button.querySelector("span");
      if (label) button.dataset.originalLabel = label.textContent;
    }
    button.disabled = true;
    const label = button.querySelector("span");
    if (label) label.textContent = loadingText;
  }

  function clearLoading(button) {
    button.disabled = false;
    const label = button.querySelector("span");
    if (label && button.dataset.originalLabel) {
      label.textContent = button.dataset.originalLabel;
    }
  }

  function applyMode() {
    if (mode === "register") {
      emailSubmitLabel.textContent = "Crear cuenta";
      modeHint.textContent = "¿Ya tienes cuenta?";
      toggleModeBtn.textContent = "Iniciar sesión";
      passwordInput.autocomplete = "new-password";
    } else {
      emailSubmitLabel.textContent = "Iniciar sesión";
      modeHint.textContent = "¿No tienes cuenta?";
      toggleModeBtn.textContent = "Crear cuenta";
      passwordInput.autocomplete = "current-password";
    }
    emailSubmitBtn.dataset.originalLabel = emailSubmitLabel.textContent;
  }

  toggleModeBtn.addEventListener("click", () => {
    mode = mode === "register" ? "login" : "register";
    clearAuthError();
    applyMode();
  });

  googleBtn.addEventListener("click", async () => {
    clearAuthError();
    setLoading(googleBtn, "Conectando...");
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (err) {
      showAuthError(err);
    } finally {
      clearLoading(googleBtn);
    }
  });

  emailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAuthError({ code: "auth/invalid-email" });
      return;
    }
    if (password.length < 6) {
      showAuthError({ code: "auth/weak-password" });
      return;
    }

    setLoading(
      emailSubmitBtn,
      mode === "register" ? "Creando cuenta..." : "Ingresando..."
    );
    try {
      if (mode === "register") {
        await auth.createUserWithEmailAndPassword(email, password);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
    } catch (err) {
      showAuthError(err);
    } finally {
      clearLoading(emailSubmitBtn);
    }
  });

  signOutBtn.addEventListener("click", async () => {
    await auth.signOut();
  });

  auth.onAuthStateChanged((user) => {
    if (user) {
      authSection.classList.add("hidden");
      petSection.classList.remove("hidden");
      signOutBtn.classList.remove("hidden");
      if (ownerNameInput && !ownerNameInput.value) {
        ownerNameInput.value = user.displayName || "";
      }
    } else {
      authSection.classList.remove("hidden");
      petSection.classList.add("hidden");
      signOutBtn.classList.add("hidden");
    }
  });

  applyMode();
})();
