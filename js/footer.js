// js/footer.js
import { supabase } from "./supabase/supabaseClient.js";

fetch("./components/footer.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("footer-placeholder").innerHTML = data;
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }

    // Update footer based on authentication state
    updateFooter();

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(() => {
      updateFooter();
    });
  });

async function updateFooter() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  // Get the "My Profile" link from footer
  const profileLinkItem = document.getElementById('footer-profile-link');
  
  if (profileLinkItem) {
    if (user) {
      // User is logged in: Show "My Profile" link
      profileLinkItem.style.display = "block";
    } else {
      // User is not logged in: Hide "My Profile" link
      profileLinkItem.style.display = "none";
    }
  }
}
