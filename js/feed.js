import { supabase } from "./supabase/supabaseClient.js";
const likeSubscriptions = {};

// DOM Elements
const postsList = document.getElementById("all-posts-list");
const searchInput = document.getElementById("search-input");
const searchResultsInfo = document.getElementById("search-results-info");

let allPosts = [];
let currentUser = null;

/* ---------------------------
   AUTH USER
---------------------------- */
supabase.auth.getUser().then(({ data }) => {
  currentUser = data?.user || null;
});

/* ---------------------------
   LOAD ON PAGE
---------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadAllPosts();
  setupSearch();
});

/* ---------------------------
   LOAD POSTS
---------------------------- */
async function loadAllPosts() {
  postsList.innerHTML = `<p>Loading blogs...</p>`;

  const { data, error } = await supabase
    .from("posts")
    .select(`id, title, content, created_at, user_id, users(name)`)
    .order("created_at", { ascending: false });

  if (error) {
    postsList.innerHTML = `<p>Failed to load blogs</p>`;
    return;
  }

  allPosts = data.map(p => ({
    id: p.id,
    title: p.title,
    content: p.content,
    author: p.users?.name || "Unknown",
    createdAt: new Date(p.created_at)
  }));

  renderPosts(allPosts);
}

/* ---------------------------
   SEARCH
---------------------------- */
function setupSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase().trim();
    if (!term) {
      renderPosts(allPosts);
      searchResultsInfo.textContent = "";
      return;
    }

    const filtered = allPosts.filter(p =>
      p.title.toLowerCase().includes(term) ||
      p.content.toLowerCase().includes(term) ||
      p.author.toLowerCase().includes(term)
    );

    renderPosts(filtered);
    searchResultsInfo.textContent = `Showing ${filtered.length} results`;
  });
}

/* ---------------------------
   RENDER POSTS
---------------------------- */
function renderPosts(posts) {
  postsList.innerHTML= "";

  if (!posts.length) {
    postsList.innerHTML = "<p>No blogs found</p>";
    return;
  }

  posts.forEach(post => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.dataset.postId = post.id;

    card.innerHTML = `
      <h3>${escapeHtml(post.title)}</h3>

      <div class="excerpt">${post.content.substring(0,150)}...</div>
      <div class="full-content" style="display:none;">${post.content}</div>

      <small>By ${escapeHtml(post.author)} · ${post.createdAt.toLocaleDateString()}</small>

      <div class="post-footer-actions">
        <button class="toggle-btn primary-action-button">Read More</button>

        <div class="post-icons">
          <button class="icon-btn like-btn">
            <i class="fi fi-rr-heart"></i>
            <span class="like-count">0</span>
          </button>

          <button class="icon-btn save-btn">
            <i class="fi fi-rr-bookmark"></i>
          </button>

          <a href="comment.html?postId=${post.id}" class="icon-btn comment-btn">
             <i class="fi fi-sr-comment-alt"></i>
          </a>

        </div>
      </div>
    `;

    postsList.appendChild(card);

    // Read More toggle
    const toggleBtn = card.querySelector(".toggle-btn");
    const excerpt = card.querySelector(".excerpt");
    const full = card.querySelector(".full-content");

    toggleBtn.onclick = () => {
      const open = full.style.display === "block";
      full.style.display = open ? "none" : "block";
      excerpt.style.display = open ? "block" : "none";
      toggleBtn.textContent = open ? "Read More" : "Show Less";
    };

    // Like / Save
    card.querySelector(".like-btn").onclick = () => handleLike(post.id);
    card.querySelector(".save-btn").onclick = () => handleSave(post.id);

    // Like count + realtime
    loadLikeCount(post.id, card);

    // Initial states
    setInitialLikeState(post.id, card);
    setInitialSaveState(post.id, card);

    // Double tap / double click to like
    let lastTap = 0;
    card.addEventListener("click", () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        handleLike(post.id);
        card.classList.add("heart-pop");
        setTimeout(() => card.classList.remove("heart-pop"), 600);
      }
      lastTap = now;
    });
  });
}

/* ---------------------------
   LIKE COUNT (REALTIME)
---------------------------- */
async function loadLikeCount(postId, card) {
  const countEl = card.querySelector(".like-count");

  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  countEl.textContent = count || 0;

  if (likeSubscriptions[postId]) return;

  likeSubscriptions[postId] = supabase
    .channel(`likes-${postId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "likes",
        filter: `post_id=eq.${postId}`,
      },
      () => refreshLikeCount(postId)
    )
    .subscribe();
}

async function refreshLikeCount(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (!card) return;

  const countEl = card.querySelector(".like-count");

  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  countEl.textContent = count || 0;
}

/* ---------------------------
   INITIAL ICON STATES
---------------------------- */
async function setInitialLikeState(postId, card) {
  if (!currentUser) return;

  const { data } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (data) {
    const icon = card.querySelector(".like-btn i");
    icon.classList.replace("fi-rr-heart", "fi-sr-heart");
    icon.style.color = "#ff3040";
  }
}

async function setInitialSaveState(postId, card) {
  if (!currentUser) return;

  const { data } = await supabase
    .from("saved_posts")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (data) {
    const icon = card.querySelector(".save-btn i");
    icon.classList.replace("fi-rr-bookmark", "fi-sr-bookmark");
    icon.style.color = "#ff5722";
  }
}

/* ---------------------------
   LIKE POST
---------------------------- */
async function handleLike(postId) {
  if (!currentUser) return alert("Login required");

  const icon = document.querySelector(
    `[data-post-id="${postId}"] .like-btn i`
  );

  const { data } = await supabase
    .from("likes")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", currentUser.id);

  if (data.length) {
    await supabase.from("likes").delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);

    icon.classList.replace("fi-sr-heart", "fi-rr-heart");
    icon.style.color = "";
    refreshLikeCount(postId);
  } else {
    await supabase.from("likes").insert({
      post_id: postId,
      user_id: currentUser.id
    });

    icon.classList.replace("fi-rr-heart", "fi-sr-heart");
    icon.style.color = "#ff3040";
    refreshLikeCount(postId);
  }
}

/* ---------------------------
   SAVE POST
---------------------------- */
async function handleSave(postId) {
  if (!currentUser) return alert("Login required");

  const icon = document.querySelector(
    `[data-post-id="${postId}"] .save-btn i`
  );

  const { data } = await supabase
    .from("saved_posts")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", currentUser.id);

  if (data.length) {
    await supabase.from("saved_posts").delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);

    icon.classList.replace("fi-sr-bookmark", "fi-rr-bookmark");
    icon.style.color = "";
    showToast("Removed from saved ❌");
  } else {
    await supabase.from("saved_posts").insert({
      post_id: postId,
      user_id: currentUser.id
    });

    icon.classList.replace("fi-rr-bookmark", "fi-sr-bookmark");
    icon.style.color = "#ff5722";
    showToast("Post saved ✅");
  }
}

/* ---------------------------
   TOAST
---------------------------- */
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

/* ---------------------------
   UTIL
---------------------------- */
function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
