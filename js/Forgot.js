import { supabase } from "./supabase/supabaseClient.js";

// Forgot password logic (client-side)
const form = document.getElementById("forgotForm");
const emailInput = document.getElementById("email");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

function setMessage(text, type) {
  message.textContent = text;
  message.className = "msg " + (type || "");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage("", "");

  const email = emailInput.value.trim();
  // basic client-side check
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    setMessage("Please enter your email", "error");
    emailInput.focus();
    return;
  }
  if (!re.test(email)) {
    setMessage("Please enter a valid email", "error");
    emailInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    if (error) {
      throw error;
    }

    setMessage(
      "If an account exists for that email, reset instructions were sent. Check your inbox!",
      "success"
    );
    form.reset();
  } catch (err) {
    console.error(err);
    setMessage(err.message || "Unable to send request. Please try again later.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Reset Link";
  }
});
