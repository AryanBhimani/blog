import { supabase } from "./supabase/supabaseClient.js";

const editProfileForm = document.getElementById("editProfileForm");
const usernameInput = document.getElementById("username");
const bioInput = document.getElementById("bio");
const avatarInput = document.getElementById("avatar-upload");
const avatarPreview = document.getElementById("avatar-preview");

let currentUser = null;
let currentAvatarUrl = null;

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
  
  if (profile?.avatar_url) {
    currentAvatarUrl = profile.avatar_url;
    avatarPreview.src = profile.avatar_url;
  }
});

// Preview Image on Change
avatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    avatarPreview.src = URL.createObjectURL(file);
  }
});

// Handle profile update
editProfileForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const newUsername = usernameInput.value.trim();
  const newBio = bioInput.value.trim();
  let finalAvatarUrl = currentAvatarUrl;

  // 1. Upload Avatar if changed
  if (avatarInput.files.length > 0) {
    const file = avatarInput.files[0];
    const fileName = `avatar_${currentUser.id}_${Date.now()}`;
    
    // Upload to 'blog-images' bucket (reusing existing bucket)
    const { error: uploadError } = await supabase.storage
      .from("blog-images")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return alert("Error uploading avatar");
    }

    const { data } = supabase.storage.from("blog-images").getPublicUrl(fileName);
    finalAvatarUrl = data.publicUrl;
  }

  // 2. Update User Profile
  const { error } = await supabase
    .from("users")
    .update({
      name: newUsername,
      bio: newBio,
      avatar_url: finalAvatarUrl
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
