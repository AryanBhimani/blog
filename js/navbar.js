import { supabase } from "./supabase/supabaseClient.js";

// Load navbar HTML
fetch("/components/navbar.html")
  .then(res => res.text())
  .then(data => {
    document.body.insertAdjacentHTML("afterbegin", data);

    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");
    const authButton = document.getElementById("auth-btn");


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
        authButton.textContent = "Logout";
        authButton.classList.add("logout-button");
        authButton.onclick = async () => {
          await supabase.auth.signOut();
          window.location.href = "auth.html";
        };
      } else {
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
