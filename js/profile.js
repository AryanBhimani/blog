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

/* ✅ NEW (ADDED) */
const savedBtn = document.getElementById("saved-posts-btn");
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
});

// ---------------------------
// Load Profile
// ---------------------------
async function loadProfile(uid) {
  const { data } = await supabase.from("users").select("*").eq("id", uid).single();
  if (!data) return;

  nameEl.textContent = data.name || "Unnamed User";
  bioEl.textContent = data.bio || "No bio yet.";
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

  return data.length > 0;
}

function updateFollowButton(state) {
  followBtn.textContent = state ? "Unfollow" : "Follow";
  followBtn.classList.toggle("unfollow", state);
}

// ---------------------------
// Follow Stats (UNCHANGED)
// ---------------------------
async function loadFollowStats(uid) {
  const { data: followers } = await supabase.from("followers").select("*").eq("following", uid);
  const { data: following } = await supabase.from("followers").select("*").eq("follower", uid);

  followersCountEl.textContent = followers.length;
  followingCountEl.textContent = following.length;
}

// ----------------------------------------
// Load Posts (UNCHANGED)
// ----------------------------------------
async function loadPosts(uid) {
  const session = await supabase.auth.getSession();
  const loggedInUser = session.data.session?.user || null;

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) return;

  postCounterEl.textContent = posts.length;
  postsList.innerHTML = posts.length ? "" : "<p>No blogs yet</p>";

  posts.forEach((post) => {
    const isOwner = loggedInUser && loggedInUser.id === uid;

    const postCard = document.createElement("article");
    postCard.classList.add("post-card");
    postCard.innerHTML = `
      <h3>${post.title}</h3>
      <p>${post.content.substring(0,150)}...</p>
      <small>${new Date(post.created_at).toLocaleString()}</small>
    `;

    if (isOwner) {
      const actions = document.createElement("div");
      actions.classList.add("post-actions");

      actions.innerHTML = `
        <button class="edit-btn">✏️ Edit</button>
        <button class="delete-btn">🗑 Delete</button>
      `;

      actions.querySelector(".edit-btn").onclick = () => editPost(post.id);
      actions.querySelector(".delete-btn").onclick = () => deletePost(post.id);

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
    .select("posts(*)")
    .eq("user_id", user.id);

  postsList.innerHTML = "";

  if (!data.length) {
    postsList.innerHTML = "<p>No saved posts</p>";
    return;
  }

  data.forEach(({ posts }) => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.innerHTML = `
      <h3>${posts.title}</h3>
      <p>${posts.content.substring(0,150)}...</p>
    `;
    postsList.appendChild(card);
  });
}

// ---------------------------
// Delete Post (UNCHANGED)
// ---------------------------
async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;
  await supabase.from("posts").delete().eq("id", postId);
  loadPosts(viewingUserId);
}

// ---------------------------
// Edit Post (UNCHANGED)
// ---------------------------
function editPost(postId) {
  window.location.href = `post.html?postId=${postId}`;
}
