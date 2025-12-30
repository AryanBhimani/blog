import { supabase } from "./supabase/supabaseClient.js";

// ---------------------------
// Get User ID from URL
// ---------------------------
let viewingUserId = new URLSearchParams(window.location.search).get("userId");

// UI Elements
const nameEl = document.getElementById("profile-name");
const bioEl = document.getElementById("profile-bio");
const editBtn = document.getElementById("edit-profile");
const followBtn = document.getElementById("follow-btn");
const loginBtn = document.getElementById("Login");
const postsList = document.getElementById("user-posts-list");
const followersCountEl = document.getElementById("followers-count");
const followingCountEl = document.getElementById("following-count");
const postCounterEl = document.getElementById("posts-count");
const settingsBtn = document.getElementById("settings-btn");

/* ✅ NEW (ADDED) */const savedBtn = document.getElementById("saved-posts-btn");
let showingSavedPosts = false;

// Redirect to settings page
if (settingsBtn) {
  settingsBtn.onclick = () => {
    window.location.href = "settings.html";
  };
}

/* ✅ NEW (ADDED) */
if (savedBtn) {
  savedBtn.onclick = () => {
    showingSavedPosts = !showingSavedPosts;
    document.querySelector("#user-posts h2").textContent =
      showingSavedPosts ? "🔖 Saved Blogs" : "📝 My Blogs";

    showingSavedPosts ? loadSavedPosts() : loadPosts(viewingUserId);
  };
}

// ---------------------------
// Clear UI for logged-out users
// ---------------------------
function clearUI() {
  nameEl.textContent = "Guest";
  bioEl.textContent = "Please login to view profile.";

  followersCountEl.textContent = "0";
  followingCountEl.textContent = "0";

  postsList.innerHTML = "<p>Please login to see posts.</p>";

  editBtn.style.display = "none";
  settingsBtn.style.display = "none";
  followBtn.style.display = "none";
  if (savedBtn) savedBtn.style.display = "none";
}

// ---------------------------
// AUTH STATE
// ---------------------------
supabase.auth.onAuthStateChange(async (_event, session) => {
  const user = session?.user || null;

  if (user) {
    loginBtn.textContent = "Logout";
    loginBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    };
  } else {
    loginBtn.textContent = "Login";
    loginBtn.onclick = () => (window.location.href = "auth.html");
  }

  if (!user && !viewingUserId) return clearUI();

  if (user && !viewingUserId) {
    viewingUserId = user.id;
    history.replaceState(null, "", `?userId=${user.id}`);
  }

  const isOwner = user && user.id === viewingUserId;

  editBtn.style.display = isOwner ? "inline-block" : "none";
  settingsBtn.style.display = isOwner ? "inline-block" : "none";
  if (savedBtn) savedBtn.style.display = isOwner ? "inline-block" : "none";
  followBtn.style.display = !isOwner && user ? "inline-block" : "none";

  document.getElementById("post").style.display = isOwner ? "inline-block" : "none";
  document.getElementById("Login").style.display = isOwner ? "inline-block" : "none";

  loadProfile(viewingUserId);
  loadFollowStats(viewingUserId);
  loadPosts(viewingUserId);

  if (user && !isOwner) initializeFollowButton(user.id, viewingUserId);

  // Initialize hidden lists or clear them if simpler
  const followingDiv = document.getElementById("following-users");
  const followersDiv = document.getElementById("followers-users");
  if (followingDiv) followingDiv.innerHTML = ""; // Clear loading state init
  if (followersDiv) followersDiv.innerHTML = "";
});

// ---------------------------
// Load Profile
// ---------------------------
async function loadProfile(uid) {
  const { data } = await supabase.from("users").select("*").eq("id", uid).single();
  if (!data) return;

  const emailEl = document.getElementById("profile-email");

  nameEl.textContent = data.name || "Unnamed User";
  if (emailEl) emailEl.textContent = data.email || "";
  bioEl.textContent = data.bio || "No bio yet.";

  // Avatar
  // Avatar
  const avatarContainer = document.querySelector(".profile-avatar");
  const avatarEl = document.getElementById("profile-avatar");
  
  // Remove any existing placeholder if re-rendering
  const existingPlaceholder = avatarContainer.querySelector(".avatar-placeholder");
  if(existingPlaceholder) existingPlaceholder.remove();

  if (data.avatar_url) {
    avatarEl.src = data.avatar_url;
    avatarEl.style.display = "block";
  } else {
    avatarEl.style.display = "none";
    
    // Create Placeholder
    const letter = (data.name || "U").charAt(0).toUpperCase();
    const placeholder = document.createElement("div");
    placeholder.className = "avatar-placeholder";
    placeholder.textContent = letter;
    avatarContainer.appendChild(placeholder);
  }
}

