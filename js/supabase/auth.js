import { supabase } from "./supabaseClient.js";

// ========================================
// SIGNUP
// ========================================
export async function signup(name, email, password) {
  // 1. Validate
  if (!name || !email || !password) {
    alert("Please fill all fields ❗");
    return false;
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
  // If email confirmation is enabled, data.session will be null for new users
  if (data.session) {
    alert("Signup successful! 🎉");
    window.location.href = "index.html";
  } else if (data.user && !data.session) {
    alert("Signup successful! Please check your email to verify 📩");
    // Optionally redirect to login tab
    document.getElementById('login-tab').click();
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

  // Check Deleted Status
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("deleted")
        .eq("id", user.id)
        .single();
      
      if (dbUser && dbUser.deleted) {
          await supabase.auth.signOut();
          alert("Account not found or deleted ❌");
          return false;
      }
  }

  alert("Welcome back! 🎉");

  // Track Login Device
  try {
    const ua = navigator.userAgent;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await supabase.from('user_logins').insert({
            user_id: user.id,
            device_info: ua,
            last_login: new Date().toISOString()
        });
    }
  } catch (err) {
    console.warn("Could not log device activity", err);
  }

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