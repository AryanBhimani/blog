// ===============================
// search.js (Supabase – FIXED + LOADING)
// ===============================

import { supabase } from "./supabase/supabaseClient.js";

// -------------------------------
// DOM ELEMENTS
// -------------------------------
const queryInput = document.getElementById("query");
const resultsEl = document.getElementById("results");

const filterBtns = document.querySelectorAll(".filter-btn");
const loadingEl = document.getElementById("search-loading");

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
      image: p.image_url,
      content: p.content || "",
      tags: parseTags(p.tags),
      excerpt: (p.content || "").substring(0, 180),
      url: `comment.html?postId=${p.id}`,
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
          avatar: u.avatar_url,
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
        p.content.toLowerCase().includes(t) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(t)))
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
// -------------------------------
// RENDER RESULTS
// -------------------------------
function renderResults({ posts, users }, query) {
  hideLoading();
  resultsEl.innerHTML = "";

  if (!query) {
    resultsEl.innerHTML = `
      <div class="no-results">
        <i class="fi fi-rr-search"></i>
        <h3>Start Searching</h3>
        <p>Enter a keyword to discover amazing posts and people.</p>
      </div>`;
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
    resultsEl.innerHTML = `
      <div class="no-results">
        <i class="fi fi-rr-sad"></i>
        <h3>No results found</h3>
        <p>We couldn't find anything matching "${escapeHtml(query)}". Try different keywords.</p>
      </div>`;
    return;
  }

  items.forEach((item) => {
    if (item.type === "user") {
      // USER CARD
      const avatar = item.avatar;
      const userCard = document.createElement("div");
      userCard.className = "result-card user-card";
      userCard.onclick = () => window.location.href = item.profileUrl;
      
      userCard.innerHTML = `
        <div class="user-card-inner">
          ${avatar && !avatar.includes("default-avatar.png")
             ? `<img src="${avatar}" class="user-avatar-lg" alt="${escapeHtml(item.name)}" onerror="this.src='./assets/images/default-avatar.png'" />`
             : `<div class="user-avatar-placeholder">${escapeHtml(item.name).charAt(0)}</div>`
          }
          <div class="user-details">
            <h3>${escapeHtml(item.name)}</h3>
            <p class="user-bio">${item.email ? escapeHtml(item.email) : 'Community Member'}</p>
          </div>
          <div class="user-stats-row">
            <div class="stat-item">
              <span class="stat-val">${item.followersCount}</span>
              <span class="stat-label">Followers</span>
            </div>
            <div class="stat-item">
              <span class="stat-val">${item.followingCount}</span>
              <span class="stat-label">Following</span>
            </div>
          </div>
        </div>
      `;
      resultsEl.appendChild(userCard);

    } else {
      // POST CARD
      const postCard = document.createElement("a");
      postCard.className = "result-card post-card";
      postCard.href = item.url;
      
      // Format date if valid
      let dateStr = "";
      if (item.createdAt) {
          dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric"
          });
      }

      postCard.innerHTML = `
        <div class="post-media">
          ${item.image 
            ? `<img src="${item.image}" class="post-img" loading="lazy" alt="Post Image" />`
            : `<div class="no-image-placeholder"><i class="fi fi-rr-picture"></i></div>`
          }
        </div>
        <div class="post-content">
          <h3 class="post-title">${escapeHtml(item.title)}</h3>
          
          <div class="post-tags" style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
            ${item.tags && item.tags.length > 0
                ? item.tags.map(tag => `<span class="post-tag" style="font-size:0.75rem; color:#ff5722; background:rgba(255,87,34,0.1); padding:4px 10px; border-radius:20px; font-weight:600;">#${escapeHtml(tag)}</span>`).join('') 
                : ''}
          </div>

          <p class="post-excerpt">${escapeHtml(item.excerpt)}...</p>
          <div class="post-meta">
            <span>Read Article</span>
            ${dateStr ? `<span><i class="fi fi-rr-calendar"></i> ${dateStr}</span>` : ''}
          </div>
        </div>
      `;
      resultsEl.appendChild(postCard);
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



  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      // Optional: Force immediate search on Enter
      lastQuery = queryInput.value.trim();
      if (typeof queryInput.blur === 'function') {
        queryInput.blur(); // Dismiss keyboard
      }
      showLoading();
      renderResults(search(lastQuery), lastQuery);
    });
  }
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

function parseTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (!tags) return [];
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      if (tags.startsWith('{') && tags.endsWith('}')) {
          return tags.slice(1, -1).split(',').map(t => t.replace(/"/g, ''));
      }
      return tags.split(',').map(t => t.trim());
    }
  }
  return [];
}
