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

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
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
  if (!postsList) return;

  postsList.innerHTML = `<div class="loading">
    <div class="loading-spinner"></div>
    <p>Loading blogs...</p>
  </div>`;

  const { data, error } = await supabase
    .from("posts")
    .select(`id, title, content, image_url, created_at, user_id, users(name, avatar_url)`)
    .order("created_at", { ascending: false });

  if (error) {
    postsList.innerHTML = `<p class="no-results">Failed to load blogs</p>`;
    return;
  }

  allPosts = data.map(p => ({
    id: p.id,
    title: p.title,
    content: p.content,
    image: p.image_url,
    author: p.users?.name || "Unknown",
    authorAvatar: p.users?.avatar_url || "./assets/images/default-avatar.png",
    createdAt: new Date(p.created_at)
  }));

  renderPosts(allPosts);
}

/* ---------------------------
   SEARCH (No changes needed, relying on global allPosts)
---------------------------- */
function setupSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase().trim();
    
    if (!allPosts || allPosts.length === 0) return;

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
    searchResultsInfo.textContent = `Showing ${filtered.length} result${filtered.length === 1 ? '' : 's'}`;
  });
}

/* ---------------------------
   RENDER POSTS
---------------------------- */
function renderPosts(posts) {
  postsList.innerHTML = "";

  if (!posts.length) {
    postsList.innerHTML = `<div class="no-results">
      <div class="no-results-icon">📭</div>
      <p>No blogs found</p>
    </div>`;
    return;
  }

  posts.forEach(post => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.dataset.postId = post.id;

    const dateStr = post.createdAt.toLocaleDateString(undefined, {month:'short', day:'numeric'});

    card.innerHTML = `
      <!-- Image Section -->
      <div class="post-card-image-container">
        ${post.image ? `<img src="${post.image}" class="post-card-img" loading="lazy">` : 
        `<div class="post-card-img-placeholder"></div>`}
        
        <div class="post-card-overlay">
            <span class="post-date-badge">${dateStr}</span>
        </div>
      </div>

      <!-- Content Section -->
      <div class="post-card-content">
        
        <div class="post-author-row">
            <img src="${post.authorAvatar}" class="post-author-avatar" onerror="this.src='./assets/images/default-avatar.png'">
            <div class="post-author-info">
                <span class="post-author-name">${escapeHtml(post.author)}</span>
            </div>
        </div>

        <h3 class="post-title" onclick="window.location.href='comment.html?postId=${post.id}'">${escapeHtml(post.title)}</h3>
        
        <div class="excerpt">${escapeHtml(post.content.substring(0,100))}...</div>
        <div class="full-content" style="display:none;">${escapeHtml(post.content)}</div>

        <div class="post-actions-row">
           <button class="toggle-read-more">Read More</button>
           
           <div class="action-icons">
               <button class="icon-action-btn like-btn" aria-label="Like">
                   <i class="fi fi-rr-heart"></i>
                   <span class="like-count">0</span>
               </button>
               <button class="icon-action-btn save-btn" aria-label="Save">
                   <i class="fi fi-rr-bookmark"></i>
               </button>
               <a href="comment.html?postId=${post.id}" class="icon-action-btn comment-btn" aria-label="Comment">
                   <i class="fi fi-rr-comment-alt"></i>
               </a>
           </div>
        </div>
      </div>
    `;

    postsList.appendChild(card);

    // Read More toggle
    const toggleBtn = card.querySelector(".toggle-read-more");
    const excerpt = card.querySelector(".excerpt");
    const full = card.querySelector(".full-content");

    // Hide read more if content is short
    if (post.content.length <= 100) {
      toggleBtn.style.display = 'none';
    }

    toggleBtn.onclick = () => {
      const open = full.style.display === "block";
      full.style.display = open ? "none" : "block";
      excerpt.style.display = open ? "block" : "none";
      toggleBtn.textContent = open ? "Read More" : "Show Less";
    };

    // Like / Save
    const likeBtn = card.querySelector(".like-btn");
    const saveBtn = card.querySelector(".save-btn");
    
    likeBtn.onclick = (e) => {
      e.stopPropagation();
      handleLike(post.id);
    };
    
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      handleSave(post.id);
    };

    // Like count + realtime
    loadLikeCount(post.id, card);

    // Initial states
    setInitialLikeState(post.id, card);
    setInitialSaveState(post.id, card);

    // Double tap / double click to like
    let lastTap = 0;
    card.addEventListener("click", (e) => {
      // Don't trigger double-tap like if clicking on buttons or links
      if (e.target.closest('.icon-action-btn') || e.target.closest('.toggle-read-more')) {
        return;
      }
      
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
    const likeBtn = card.querySelector(".like-btn");
    const icon = likeBtn.querySelector("i");
    icon.classList.replace("fi-rr-heart", "fi-sr-heart");
    likeBtn.classList.add("liked");
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
    const saveBtn = card.querySelector(".save-btn");
    const icon = saveBtn.querySelector("i");
    icon.classList.replace("fi-rr-bookmark", "fi-sr-bookmark");
    saveBtn.classList.add("saved");
  }
}

/* ---------------------------
   LIKE POST
---------------------------- */
async function handleLike(postId) {
  if (!currentUser) {
    showToast("Please login to like posts");
    return;
  }

  const likeBtn = document.querySelector(
    `[data-post-id="${postId}"] .like-btn`
  );
  const icon = likeBtn.querySelector("i");

  const { data } = await supabase
    .from("likes")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", currentUser.id);

  if (data.length) {
    // Unlike
    await supabase.from("likes").delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);

    icon.classList.replace("fi-sr-heart", "fi-rr-heart");
    likeBtn.classList.remove("liked");
    refreshLikeCount(postId);
    showToast("Like removed");
  } else {
    // Like
    await supabase.from("likes").insert({
      post_id: postId,
      user_id: currentUser.id
    });

    icon.classList.replace("fi-rr-heart", "fi-sr-heart");
    likeBtn.classList.add("liked");
    
    // Add pulse animation
    likeBtn.style.animation = 'none';
    setTimeout(() => {
      likeBtn.style.animation = 'heartPulse 0.4s ease';
    }, 10);
    
    refreshLikeCount(postId);
    showToast("Liked! ❤️");
  }
}

