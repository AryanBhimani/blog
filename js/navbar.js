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
        window.location.href = "post.html";
      };
    }

    // ================================
    // 🔔 NOTIFICATION SYSTEM (STORED)
    // ================================
    const bell = document.getElementById("notification-bell");
    const notifDot = document.getElementById("notif-dot");
    const notifPanel = document.getElementById("notification-panel");
    const notifList = document.getElementById("notification-list");

    let userId = null;

    supabase.auth.getUser().then(({ data }) => {
      userId = data?.user?.id || null;
      if (userId) loadStoredNotifications();
    });

    // Toggle panel
    if (bell) {
      bell.onclick = async () => {
        const open = notifPanel.style.display === "block";
        notifPanel.style.display = open ? "none" : "block";
        if (!open) notifDot.style.display = "none";
      };
    }

    // Render notification
    function renderNotification(message) {
      notifList.insertAdjacentHTML(
        "afterbegin",
        `<li>${message}</li>`
      );
    }

    // Store + show notification
    async function pushNotification(message) {
      if (!userId) return;

      notifDot.style.display = "block";
      renderNotification(message);

      await supabase.from("notifications").insert({
        user_id: userId,
        message
      });
    }

    // Load past notifications
    async function loadStoredNotifications() {
      const { data } = await supabase
        .from("notifications")
        .select("message")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!data || !data.length) return;

      notifDot.style.display = "block";
      notifList.innerHTML = "";

      data.forEach(n => renderNotification(n.message));
    }

    // --------------------------------------------
    // LIVE: Someone followed you
    // --------------------------------------------
    supabase
      .channel("followers-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", table: "followers", schema: "public" },
        (payload) => {
          if (payload.new.following === userId) {
            pushNotification("🔔 Someone started following you!");
          }
        }
      )
      .subscribe();

    // --------------------------------------------
    // LIVE: Someone you follow posted
    // --------------------------------------------
    async function followPostListener() {
      if (!userId) return;

      const { data: following } = await supabase
        .from("followers")
        .select("following")
        .eq("follower", userId);

      const followingIds = following?.map(f => f.following) || [];

      supabase
        .channel("posts-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", table: "posts", schema: "public" },
          (payload) => {
            if (followingIds.includes(payload.new.user_id)) {
              pushNotification("📝 Someone you follow posted a new blog!");
            }
          }
        )
        .subscribe();
    }

    followPostListener();
  })
  .catch(err => console.error("Navbar load error:", err));
