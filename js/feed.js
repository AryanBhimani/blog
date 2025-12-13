import { supabase } from "./supabase/supabaseClient.js";

// DOM Elements
const postsList = document.getElementById("all-posts-list");
const searchInput = document.getElementById("search-input");
const searchResultsInfo = document.getElementById("search-results-info");
const clearSearchBtn = document.getElementById("clear-search");
const searchBtn = document.getElementById("search-button");

// Store all posts (for search)
let allPosts = [];

// Load everything when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadAllPosts();
  setupSearch();
});

/* ------------------------------------------
   Load ALL posts from Supabase
--------------------------------------------- */
async function loadAllPosts() {
  postsList.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Loading blogs...</p>
    </div>
  `;

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      title,
      content,
      created_at,
      user_id,
      users (
        name
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading posts:", error.message);
    postsList.innerHTML = `<p>Failed to load blogs. Try again.</p>`;
    return;
  }

  // Convert Supabase rows into your existing post format:
  allPosts = data.map((post) => ({
    id: post.id,
    userId: post.user_id,
    title: post.title || "",
    content: post.content || "",
    createdAt: new Date(post.created_at),
    author: post.users?.name || "Unknown",
  }));

  renderPosts(allPosts);
}

/* ------------------------------------------
   SEARCH SETUP (unchanged)
--------------------------------------------- */
function setupSearch() {
  if (!searchInput) return;

  let timeout;

  searchInput.addEventListener("input", () => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      const term = searchInput.value.trim().toLowerCase();

      if (!term) {
        renderPosts(allPosts);
        searchResultsInfo.textContent = "";
        return;
      }

      const filtered = allPosts.filter((p) =>
        p.title.toLowerCase().includes(term) ||
        p.content.toLowerCase().includes(term) ||
        p.author.toLowerCase().includes(term)
      );

      renderPosts(filtered, term);
      searchResultsInfo.textContent = `Showing ${filtered.length} results for "${term}"`;
    }, 250);
  });

  clearSearchBtn.onclick = () => {
    searchInput.value = "";
    searchResultsInfo.textContent = "";
    renderPosts(allPosts);
  };

  searchBtn.onclick = () => {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = allPosts.filter((p) =>
      p.title.toLowerCase().includes(term) ||
      p.content.toLowerCase().includes(term) ||
      p.author.toLowerCase().includes(term)
    );

    renderPosts(filtered, term);
    searchResultsInfo.textContent = `Showing ${filtered.length} results for "${term}"`;
  };
}

/* ------------------------------------------
   RENDER POSTS (same design)
--------------------------------------------- */
function renderPosts(posts, highlightTerm = "") {
  if (!posts.length) {
    postsList.innerHTML = `<p>No blogs found.</p>`;
    return;
  }

  let html = "";

  posts.forEach((post) => {
    const safeTitle = escapeHtml(post.title); // keep title safe

    // Create excerpt from content (HTML allowed)
    const excerptHTML =
      post.content.length > 150
        ? post.content.substring(0, 150) + "..."
        : post.content;

    html += `
      <article class="post-card" data-post-id="${post.id}">
        <h3>${highlight(safeTitle, highlightTerm)}</h3>

        <!-- Show excerpt with HTML (no escaping) -->
        <div class="excerpt">
          ${excerptHTML}
        </div>

        <!-- Full HTML content (hidden initially) -->
        <div class="full-content" style="display:none;">
          ${post.content}
        </div>

        <small>By ${escapeHtml(post.author)} on ${post.createdAt.toLocaleDateString()}</small>

        <div class="post-footer-actions">
          <button class="toggle-btn primary-action-button">Read More</button>
          <a href="comment.html?postId=${post.id}" class="comment-btn">💬 Comment</a>
        </div>
      </article>
    `;
  });

  postsList.innerHTML = html;

  // READ MORE / SHOW LESS
  document.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.onclick = (e) => {
      const card = e.target.closest(".post-card");
      const excerpt = card.querySelector(".excerpt");
      const full = card.querySelector(".full-content");

      if (full.style.display === "none") {
        full.style.display = "block";
        excerpt.style.display = "none";
        btn.textContent = "Show Less";
      } else {
        full.style.display = "none";
        excerpt.style.display = "block";
        btn.textContent = "Read More";
      }
    };
  });
}


/* ------------------------------------------
   UTILITIES
--------------------------------------------- */
function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlight(text, term) {
  if (!term) return text;
  const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}