/* ---------------------------
   SAVE POST
---------------------------- */
async function handleSave(postId) {
  if (!currentUser) {
    showToast("Please login to save posts");
    return;
  }

  const saveBtn = document.querySelector(
    `[data-post-id="${postId}"] .save-btn`
  );
  const icon = saveBtn.querySelector("i");

  const { data } = await supabase
    .from("saved_posts")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", currentUser.id);

  if (data.length) {
    // Unsave
    await supabase.from("saved_posts").delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);

    icon.classList.replace("fi-sr-bookmark", "fi-rr-bookmark");
    saveBtn.classList.remove("saved");
    showToast("Removed from saved ❌");
  } else {
    // Save
    await supabase.from("saved_posts").insert({
      post_id: postId,
      user_id: currentUser.id
    });

    icon.classList.replace("fi-rr-bookmark", "fi-sr-bookmark");
    saveBtn.classList.add("saved");
    
    // Add bounce animation
    saveBtn.style.animation = 'none';
    setTimeout(() => {
      saveBtn.style.animation = 'heartPulse 0.4s ease';
    }, 10);
    
    showToast("Post saved ✅");
  }
}

/* ---------------------------
   TOAST
---------------------------- */
function showToast(msg) {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  
  // Auto remove after animation
  setTimeout(() => {
    if (t.parentNode) {
      t.remove();
    }
  }, 2000);
}

/* ---------------------------
   UTIL
---------------------------- */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
