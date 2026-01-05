import { supabase } from "./supabase/supabaseClient.js";
const likeSubscriptions = {};

// DOM Elements
const postsList = document.getElementById("all-posts-list");
const searchInput = document.getElementById("search-input");
const searchResultsInfo = document.getElementById("search-results-info");

let allPosts = [];
let currentUser = null;

// Pagination State
let currentPage = 1;
const POSTS_PER_PAGE = 10;
let hasMore = true;
let isLoading = false;

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
  // Initial Load
  loadPostsChunk(); 
  setupFilters();
  setupSearch();
  setupInfiniteScroll();
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
            
            // Reset List for new filter
            resetFeed();
        };
    });
}

function resetFeed() {
    currentPage = 1;
    allPosts = [];
    hasMore = true;
    postsList.innerHTML = "";
    loadPostsChunk();
}

function applyFilters(posts) {
    const term = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    // 1. Filter by Category
    let filtered = posts;
    if (currentFilter === 'stories') {
        filtered = filtered.filter(p => !p.image); // No image = Story
    } else if (currentFilter === 'news') {
        filtered = filtered.filter(p => 
            p.tags && p.tags.some(t => t.toLowerCase() === 'news')
        );
    }

    // 2. Filter by Search
    if (term) {
        filtered = filtered.filter(p =>
          p.title.toLowerCase().includes(term) ||
          p.content.toLowerCase().includes(term) ||
          p.author.toLowerCase().includes(term)
        );
        if (searchResultsInfo) {
            searchResultsInfo.textContent = `Showing ${filtered.length} results`;
        }
    } else {
        if (searchResultsInfo) searchResultsInfo.textContent = "";
    }

    return filtered;
}

/* ---------------------------
   LOAD POSTS (PAGINATED)
---------------------------- */
async function loadPostsChunk() {
  if (!postsList || isLoading || !hasMore) return;
  isLoading = true;

  // Show Loading Spinner if first load
  if(currentPage === 1) {
      postsList.innerHTML = `<div class="loading">
        <div class="loading-spinner"></div>
        <p>Curating your feed...</p>
      </div>`;
  } else {
      // Append loader for pagination
      const loader = document.createElement("div");
      loader.className = "pagination-loader";
      loader.innerHTML = `<div class="loading-spinner small"></div>`;
      postsList.appendChild(loader);
  }

  try {
      const from = (currentPage - 1) * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      // 1. Fetch Posts
      const { data, error } = await supabase
        .from("posts")
        .select(`
            id, title, content, image_url, tags, created_at, user_id,
            users (name, avatar_url),
            likes (count),
            comments (count)
        `)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data.length < POSTS_PER_PAGE) {
          hasMore = false;
      }

      // 2. Process Posts
      const processedPosts = data.map(p => {
          let lCount = 0;
          let cCount = 0;
          
          if(p.likes && p.likes.length > 0) lCount = p.likes[0].count;
          if(p.comments && p.comments.length > 0) cCount = p.comments[0].count;

          return {
            id: p.id,
            title: p.title,
            content: p.content,
            image: p.image_url,
            tags: parseTags(p.tags),
            author: p.users?.name || "Unknown",
            authorAvatar: p.users?.avatar_url || "./assets/images/default-avatar.png",
            userId: p.users?.id || p.user_id,
            createdAt: new Date(p.created_at),
            likesCount: lCount,
            commentsCount: cCount,
            readingTime: calculateReadingTime(p.content)
          };
      });

      // Remove loading indicators
      if(currentPage === 1) {
          postsList.innerHTML = "";
      } else {
          const loader = postsList.querySelector(".pagination-loader");
          if(loader) loader.remove();
      }

      // Filter & Render
      const filteredAndRanked = applyFilters(processedPosts);
      
      // Note: Client-side ranking/filtering breaks strict server-side pagination slightly, 
      // but for "infinite scroll" of latest posts, appending is fine.
      // If searching, we might need client-side search on loaded items or server search (simpler here: filter loaded).
      
      renderPosts(filteredAndRanked, currentPage === 1);
      
      allPosts = [...allPosts, ...processedPosts]; // Keep track if needed
      currentPage++;

  } catch (err) {
      console.error("Feed Error:", err);
      if(currentPage === 1) {
          postsList.innerHTML = `<p class="no-results">Failed to load feed</p>`;
      }
  } finally {
      isLoading = false;
  }
}

function calculateReadingTime(text) {
    const wordsPerMinute = 200;
    const noTags = text.replace(/<[^>]*>/g, ''); 
    const words = noTags.trim().split(/\s+/).length;
    const time = Math.ceil(words / wordsPerMinute);
    return `${time} min read`;
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

/* ---------------------------
   SEARCH
---------------------------- */
function setupSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
      // For simple search on LOADED posts:
      const term = searchInput.value.toLowerCase().trim();
      if(!term) {
          postsList.innerHTML = "";
          renderPosts(allPosts, true); // re-render all loaded
          return;
      }
      
      const filtered = allPosts.filter(p =>
          p.title.toLowerCase().includes(term) ||
          p.content.toLowerCase().includes(term) ||
          p.author.toLowerCase().includes(term)
      );
      
      postsList.innerHTML = "";
      renderPosts(filtered, true);
  });
}

/* ---------------------------
   INFINITE SCROLL OBSERVER
---------------------------- */
function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        if(entries[0].isIntersecting && hasMore && !isLoading && !searchInput.value) {
            loadPostsChunk();
        }
    }, { rootMargin: "200px" });

    // We observe a sentinel header/footer or create a dedicated element at bottom
    // We will append a sentinel at the end of render
}

