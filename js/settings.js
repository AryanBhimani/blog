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

// Remote Logout (Remove specific entry)
window.removeLoginEntry = async (id) => {
    if (!confirm("Remove this login session?")) return;

    const { error } = await supabase
        .from('user_logins')
        .delete()
        .eq('id', id);

    if (error) {
        console.error(error);
        alert("Failed to remove login entry.");
    } else {
        // Refresh list
        fetchLoginActivity();
    }
};

// Fetch Login Activity
async function fetchLoginActivity() {
    const list = document.getElementById('activity-list');
    list.innerHTML = `<div class="loading">Loading...</div>`;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('user_logins')
        .select('*')
        .eq('user_id', user.id)
        .order('last_login', { ascending: false });

    if (error) {
        // Graceful fallback
        console.warn('Activity log error:', error);
        list.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); background: var(--bg-body); border-radius: 8px;">
                <p>No activity history available yet.</p>
                <small>(The tracking database might not be configured)</small>
            </div>
        `;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = `<p style="color: var(--text-muted);">No recorded logins found.</p>`;
        return;
    }

    list.innerHTML = data.map(log => {
        // Parse simple UA
        let deviceName = "Unknown Device";
        let icon = "fi-rr-globe"; // Default web

        if (log.device_info.includes('Windows')) { deviceName = "Windows PC"; icon="fi-rr-computer"; }
        else if (log.device_info.includes('Macintosh')) { deviceName = "Mac"; icon="fi-rr-laptop"; }
        else if (log.device_info.includes('Linux')) { deviceName = "Linux System"; icon="fi-rr-terminal"; }
        else if (log.device_info.includes('Android')) { deviceName = "Android Device"; icon="fi-rr-smartphone"; }
        else if (log.device_info.includes('iPhone')) { deviceName = "iPhone"; icon="fi-rr-mobile-button"; }

        // Browser check
        let browser = "Browser";
        if (log.device_info.includes('Chrome')) browser = "Chrome";
        else if (log.device_info.includes('Firefox')) browser = "Firefox";
        else if (log.device_info.includes('Safari')) browser = "Safari";
        else if (log.device_info.includes('Edge')) browser = "Edge";

        const date = new Date(log.last_login).toLocaleString();

        return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 40px; height: 40px; background: var(--bg-body); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: var(--text-main);">
                        <i class="fi ${icon}"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600;">${deviceName} • ${browser}</h4>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${date}</span>
                    </div>
                </div>
                
                <button onclick="removeLoginEntry('${log.id}')" style="padding: 6px 12px; border: 1px solid var(--border-color); background: transparent; border-radius: 6px; cursor: pointer; color: #dc2626; font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
                    Log Out
                </button>
            </div>
        `;
    }).join("");
}

// Hook into switchTab to load data when Activity tab is shown
const originalSwitchTab = window.switchTab;
window.switchTab = (tabId, navItem) => {
    originalSwitchTab(tabId, navItem);
    if (tabId === 'activity-screen') {
        fetchLoginActivity();
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
