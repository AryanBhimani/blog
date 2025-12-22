import { supabase } from "./supabase/supabaseClient.js";

/* -------------------------------------------------------------------------- */
/*                               UI LOGIC                                     */
/* -------------------------------------------------------------------------- */

// Global function to switch tabs
window.switchTab = (tabId, navItem) => {
  // 1. Sidebar Active State
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  
  if (navItem) {
    navItem.classList.add('active');
  }

  // 2. Show Content
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach(p => p.classList.remove('active'));
  
  const target = document.getElementById(tabId);
  if (target) {
    target.classList.add('active');
  }

  // 3. Mobile Handling
  const contentArea = document.querySelector('.settings-content');
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    contentArea.classList.add('mobile-visible');
    // Prevent body scroll? Optional.
  }
};

window.closeMobileTab = () => {
  const contentArea = document.querySelector('.settings-content');
  contentArea.classList.remove('mobile-visible');
};

// Toggle Password Visibility
window.togglePassword = (inputId, btn) => {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈"; 
  } else {
    input.type = "password";
    btn.textContent = "👁️";
  }
};

// Toggle FAQ (Simple Accordion)
window.toggleFaq = (header) => {
  const p = header.nextElementSibling;
  const isVisible = p.style.display === "block";
  
  // Close others if needed (optional)
  // document.querySelectorAll('.faq-simple-item p').forEach(el => el.style.display = 'none');

  p.style.display = isVisible ? "none" : "block";
};

// Search Help
const helpSearch = document.getElementById('helpSearchSettings');
if (helpSearch) {
  helpSearch.addEventListener('input', (e) => {
     const term = e.target.value.toLowerCase();
     const items = document.querySelectorAll('.faq-simple-item');
     
     items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(term) ? "block" : "none";
     });
  });
}


/* -------------------------------------------------------------------------- */
/*                            AUTH LOGIC                                      */
/* -------------------------------------------------------------------------- */

// Verify password helper
async function verifyPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // If no error, password is correct
  return !error;
}

// Change Password
window.changePassword = async () => {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    alert("Please login again.");
    window.location.href = "auth.html";
    return;
  }

  const currentPass = document.getElementById("currentPass").value;
  const newPass = document.getElementById("newPass").value;
  const confirmPass = document.getElementById("confirmPass").value;

  if (!currentPass || !newPass || !confirmPass) {
    return alert("All fields are required.");
  }

  if (newPass !== confirmPass) {
    return alert("New passwords do not match.");
  }

  if (newPass.length < 6) {
    return alert("Password must be at least 6 characters long.");
  }

  // Verify old password
  const isValid = await verifyPassword(user.email, currentPass);
  if (!isValid) {
    return alert("Incorrect current password.");
  }

  // Update
  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) {
    return alert(error.message);
  }

  alert("Password updated successfully!");
  
  // Clear fields
  document.getElementById("currentPass").value = "";
  document.getElementById("newPass").value = "";
  document.getElementById("confirmPass").value = "";
  
  if (window.innerWidth <= 768) {
    closeMobileTab();
  }
};

// Delete Account
window.deleteAccount = async () => {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    alert("Please login again.");
    window.location.href = "auth.html";
    return;
  }

  const pass = document.getElementById("deletePass").value;
  if (!pass) {
    return alert("Please enter your password to confirm.");
  }

  const isValid = await verifyPassword(user.email, pass);
  if (!isValid) {
    return alert("Incorrect password.");
  }

  if (!confirm("Are you absolutely sure? This cannot be undone.")) {
    return;
  }

  // Mark deleted in DB
  const { error: dbError } = await supabase
    .from("users")
    .update({ deleted: true })
    .eq("id", user.id);

  if (dbError) {
    console.error(dbError);
    return alert("Error deleting account data.");
  }

  await supabase.auth.signOut();

  alert("Your account has been deleted.");
  window.location.href = "auth.html";
};
