import { supabase } from "./supabase/supabaseClient.js";

// Load navbar HTML
fetch("./components/navbar.html")
  .then(res => res.text())
  .then(data => {
    const navbarPlaceholder = document.getElementById("navbar-placeholder");
    if (navbarPlaceholder) {
      navbarPlaceholder.innerHTML = data;
    } else {
      console.warn("Navbar placeholder not found, prepending to body as fallback");
      document.body.insertAdjacentHTML("afterbegin", data);
    }

    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");
    const authButton = document.getElementById("auth-btn");
    const profileLink = document.getElementById("nav-profile-link");
    const messagesLink = document.getElementById("nav-messages-link");
    const notificationsLink = document.getElementById("nav-notifications-link");


    // --------------------------------------------
    // MOBILE MENU TOGGLE
    // --------------------------------------------
    if (menuToggle && navLinks) {
      menuToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        navLinks.classList.toggle("show");
      });

      document.addEventListener("click", (event) => {
        if (
          navLinks.classList.contains("show") &&
          !navLinks.contains(event.target) &&
          !menuToggle.contains(event.target)
        ) {
          navLinks.classList.remove("show");
        }
      });
    }

    // --------------------------------------------
    // AUTH BUTTON (LOGIN / LOGOUT)
    // --------------------------------------------
    updateNavbar();

    supabase.auth.onAuthStateChange(() => {
      updateNavbar();
    });

    async function updateNavbar() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!authButton) return;

      if (user) {
        // --- CHECK DELETED STATUS ---
        // We do a stealth check to see if the user has been marked as deleted
        // Note: For performance, you might want to cache this or depend on real-time.
        const { data: dbUser } = await supabase
          .from("users")
          .select("deleted")
          .eq("id", user.id)
          .single();

        if (dbUser && dbUser.deleted) {
             await supabase.auth.signOut();
             alert("Your account has been deleted.");
             window.location.href = "auth.html";
             return;
        }

        // User logged in: Show Profile & Notifications link
        if (profileLink) profileLink.style.display = "";
        if (messagesLink) messagesLink.style.display = "";
        if (notificationsLink) notificationsLink.style.display = "";
        
        authButton.textContent = "Logout";
        authButton.classList.add("logout-button");
        authButton.onclick = async () => {
          await supabase.auth.signOut();
          window.location.href = "auth.html";
        };
      } else {
        // User logged out: Hide Profile & Notifications link
        if (profileLink) profileLink.style.display = "none";
        if (messagesLink) messagesLink.style.display = "none";
        if (notificationsLink) notificationsLink.style.display = "none";

        authButton.textContent = "Login";
        authButton.classList.remove("logout-button");
        authButton.onclick = () => {
          window.location.href = "auth.html";
        };
      }
    }

    // --------------------------------------------
    // DARK MODE TOGGLE
    // --------------------------------------------
    const themeBtn = document.getElementById("theme-toggle");
    
    // Check saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      updateThemeIcon(true);
    }

    if (themeBtn) {
      themeBtn.onclick = () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const newTheme = isDark ? "light" : "dark";
        
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        updateThemeIcon(!isDark);
      };
    }

    function updateThemeIcon(isDark) {
      if (!themeBtn) return;
      const icon = themeBtn.querySelector("i");
      if (isDark) {
        icon.className = "fi fi-rr-sun";
      } else {
        icon.className = "fi fi-rr-moon";
      }
    }


  })
  .catch(err => console.error("Navbar load error:", err));
