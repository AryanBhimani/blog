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
/* ---------------------------
   MOCK DATA (FALLBACK)
---------------------------- */
const MOCK_POSTS = [
  {
    id: "mock-1",
    title: "The Future of Web Development: What to Expect in 2026",
    content: "As we move further into 2026, the landscape of web development is shifting rapidly. From AI-driven code generation to the rise of WebAssembly, developers are finding new ways to build faster, more resilient applications. In this article, we explore the top trends defining the industry this year...",
    image_url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
    tags: ["Tech", "WebDev", "Future"],
    created_at: new Date().toISOString(),
    users: { name: "Sarah Jenkins", avatar_url: "https://randomuser.me/api/portraits/women/44.jpg" },
    likes: [{ count: 124 }],
    comments: [{ count: 45 }]
  },
  {
    id: "mock-2",
    title: "Minimalism in Design: Less is More",
    content: "Minimalism isn't just about removing things; it's about adding meaning. In a world cluttered with information, clean design stands out by offering clarity and purpose. We discuss how to implement effective minimalist principles in your next UI project without sacrificing functionality.",
    image_url: "https://images.unsplash.com/photo-1507721999472-8ed4421c4af2?auto=format&fit=crop&w=800&q=80",
    tags: ["Design", "UI/UX", "Minimalism"],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    users: { name: "David Chen", avatar_url: "https://randomuser.me/api/portraits/men/32.jpg" },
    likes: [{ count: 89 }],
    comments: [{ count: 12 }]
  },
  {
    id: "mock-3",
    title: "Understanding the Power of Habit",
    content: "Habits shape our lives more than we realize. Drawing from the latest research in psychology and neuroscience, we break down the 'Habit Loop' and how you can hack it to build positive routines and break bad ones. It's never too late to reinvent yourself.",
    image_url: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80",
    tags: ["Lifestyle", "Productivity", "Psychology"],
    created_at: new Date(Date.now() - 172800000).toISOString(),
    users: { name: "Emily Ross", avatar_url: "https://randomuser.me/api/portraits/women/68.jpg" },
    likes: [{ count: 256 }],
    comments: [{ count: 78 }]
  },
  {
    id: "mock-4",
    title: "Exploring the Hidden Gems of Kyoto",
    content: "Kyoto is a city where tradition meets modernity. Beyond the famous temples, there are quiet alleyways, hidden tea houses, and breathtaking gardens that few tourists see. Join me on a photographic journey through the ancient capital of Japan.",
    image_url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
    tags: ["Travel", "Japan", "Photography"],
    created_at: new Date(Date.now() - 259200000).toISOString(),
    users: { name: "Michael Wright", avatar_url: "https://randomuser.me/api/portraits/men/86.jpg" },
    likes: [{ count: 342 }],
    comments: [{ count: 56 }]
  },
  {
    id: "mock-5",
    title: "Sustainable Living: Small Changes, Big Impact",
    content: "Sustainability is no longer a choice but a necessity. You don't need to change your entire lifestyle overnight. We share 10 simple, actionable steps you can take today to reduce your carbon footprint and live a more eco-friendly life.",
    image_url: "https://images.unsplash.com/photo-1542601906990-b4d3fb7d5afa?auto=format&fit=crop&w=800&q=80",
    tags: ["Sustainability", "Eco", "Lifestyle"],
    created_at: new Date(Date.now() - 432000000).toISOString(),
    users: { name: "Jessica Green", avatar_url: "https://randomuser.me/api/portraits/women/12.jpg" },
    likes: [{ count: 167 }],
    comments: [{ count: 23 }]
  }
];

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
      let { data, error } = await supabase
        .from("posts")
        .select(`
            id, title, content, image_url, tags, created_at, user_id,
            users (name, avatar_url),
            likes (count),
            comments (count)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      // --- FALLBACK TO MOCK DATA IF EMPTY OR ERROR ---
      if (error || !data || data.length === 0) {
        console.warn("Using Mock Data (Database empty or unreachable)");
        data = MOCK_POSTS; 
      }

      // 3. Process & Rank Algorithm
      const processedPosts = data.map(p => {
          let lCount = 0;
          let cCount = 0;
          
          // Handle real Supabase count response vs Mock data structure
          if (Array.isArray(p.likes)) {
             lCount = p.likes[0]?.count || 0;
          }
          if (Array.isArray(p.comments)) {
             cCount = p.comments[0]?.count || 0;
          }

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
            commentsCount: cCount
          };
      });

      // 4. Algorithm Scoring
      const rankedPosts = processedPosts.map(post => {
          // A. Affinity
          const isFollowed = followedIds.has(post.userId);
          const affinityScore = isFollowed ? 50 : 0; 
          
          // B. Freshness
          const now = new Date();
          const hoursAgo = (now - post.createdAt) / (1000 * 60 * 60);
          const freshnessScore = 150 / Math.pow(hoursAgo + 1, 1.2); 

          // C. Popularity
          const popularityScore = (post.likesCount * 1) + (post.commentsCount * 3);

          const totalScore = affinityScore + freshnessScore + popularityScore;

          return { ...post, score: totalScore };
      });

      // 5. Sort
      rankedPosts.sort((a, b) => b.score - a.score);

      allPosts = rankedPosts;
      applyFilters(); 

  } catch (err) {
      console.error("Algo Error:", err);
      // Even in catch, try to render mocks if allPosts is empty
      if (allPosts.length === 0) {
          console.warn("Fatal error, rendering backup mocks");
          // Re-map mock posts directly to view model
          allPosts = MOCK_POSTS.map(p => ({
            id: p.id,
            title: p.title,
            content: p.content,
            image: p.image_url,
            tags: p.tags,
            author: p.users.name,
            authorAvatar: p.users.avatar_url,
            userId: p.users.id,
            createdAt: new Date(p.created_at),
            likesCount: p.likes[0].count,
            commentsCount: p.comments[0].count,
            score: 100 // Default score
          }));
          applyFilters();
      } else {
        postsList.innerHTML = `<p class="no-results">Error calculating feed</p>`;
      }
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
