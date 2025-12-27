import { supabase } from "./supabase/supabaseClient.js";

const params = new URLSearchParams(window.location.search);
const userId = params.get("userId");

const followersList = document.getElementById("followers-list");

// Load list of followers
async function loadFollowers() {
  const { data: followers, error } = await supabase
    .from("followers")
    .select("follower")
    .eq("following", userId);

  if (error) {
    followersList.innerHTML = "<p>Error loading followers.</p>";
    return;
  }

  if (!followers.length) {
    followersList.innerHTML = "<p>No followers yet.</p>";
    return;
  }

  let html = "";

  for (const f of followers) {
    const fid = f.follower;

    const { data: userData } = await supabase
      .from("users")
      .select("name, avatar_url")
      .eq("id", fid)
      .single();

    html += `
      <div class="user-list-item" 
           onclick="window.location.href='profile.html?userId=${fid}'">
        
        <img src="${userData?.avatar_url || './assets/images/default-avatar.png'}" 
             class="user-avatar" />

        <span>${userData?.name || "Unknown User"}</span>
      </div>
    `;
  }

  followersList.innerHTML = html;
}

loadFollowers();