// ---------------------------
// Follow System (UNCHANGED)
// ---------------------------
async function initializeFollowButton(myId, theirId) {
  const isFollowing = await checkFollowing(myId, theirId);
  updateFollowButton(isFollowing);

  followBtn.onclick = async () => {
    const currentlyFollowing = await checkFollowing(myId, theirId);

    if (currentlyFollowing) {
      await supabase.from("followers").delete().match({
        follower: myId,
        following: theirId,
      });
    } else {
      await supabase.from("followers").insert({
        follower: myId,
        following: theirId,
      });
    }

    const updated = await checkFollowing(myId, theirId);
    updateFollowButton(updated);
    loadFollowStats(theirId);
  };
}

async function checkFollowing(myId, theirId) {
  const { data } = await supabase
    .from("followers")
    .select("*")
    .eq("follower", myId)
    .eq("following", theirId);

  return data && data.length > 0;
}

function updateFollowButton(state) {
  if (!followBtn) return;
  followBtn.textContent = state ? "Unfollow" : "Follow";
  followBtn.classList.toggle("unfollow", state);
}

// ---------------------------
// Follow Stats
// ---------------------------
async function loadFollowStats(uid) {
  const { data: followers } = await supabase.from("followers").select("*").eq("following", uid);
  const { data: following } = await supabase.from("followers").select("*").eq("follower", uid);

  if (followersCountEl) followersCountEl.textContent = followers?.length || 0;
  if (followingCountEl) followingCountEl.textContent = following?.length || 0;
  
  // Clear loading text from the lists
  const followingDiv = document.getElementById("following-users");
  const followersDiv = document.getElementById("followers-users");
  if (followingDiv) followingDiv.innerHTML = "";
  if (followersDiv) followersDiv.innerHTML = "";
}

