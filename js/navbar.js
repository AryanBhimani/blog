import { supabase } from "./supabase/supabaseClient.js";

// Load navbar HTML
fetch("./components/navbar.html")
  .then(res => res.text())
  .then(data => {
    document.body.insertAdjacentHTML("afterbegin", data);

    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");
    const authButton = document.getElementById("auth-btn");
    const fabButton = document.getElementById("fab-add-post");

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
    // FAB BUTTON (ADD POST)
    // --------------------------------------------
    let currentUser = null;

    supabase.auth.getUser().then(({ data }) => {
      currentUser = data?.user || null;
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
    });

    if (fabButton) {
      fabButton.style.display = "flex";

      fabButton.onclick = () => {
        if (!currentUser) {
          alert("⚠️ Please login first to post a blog!");
          return;
        }
        window.location.href = "../post.html";
      };
    }
  })
  .catch(err => console.error("Navbar load error:", err));