/* ---------------------------
   RENDER POSTS
---------------------------- */
function renderPosts(posts, clear = false) {
  if (clear) postsList.innerHTML = "";

  if (!posts.length && clear) {
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
    
    // Add fade-in animation
    card.style.animation = "fadeIn 0.5s ease forwards";

    const dateStr = post.createdAt.toLocaleDateString(undefined, {month:'short', day:'numeric'});

    card.innerHTML = `
      <!-- 1. Image Section (includes Date Badge if image exists) -->
      ${post.image ? `
      <div class="post-card-image-container">
        <img src="${post.image}" class="post-card-img" loading="lazy">
        <div class="badges-overlay">
            ${post.tags && post.tags.some(t => t.toLowerCase() === 'news') 
                ? `<span class="category-badge news">NEWS</span>` 
                : ''}
            <span class="post-date-badge">${dateStr}</span>
        </div>
      </div>` : ''}

      <!-- 2. Content Section -->
      <div class="post-card-content">
        
        <div class="post-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
             <!-- Author -->
             <div class="post-author-row" style="margin-bottom:0;">
                ${post.authorAvatar && !post.authorAvatar.includes("default-avatar.png")
                  ? `<img src="${post.authorAvatar}" class="post-author-avatar" onerror="this.src='./assets/images/default-avatar.png'">`
                  : `<div class="post-author-placeholder">${escapeHtml(post.author).charAt(0)}</div>`
                }
                <div class="post-author-info">
                    <span class="post-author-name">${escapeHtml(post.author)}</span>
                </div>
            </div>
            
            <!-- Meta: Date (if no image) -->
            <div style="display:flex; align-items:center; gap: 8px;">
                ${!post.image && post.tags && post.tags.some(t => t.toLowerCase() === 'news') 
                   ? `<span class="category-badge news inline">NEWS</span>` 
                   : ''}
                ${!post.image ? `<span class="post-date-badge inline">${dateStr}</span>` : ''}
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

    // Double tap
    let lastTap = 0;
    card.addEventListener("click", (e) => {
      if (e.target.closest('.icon-action-btn') || e.target.closest('.toggle-read-more') || e.target.closest('.post-title')) {
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

  // Create or move Sentinel to bottom for Infinite Scroll
  let sentinel = document.getElementById("scroll-sentinel");
  if(!sentinel) {
      sentinel = document.createElement("div");
      sentinel.id = "scroll-sentinel";
      sentinel.style.height = "20px";
      sentinel.style.width = "100%";
  } else {
      sentinel.remove(); // Remove to re-append at end
  }
  
  if(hasMore) {
      postsList.appendChild(sentinel);
      // Re-observe
      const observer = new IntersectionObserver((entries) => {
        if(entries[0].isIntersecting && hasMore && !isLoading && !searchInput.value) {
            loadPostsChunk();
        }
      }, { rootMargin: "200px" });
      observer.observe(sentinel);
  }
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
  const { data } = await supabase.from("likes").select("id").eq("post_id", postId).eq("user_id", currentUser.id).maybeSingle();
  if (data) {
    const likeBtn = card.querySelector(".like-btn");
    const icon = likeBtn.querySelector("i");
    icon.classList.replace("fi-rr-heart", "fi-sr-heart");
    likeBtn.classList.add("liked");
  }
}

async function setInitialSaveState(postId, card) {
  if (!currentUser) return;
  const { data } = await supabase.from("saved_posts").select("id").eq("post_id", postId).eq("user_id", currentUser.id).maybeSingle();
  if (data) {
    const saveBtn = card.querySelector(".save-btn");
    const icon = saveBtn.querySelector("i");
    icon.classList.replace("fi-rr-bookmark", "fi-sr-bookmark");
    saveBtn.classList.add("saved");
  }
}

/* ---------------------------
   LIKE & SAVE
---------------------------- */
async function handleLike(postId) {
  if (!currentUser) {
    showToast("Please login to like posts");
    return;
  }
  const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
  const icon = likeBtn.querySelector("i");
  const { data } = await supabase.from("likes").select("id").eq("post_id", postId).eq("user_id", currentUser.id);

  if (data.length) {
    await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", currentUser.id);
    icon.classList.replace("fi-sr-heart", "fi-sr-heart");
    likeBtn.classList.remove("liked");
    showToast("Like removed");
  } else {
    await supabase.from("likes").insert({ post_id: postId, user_id: currentUser.id });
    icon.classList.replace("fi-sr-heart", "fi-sr-heart");
    likeBtn.classList.add("liked");
    likeBtn.style.animation = 'none';
    setTimeout(() => { likeBtn.style.animation = 'heartPulse 0.4s ease'; }, 10);
    showToast("Liked! ❤️");
  }
  refreshLikeCount(postId);
}

async function handleSave(postId) {
  if (!currentUser) {
    showToast("Please login to save posts");
    return;
  }
  const saveBtn = document.querySelector(`[data-post-id="${postId}"] .save-btn`);
  const icon = saveBtn.querySelector("i");
  const { data } = await supabase.from("saved_posts").select("id").eq("post_id", postId).eq("user_id", currentUser.id);

  if (data.length) {
    await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", currentUser.id);
    icon.classList.replace("fi-sr-bookmark", "fi-rr-bookmark");
    saveBtn.classList.remove("saved");
    showToast("Removed from saved ❌");
  } else {
    await supabase.from("saved_posts").insert({ post_id: postId, user_id: currentUser.id });
    icon.classList.replace("fi-sr-bookmark", "fi-sr-bookmark");
    saveBtn.classList.add("saved");
    saveBtn.style.animation = 'none';
    setTimeout(() => { saveBtn.style.animation = 'heartPulse 0.4s ease'; }, 10);
    showToast("Post saved ✅");
  }
}

/* ---------------------------
   TOAST & UTIL
---------------------------- */
function showToast(msg) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, 2000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