// ----------------------------------------
// Load Posts (UNCHANGED)
// ----------------------------------------
async function loadPosts(uid) {
  const session = await supabase.auth.getSession();
  const loggedInUser = session.data.session?.user || null;

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, likes(count)")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) return;

  postCounterEl.textContent = posts.length;
  postsList.innerHTML = posts.length ? "" : "<p>No blogs yet</p>";

  posts.forEach((post) => {
    const isOwner = loggedInUser && loggedInUser.id === uid;

    const postCard = document.createElement("article");
    postCard.classList.add("post-card");
    
    // Format date
    const dateStr = new Date(post.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    postCard.innerHTML = `
      <div class="post-media" ${!post.image_url ? 'style="display:none;"' : ''}>
        ${post.image_url 
          ? `<img src="${post.image_url}" loading="lazy" alt="Post Image" />` 
          : ''
        }
      </div>
      <div class="post-content">
        <div class="post-meta">
          <span class="post-date"><i class="fi fi-rr-calendar"></i> ${dateStr}</span>
        </div>
        <h3><a href="comment.html?postId=${post.id}">${escapeHtml(post.title)}</a></h3>
        
        <div class="post-tags" style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
             ${(() => {
                const tags = parseTags(post.tags);
                return tags.length > 0
                ? tags.map(tag => `<span class="post-tag" style="font-size:0.75rem; color:#ff5722; background:rgba(255,87,34,0.1); padding:4px 10px; border-radius:20px; font-weight:600;">#${escapeHtml(tag)}</span>`).join('') 
                : '';
            })()}
        </div>

        <p>${escapeHtml(stripHtml(post.content).substring(0, 100))}...</p>
        <div class="post-footer">
          <div class="like-stat" style="display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 0.9rem;">
             <i class="fi fi-rr-heart" style="color: var(--brand);"></i> ${post.likes && post.likes[0] ? post.likes[0].count : 0}
          </div>
          <a href="comment.html?postId=${post.id}" class="read-more">Read Article <i class="fi fi-rr-arrow-small-right"></i></a>
        </div>
      </div>
    `;

    if (isOwner) {
      const actions = document.createElement("div");
      actions.classList.add("post-actions");

      actions.innerHTML = `
        <button class="edit-btn" title="Edit Post"><i class="fi fi-rr-edit"></i></button>
        <button class="delete-btn" title="Delete Post"><i class="fi fi-rr-trash"></i></button>
      `;

      actions.querySelector(".edit-btn").onclick = (e) => {
        e.stopPropagation(); // Prevent card click if we add one later
        editPost(post.id);
      };
      actions.querySelector(".delete-btn").onclick = (e) => {
         e.stopPropagation();
         deletePost(post.id);
      };

      // Append actions to the content area or absolute position them
      // For this design, let's put them absolute top-right in CSS, or append to card
      postCard.appendChild(actions);
    }
    
    postsList.appendChild(postCard);
  });
}

// ---------------------------
// ✅ NEW: Load Saved Posts (ADDED ONLY)
// ---------------------------
async function loadSavedPosts() {
  const session = await supabase.auth.getSession();
  const user = session.data.session?.user;
  if (!user) return;

  const { data } = await supabase
    .from("saved_posts")
    .select("posts(*, likes(count))")
    .eq("user_id", user.id);

  postsList.innerHTML = "";

  if (!data.length) {
    postsList.innerHTML = "<p>No saved posts</p>";
    return;
  }

  data.forEach(({ posts }) => {
    const card = document.createElement("article");
    card.className = "post-card";
    
    const dateStr = new Date(posts.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    card.innerHTML = `
      <div class="post-media" ${!posts.image_url ? 'style="display:none;"' : ''}>
        ${posts.image_url 
          ? `<img src="${posts.image_url}" loading="lazy" alt="Post Image" />`
          : ''
        }
      </div>
      <div class="post-content">
        <div class="post-meta">
          <span class="post-date"><i class="fi fi-rr-calendar"></i> ${dateStr}</span>
        </div>
        <h3><a href="comment.html?postId=${posts.id}">${escapeHtml(posts.title)}</a></h3>
        
        <div class="post-tags" style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
            ${(() => {
                const tags = parseTags(posts.tags);
                return tags.length > 0
                ? tags.map(tag => `<span class="post-tag" style="font-size:0.75rem; color:#ff5722; background:rgba(255,87,34,0.1); padding:4px 10px; border-radius:20px; font-weight:600;">#${escapeHtml(tag)}</span>`).join('') 
                : '';
            })()}
        </div>

        <p>${escapeHtml(stripHtml(posts.content).substring(0, 100))}...</p>
        <div class="post-footer">
          <div class="like-stat" style="display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 0.9rem;">
             <i class="fi fi-rr-heart" style="color: var(--brand);"></i> ${posts.likes && posts.likes[0] ? posts.likes[0].count : 0}
          </div>
           <a href="comment.html?postId=${posts.id}" class="read-more">Read Article <i class="fi fi-rr-arrow-small-right"></i></a>
        </div>
      </div>
    `;
    postsList.appendChild(card);
  });
}

// ---------------------------
// Delete Post (UNCHANGED)
// ---------------------------
async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;
  
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  
  if (error) {
      console.error("Delete error:", error);
      showToast("Failed to delete: " + error.message);
  } else {
      showToast("Post deleted successfully");
      loadPosts(viewingUserId);
  }
}

// ---------------------------
// Edit Post (UNCHANGED)
// ---------------------------
function editPost(postId) {
  window.location.href = `post.html?edit=${postId}`;
}

// ---------------------------
// VIEW SWITCHING (Tabs)
// ---------------------------
const postsStatBtn = document.getElementById('posts-stat');
const followersStatBtn = document.getElementById('followers-stat');
const followingStatBtn = document.getElementById('following-stat');

if (postsStatBtn) postsStatBtn.addEventListener('click', () => switchTab('posts'));
if (followersStatBtn) followersStatBtn.addEventListener('click', () => switchTab('followers'));
if (followingStatBtn) followingStatBtn.addEventListener('click', () => switchTab('following'));

async function switchTab(tabName) {
  // Hide all sections
  document.getElementById("user-posts").style.display = "none";
  document.getElementById("followers-list-section").style.display = "none";
  document.getElementById("following-list-section").style.display = "none";

  // Show selected
  if (tabName === 'posts') {
    document.getElementById("user-posts").style.display = "block";
  } else if (tabName === 'followers') {
    document.getElementById("followers-list-section").style.display = "block";
    await loadFollowersList();
  } else if (tabName === 'following') {
    document.getElementById("following-list-section").style.display = "block";
    await loadFollowingList();
  }
};

async function loadFollowersList() {
  const listEl = document.getElementById("followers-users");
  listEl.innerHTML = '<p>Loading...</p>';
  
  const { data: followers, error } = await supabase
    .from("followers")
    .select("follower, users!follower(*)") // Join with users table
    .eq("following", viewingUserId);

  listEl.innerHTML = "";
  if (error || !followers || followers.length === 0) {
    listEl.innerHTML = "<p>No followers yet.</p>";
    return;
  }

  followers.forEach(item => {
    // item.users is the user object of the follower
    renderUserCard(item.users, listEl);
  });
}

async function loadFollowingList() {
  const listEl = document.getElementById("following-users");
  listEl.innerHTML = '<p>Loading...</p>';

  const { data: following, error } = await supabase
    .from("followers")
    .select("following, users!following(*)") // Join with users table
    .eq("follower", viewingUserId);

  listEl.innerHTML = "";
  if (error || !following || following.length === 0) {
    listEl.innerHTML = "<p>Not following anyone yet.</p>";
    return;
  }

  following.forEach(item => {
    // item.users is the user object of the person being followed
    renderUserCard(item.users, listEl);
  });
}

function renderUserCard(user, container) {
  if (!user) return;
  const card = document.createElement("a");
  card.className = "user-list-item";
  card.href = `profile.html?userId=${user.id}`;
  
  const avatarUrl = user.avatar_url || "./assets/images/default-avatar.png";
  
  card.innerHTML = `
    ${avatarUrl !== "./assets/images/default-avatar.png" 
      ? `<img src="${avatarUrl}" class="user-avatar">`
      : `<div class="avatar-placeholder-sm">${escapeHtml(user.name).charAt(0).toUpperCase()}</div>`
    }
    <span>${escapeHtml(user.name)}</span>
    <div class="user-card-btn">View Profile</div>
  `;
  container.appendChild(card);
}

// ---------------------------
// UTIL: XSS Protection
// ---------------------------
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

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<i class="fi fi-rr-info"></i> ${escapeHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
