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
  const icon = btn.querySelector("i");
  
  if (input.type === "password") {
    input.type = "text";
    if (icon) {
        icon.classList.remove("fi-rr-eye");
        icon.classList.add("fi-rr-eye-crossed");
    } else {
        btn.textContent = "🙈"; // Fallback
    }
  } else {
    input.type = "password";
    if (icon) {
        icon.classList.remove("fi-rr-eye-crossed");
        icon.classList.add("fi-rr-eye");
    } else {
        btn.textContent = "👁️"; // Fallback
    }
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

  // Check if user has a password provider
  // Typically Supabase stores providers in app_metadata.providers array (e.g. ['email', 'google'])
  const hasPasswordProvider = user.app_metadata?.providers?.includes('email');

  // If user has a password, we require the old one. If not (OAuth only), we skip old password.
  if (hasPasswordProvider && !currentPass) {
      return alert("Please enter your current password.");
  }

  if (!newPass || !confirmPass) {
    return alert("Please enter a new password.");
  }

  if (newPass !== confirmPass) {
    return alert("New passwords do not match.");
  }

  if (newPass.length < 6) {
    return alert("Password must be at least 6 characters long.");
  }

  // Verify old password ONLY if they have one
  if (hasPasswordProvider) {
      const isValid = await verifyPassword(user.email, currentPass);
      if (!isValid) {
        return alert("Incorrect current password.");
      }
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
// Remote Logout (Remove specific entry)
window.removeLoginEntry = async (id, btn) => {
    if (!confirm("Are you sure you want to log out this device?")) return;

    if(btn) {
        btn.innerText = "Processing...";
        btn.disabled = true;
    }

    try {
        const { error } = await supabase
            .from('user_logins')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Logout Error:", error);
            // Check for RLS policy violation
            if (error.code === "42501") {
                alert("Permission denied. Please run the SQL command to enable delete permissions.");
            } else {
                alert("Failed to remove login entry: " + error.message);
            }
        } else {
            // Refresh list
            fetchLoginActivity();
        }
    } catch (err) {
        console.error("Unexpected error:", err);
        alert("An unexpected error occurred.");
    } finally {
        if(btn && !btn.closest('div')) { // If row is gone, no need to reset
            btn.innerText = "Log Out";
            btn.disabled = false;
        }
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
        // Parse User Agent
        const ua = log.device_info || "";
        let deviceName = "Unknown Device";
        let icon = "fi-rr-globe"; 
        let browser = "Unknown Browser";

        // OS Detection
        if (/windows/i.test(ua)) { deviceName = "Windows PC"; icon="fi-rr-computer"; }
        else if (/macintosh|mac os x/i.test(ua)) { deviceName = "Mac"; icon="fi-rr-laptop"; }
        else if (/android/i.test(ua)) { deviceName = "Android Device"; icon="fi-rr-smartphone"; }
        else if (/iphone|ipad|ipod/i.test(ua)) { deviceName = "iOS Device"; icon="fi-rr-mobile-button"; }
        else if (/linux/i.test(ua)) { deviceName = "Linux System"; icon="fi-rr-terminal"; }

        // Mobile App Check (if UA contains 'wv' or is inside an app wrapper)
        if (/wv/i.test(ua) || /mobile/i.test(ua) && !/safari/i.test(ua)) {
             // Heuristic for webview/app
        }

        // Browser Detection
        if (/chrome|crios|crmo/i.test(ua)) browser = "Chrome";
        else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
        else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
        else if (/edg/i.test(ua)) browser = "Edge";
        else if (/opera|opr/i.test(ua)) browser = "Opera";
        
        // Refine Name if detailed
        if (deviceName === "Android Device" && /build\/([a-zA-Z0-9]+)/i.test(ua)) {
             const match = ua.match(/;\s([a-zA-Z0-9\s]+)\sbuild/i);
             if (match && match[1]) deviceName = match[1]; // e.g. "Pixel 6"
        }

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
                
                <button onclick="removeLoginEntry('${log.id}', this)" style="padding: 6px 12px; border: 1px solid var(--border-color); background: transparent; border-radius: 6px; cursor: pointer; color: #dc2626; font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
                    Log Out
                </button>
            </div>
        `;
    }).join("");
}

// Hook into switchTab to load data when Activity tab is shown
const originalSwitchTab = window.switchTab;
window.switchTab = async (tabId, navItem) => {
    originalSwitchTab(tabId, navItem);
    
    if (tabId === 'activity-screen') {
        fetchLoginActivity();
    }

    if (tabId === 'delete-screen') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
             const hasPassword = user.app_metadata?.providers?.includes('email');
             const passGroup = document.querySelector('#delete-screen .form-group');
             
             if (!hasPassword && passGroup) {
                 passGroup.style.display = 'none';
             } else if (passGroup) {
                 passGroup.style.display = 'block';
             }
        }
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

  const hasPassword = user.app_metadata?.providers?.includes('email');

  if (hasPassword) {
      const pass = document.getElementById("deletePass").value;
      if (!pass) {
        return alert("Please enter your password to confirm.");
      }

      const isValid = await verifyPassword(user.email, pass);
      if (!isValid) {
        return alert("Incorrect password.");
      }
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
    console.error("Delete Account Error:", dbError);
    // If it's a permission error (42501), they might not be able to self-update 'deleted'.
    // We will show the real error.
    alert("Failed to mark account as deleted: " + dbError.message);
    // return; // We stop here so they know it didn't fully work.
    
    // Fallback: If policy doesn't allow 'update', we might need to rely on an RPC or just Supabase Auth delete.
    // For now, let's at least show the error message.
    return;
  }

  await supabase.auth.signOut();

  alert("Your account has been deleted.");
  window.location.href = "auth.html";
};
