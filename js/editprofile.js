import { supabase } from "./supabase/supabaseClient.js";

const editProfileForm = document.getElementById("editProfileForm");
const usernameInput = document.getElementById("username");
const bioInput = document.getElementById("bio");

let currentUser = null;

// Load logged-in user
supabase.auth.getUser().then(async ({ data }) => {
  const user = data?.user;

  if (!user) {
    alert("⚠️ Please login first!");
    window.location.href = "auth.html";
    return;
  }

  currentUser = user;

  // Load existing profile data
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  usernameInput.value = profile?.name || "";
  bioInput.value = profile?.bio || "";
});

// Handle profile update
editProfileForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const newUsername = usernameInput.value.trim();
  const newBio = bioInput.value.trim();

  const { error } = await supabase
    .from("users")
    .update({
      name: newUsername,
      bio: newBio,
    })
    .eq("id", currentUser.id);

  if (error) {
    alert("❌ Error updating profile");
    console.error(error);
    return;
  }

  alert("✅ Profile updated successfully!");
  window.location.href = "profile.html";
});
