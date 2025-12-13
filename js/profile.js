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

// Redirect to settings page
if (settingsBtn) {
  settingsBtn.onclick = () => {
    window.location.href = "settings.html";
  };
}

// Clear UI for logged-out users
function clearUI() {
  nameEl.textContent = "Guest";
  bioEl.textContent = "Please login to view profile.";

  followersCountEl.textContent = "0";
  followingCountEl.textContent = "0";

  postsList.innerHTML = "<p>Please login to see posts.</p>";

  editBtn.style.display = "none";
  settingsBtn.style.display = "none";
  followBtn.style.display = "none";
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
// Follow System
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
// Follow Stats
// ---------------------------
async function loadFollowStats(uid) {
  const { data: followers } = await supabase.from("followers").select("*").eq("following", uid);
  const { data: following } = await supabase.from("followers").select("*").eq("follower", uid);

  followersCountEl.textContent = followers.length;
  followingCountEl.textContent = following.length;
}

// ----------------------------------------
// Load Posts for User + Edit/Delete Actions
// ----------------------------------------
async function loadPosts(uid) {
  const session = await supabase.auth.getSession();
  const loggedInUser = session.data.session?.user || null;

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  postCounterEl.textContent = posts.length;

  if (!posts.length) {
    postsList.innerHTML = "<p>No blogs yet</p>";
    return;
  }

  postsList.innerHTML = "";

  posts.forEach((post) => {
    const isOwner = loggedInUser && loggedInUser.id === uid;

    const postCard = document.createElement("article");
    postCard.classList.add("post-card");
    postCard.innerHTML = `
      <h3>${post.title}</h3>
      <p>${post.content.substring(0, 150)}...</p>
      <small>${new Date(post.created_at).toLocaleString()}</small>
    `;

    // ACTION BUTTONS (Edit + Delete)
    if (isOwner) {
      const actions = document.createElement("div");
      actions.classList.add("post-actions");

      actions.innerHTML = `
        <button class="edit-btn">✏️ Edit</button>
        <button class="delete-btn">🗑 Delete</button>
      `;

      // Attach event listeners
      actions.querySelector(".edit-btn").addEventListener("click", () => {
        editPost(post.id);
      });

      actions.querySelector(".delete-btn").addEventListener("click", () => {
        deletePost(post.id);
      });

      postCard.appendChild(actions);
    }

    postsList.appendChild(postCard);
  });
}


// ---------------------------
// Delete a Post
// ---------------------------
async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    alert("Failed to delete post ❌");
    return;
  }

  alert("Post deleted successfully ✔");
  loadPosts(viewingUserId); 
}

// ---------------------------
// Edit a Post (redirect to edit page)
// ---------------------------
function editPost(postId) {
  window.location.href = `post.html?postId=${postId}`;
}

