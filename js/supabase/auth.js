import { supabase } from "./supabaseClient.js";

// ========================================
// SIGNUP
// ========================================
export async function signup(name, email, password) {
  // 1. Validate
  if (!name || !email || !password) {
    alert("Please fill all fields ❗");
    return false; // Return false so the button knows it failed
  }

  // 2. Create User
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name } // The SQL Trigger will grab this name
    }
  });

  if (error) {
    alert("Signup failed ❌: " + error.message);
    return false;
  }

  // 3. Handle Email Confirmation Check
  if (data.session) {
    // Session exists = Email confirmation is OFF (You are logged in)
    alert("Signup successful! 🎉");
    window.location.href = "index.html";
  } else {
    // No session = Email confirmation is ON (Check email)
    alert("Signup successful! Please check your email to verify 📩");
  }
  
  return true;
}

// ========================================
// LOGIN
// ========================================
export async function login(email, password) {
  if (!email || !password) {
    alert("Please enter email and password ❗");
    return false;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("Login failed ❌: " + error.message);
    return false;
  }

  alert("Welcome back! 🎉");
  window.location.href = "index.html";
  return true;
}

// ========================================
// GOOGLE LOGIN
// ========================================
export async function loginWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    redirectTo: window.location.origin + "/index.html"
  });
}