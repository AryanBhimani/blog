import { supabase } from "./supabase/supabaseClient.js";

const params = new URLSearchParams(window.location.search);
const userId = params.get("userId");

const followingList = document.getElementById("following-list");

// Load list of users this person follows
async function loadFollowing() {
  const { data: following, error } = await supabase
    .from("followers")
    .select("following")
    .eq("follower", userId);

  if (error) {
    followingList.innerHTML = "<p>Error loading following list.</p>";
    return;
  }

  if (!following.length) {
    followingList.innerHTML = "<p>Not following anyone.</p>";
    return;
  }

  let html = "";

  for (const f of following) {
    const fid = f.following;

    const { data: userData } = await supabase
      .from("users")
      .select("username, avatar_url")
      .eq("id", fid)
      .single();

    html += `
      <div class="user-list-item" 
           onclick="window.location.href='profile.html?userId=${fid}'">

        <img src="${userData?.avatar_url || './assets/images/default-avatar.png'}" 
             class="user-avatar" />

        <span>${userData?.username || "Unknown User"}</span>
      </div>
    `;
  }

  followingList.innerHTML = html;
}

loadFollowing();
