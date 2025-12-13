// ===============================
// search.js (Supabase – FIXED + LOADING)
// ===============================

import { supabase } from "./supabase/supabaseClient.js";

// -------------------------------
// DOM ELEMENTS
// -------------------------------
const queryInput = document.getElementById("query");
const resultsEl = document.getElementById("results");
const clearBtn = document.getElementById("clearBtn");
const searchBtn = document.getElementById("searchBtn");
const filterBtns = document.querySelectorAll(".filter-btn");
const loadingEl = document.getElementById("firebaseStatus");

// -------------------------------
// STATE
// -------------------------------
let postsIndex = [];
let usersIndex = [];
let lastQuery = "";
let currentFilter = "all";
let dataLoaded = false;

// -------------------------------
// INIT
// -------------------------------
init();

async function init() {
  showLoading();
  await loadData();
  hideLoading();
  bindEvents();
}

// -------------------------------
// LOAD DATA FROM SUPABASE
// -------------------------------
async function loadData() {
  try {
    const [{ data: posts }, { data: users }] = await Promise.all([
      supabase.from("posts").select("*"),
      supabase.from("users").select("*"),
    ]);

    // POSTS INDEX
    postsIndex = (posts || []).map((p) => ({
      type: "post",
      id: p.id,
      title: p.title || "",
      content: p.content || "",
      excerpt: (p.content || "").substring(0, 180),
      url: `post.html?postId=${p.id}`,
      createdAt: p.created_at,
    }));

    // USERS INDEX (followers & following preserved)
    usersIndex = await Promise.all(
      (users || []).map(async (u) => {
        const [{ count: followers }, { count: following }] = await Promise.all([
          supabase
            .from("followers")
            .select("*", { count: "exact", head: true })
            .eq("following", u.id),
          supabase
            .from("followers")
            .select("*", { count: "exact", head: true })
            .eq("follower", u.id),
        ]);

        return {
          type: "user",
          id: u.id,
          name: u.name || "",
          email: u.email || "",
          avatar: u.avatar_url || "",
          followersCount: followers || 0,
          followingCount: following || 0,
          profileUrl: `profile.html?userId=${u.id}`,
        };
      })
    );

    dataLoaded = true;
  } catch (err) {
    console.error("Search init error:", err);
  }
}

// -------------------------------
// SEARCH LOGIC
// -------------------------------
function search(query) {
  if (!query || !dataLoaded) return { posts: [], users: [] };

  const terms = query.toLowerCase().split(/\s+/);

  const posts = postsIndex.filter((p) =>
    terms.some(
      (t) =>
        p.title.toLowerCase().includes(t) ||
        p.content.toLowerCase().includes(t)
    )
  );

  const users = usersIndex.filter((u) =>
    terms.some(
      (t) =>
        u.name.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t)
    )
  );

  return { posts, users };
}

// -------------------------------
// RENDER RESULTS
// -------------------------------
function renderResults({ posts, users }, query) {
  hideLoading();
  resultsEl.innerHTML = "";

  if (!query) {
    resultsEl.innerHTML = `<p class="no-results">Enter a search term</p>`;
    return;
  }

  let items = [];

  if (currentFilter === "all") {
    items = [...users, ...posts];
  } else if (currentFilter === "users") {
    items = users;
  } else if (currentFilter === "posts") {
    items = posts;
  }

  if (!items.length) {
    resultsEl.innerHTML = `<p class="no-results">No results found</p>`;
    return;
  }

  items.forEach((item) => {
    if (item.type === "user") {
      resultsEl.insertAdjacentHTML(
        "beforeend",
        `
        <div class="result-card user-card" onclick="window.location.href='${item.profileUrl}'">
          <img src="${item.avatar || "./assets/images/default-avatar.png"}" />
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${item.followersCount} followers · ${item.followingCount} following</small>
          </div>
        </div>
        `
      );
    } else {
      resultsEl.insertAdjacentHTML(
        "beforeend",
        `
        <div class="result-card post-card">
          <h3><a href="${item.url}">${escapeHtml(item.title)}</a></h3>
         <p class="post-excerpt">${item.excerpt}...</p>

        </div>
        `
      );
    }
  });
}

// -------------------------------
// EVENTS
// -------------------------------
function bindEvents() {
  queryInput.addEventListener(
    "input",
    debounce((e) => {
      lastQuery = e.target.value.trim();
      showLoading();
      renderResults(search(lastQuery), lastQuery);
    }, 300)
  );

  clearBtn.onclick = () => {
    queryInput.value = "";
    resultsEl.innerHTML = "";
    hideLoading();
  };

  searchBtn.onclick = () => {
    lastQuery = queryInput.value.trim();
    showLoading();
    renderResults(search(lastQuery), lastQuery);
  };

  filterBtns.forEach((btn) => {
    btn.onclick = () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      showLoading();
      renderResults(search(lastQuery), lastQuery);
    };
  });
}

// -------------------------------
// LOADING HELPERS
// -------------------------------
function showLoading() {
  if (loadingEl) loadingEl.style.display = "block";
}

function hideLoading() {
  if (loadingEl) loadingEl.style.display = "none";
}

// -------------------------------
// UTILITIES
// -------------------------------
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
