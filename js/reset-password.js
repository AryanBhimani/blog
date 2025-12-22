import { supabase } from "./supabase/supabaseClient.js";

const form = document.getElementById("resetForm");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

function setMessage(text, type) {
  message.textContent = text;
  message.className = "msg " + (type || "");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage("", "");

  const newPassword = passwordInput.value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

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

// Check if we have a session (user clicked the email link)
// Check on load if we have a valid session (e.g. from the magic link)
(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
        // Wait a small moment because onAuthStateChange might fire
    }
})();

supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY" || session) {
        // Valid session, user can update password
    } else if (event === "SIGNED_OUT") {
         // If still no session after a short delay, warn user
         setTimeout(async () => {
             const { data } = await supabase.auth.getSession();
             if (!data.session) {
                 setMessage("Invalid or expired reset link. Please try requesting a new one.", "error");
                 submitBtn.disabled = true;
                 submitBtn.disabled = true;
                 passwordInput.disabled = true;
                 document.getElementById("confirmPassword").disabled = true;
             }
         }, 1000);
    }
});
