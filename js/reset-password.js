import { supabase } from "./supabase/supabaseClient.js";

const form = document.getElementById("resetForm");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

function setMessage(text, type) {
  message.textContent = text;
  message.className = "msg " + (type || "");
}

// Check for error in URL hash immediately
const hash = window.location.hash;
const params = new URLSearchParams(hash.substring(1)); // strip #
const errorDescription = params.get("error_description");
const errorCode = params.get("error_code");

if (errorCode) {
    setMessage(
      (errorDescription || "Invalid link").replace(/\+/g, " "), 
      "error"
    );
    disableForm();
}

function disableForm() {
    submitBtn.disabled = true;
    passwordInput.disabled = true;
    confirmPasswordInput.disabled = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage("", "");

  const newPassword = passwordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();

  if (!newPassword || newPassword.length < 6) {
    setMessage("Password must be at least 6 characters", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    setMessage("Passwords do not match", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Updating...";

  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    setMessage("Password updated successfully! Redirecting to login...", "success");
    
    setTimeout(() => {
        window.location.href = "auth.html";
    }, 2000);

  } catch (err) {
    console.error(err);
    setMessage(err.message || "Failed to update password", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Update Password";
  }
});

// Handle auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        // Valid session, user can update password
        if (message.textContent.includes("Invalid")) {
             setMessage("", ""); // clear invalid error if we suddenly recovered
             submitBtn.disabled = false;
             passwordInput.disabled = false;
             confirmPasswordInput.disabled = false;
        }
    } else if (event === "SIGNED_OUT") {
         // Check if we really have no session
         const { data } = await supabase.auth.getSession();
         if (!data.session) {
             // If we also don't have a hash that LOOKS like a recovery token, show error.
             // If we DO have a hash, Supabase might just be processing it.
             // But if Supabase finished processing and results in SIGNED_OUT, it failed.
             
             // Wait briefly to ensure processing isn't mid-flight
             setTimeout(async () => {
                 const { data: checkData } = await supabase.auth.getSession();
                 if (!checkData.session) {
                     setMessage("Invalid or expired reset link. Please try requesting a new one.", "error");
                     disableForm();
                 }
             }, 1500);
         }
    }
});
