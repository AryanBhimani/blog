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
  setupFilters();
  setupSearch();
});

/* ---------------------------
   FILTERS & STATE
---------------------------- */
let currentFilter = 'all'; // 'all' or 'stories'

function setupFilters() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            // Update active state
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Set filter
            currentFilter = btn.dataset.filter;
            applyFilters();
        };
    });
}

function applyFilters() {
    const term = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    // 1. Filter by Category
    let filtered = allPosts;
    if (currentFilter === 'stories') {
        filtered = filtered.filter(p => !p.image); // No image = Story
    }

    // 2. Filter by Search
    if (term) {
        filtered = filtered.filter(p =>
          p.title.toLowerCase().includes(term) ||
          p.content.toLowerCase().includes(term) ||
          p.author.toLowerCase().includes(term)
        );
        if (searchResultsInfo) {
            searchResultsInfo.textContent = `Showing ${filtered.length} result${filtered.length === 1 ? '' : 's'}`;
        }
    } else {
        if (searchResultsInfo) searchResultsInfo.textContent = "";
    }

    renderPosts(filtered);
}

/* ---------------------------
   LOAD POSTS (FEED ALGORITHM)
---------------------------- */
async function loadAllPosts() {
  if (!postsList) return;

  postsList.innerHTML = `<div class="loading">
    <div class="loading-spinner"></div>
    <p>Curating your feed...</p>
  </div>`;

  try {
      // 1. Fetch Followed User IDs (Affinity)
      let followedIds = new Set();
      if (currentUser) {
          const { data: follows } = await supabase
              .from("followers")
              .select("following")
              .eq("follower", currentUser.id);
          
          if (follows) {
              follows.forEach(f => followedIds.add(f.following));
          }
      }

      // 2. Fetch Posts with Engagement Counts
      // select(count) is efficiently supported for getting the number of related rows
      const { data, error } = await supabase
        .from("posts")
        .select(`
            id, title, content, image_url, tags, created_at, user_id,
            users (name, avatar_url),
            likes (count),
            comments (count)
        `)
        .order("created_at", { ascending: false })
        .limit(100); // Limit efficient initial load

      if (error) {
        console.error("Feed Error:", error);
        postsList.innerHTML = `<p class="no-results">Failed to load feed</p>`;
        return;
      }

      // 3. Process & Rank Algorithm
      const processedPosts = data.map(p => {
          const likesCount = p.likes ? p.likes[0]?.count || 0 : 0; // .select('likes(count)') returns array 
          // Actually supabase .select('likes(count)') usually returns [{count: N}] or similar depending on version.
          // Wait, 'likes(count)' results in p.likes having {count: N} if using head? 
          // In JS client V2: select('*, likes(count)') -> p.likes = [{count: 5}]
          
          let lCount = 0;
          let cCount = 0;
          
          if(p.likes && p.likes.length > 0) lCount = p.likes[0].count;
          if(p.comments && p.comments.length > 0) cCount = p.comments[0].count;

          // Safe fallback if the count syntax returned weird structure
          // If the count query didn't work as expected, we default to 0 to avoid NaN
          
          return {
            id: p.id,
            title: p.title,
            content: p.content,
            image: p.image_url,
            tags: parseTags(p.tags),
            author: p.users?.name || "Unknown",
            authorAvatar: p.users?.avatar_url || "./assets/images/default-avatar.png",
            userId: p.users?.id || p.user_id, // Store author ID for affinity check
            createdAt: new Date(p.created_at),
            likesCount: lCount,
            commentsCount: cCount
          };
      });

      // 4. Algorithm Scoring
      // Score = (Affinity * W1) + (Freshness * W2) + (Popularity * W3)
      const rankedPosts = processedPosts.map(post => {
          // A. Affinity (Is Followed?)
          const isFollowed = followedIds.has(post.userId);
          const affinityScore = isFollowed ? 50 : 0; 
          // (Self is also high affinity intuitively, but let's keep it standard)
          // If it's me, maybe neutral?
          
          // B. Freshness (Time Decay)
          // Hours since posted
          const now = new Date();
          const hoursAgo = (now - post.createdAt) / (1000 * 60 * 60);
          // Decay function: 100 / (hours + 2)^1.5 
          // Recent posts (0h) = 35 pts. 24h ago = ~0.7 pts.
          const freshnessScore = 150 / Math.pow(hoursAgo + 1, 1.2); 

          // C. Popularity (Engagement)
          // Comments are worth more than likes
          const popularityScore = (post.likesCount * 1) + (post.commentsCount * 3);

          const totalScore = affinityScore + freshnessScore + popularityScore;

          return { ...post, score: totalScore, debugScore: { affinityScore, freshnessScore, popularityScore } };
      });

      // 5. Sort
      rankedPosts.sort((a, b) => b.score - a.score);

      allPosts = rankedPosts;
      applyFilters(); // Render

  } catch (err) {
      console.error("Algo Error:", err);
      postsList.innerHTML = `<p class="no-results">Error calculating feed</p>`;
  }
}

function parseTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (!tags) return [];
  if (typeof tags === 'string') {
    // Try JSON parse
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // If not JSON, maybe comma separated or Postgres array format?
      // Handle Postgres {a,b,c}
      if (tags.startsWith('{') && tags.endsWith('}')) {
          return tags.slice(1, -1).split(',').map(t => t.replace(/"/g, ''));
      }
      return tags.split(',').map(t => t.trim());
    }
  }
  return [];
}

/* ---------------------------
   SEARCH
---------------------------- */
function setupSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    applyFilters();
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
      <!-- Date Badge (Always visible, positioned absolute relative to card) -->
      <span class="post-date-badge">${dateStr}</span>

      <!-- Image Section (Only if image exists) -->
      ${post.image ? `
      <div class="post-card-image-container">
        <img src="${post.image}" class="post-card-img" loading="lazy">
      </div>` : ''}

      <!-- Content Section -->
      <div class="post-card-content">
        
        <div class="post-author-row">
            ${post.authorAvatar && !post.authorAvatar.includes("default-avatar.png")
              ? `<img src="${post.authorAvatar}" class="post-author-avatar" onerror="this.src='./assets/images/default-avatar.png'">`
              : `<div class="post-author-placeholder">${escapeHtml(post.author).charAt(0)}</div>`
            }
            <div class="post-author-info">
                <span class="post-author-name">${escapeHtml(post.author)}</span>
            </div>
        </div>

        <h3 class="post-title" onclick="window.location.href='comment.html?postId=${post.id}'">${escapeHtml(post.title)}</h3>
        
        <div class="post-tags">
            ${post.tags && post.tags.length > 0 
                ? post.tags.map(tag => `<span class="post-tag">#${escapeHtml(tag)}</span>`).join('') 
                : ''}
        </div>

        <div class="excerpt">${escapeHtml(stripHtml(post.content).substring(0,100))}...</div>
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

    icon.classList.replace("fi-sr-bookmark", "fi-sr-bookmark");
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

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
