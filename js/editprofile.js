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
  originalUsername = profile?.name || ""; // Store for validation check
  bioInput.value = profile?.bio || "";
  updateBioCount();
  
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
  
  if (!isUsernameValid) {
      alert("❌ Please fix usage errors before saving.");
      return;
  }

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

// Character Counter Logic
const bioCount = document.getElementById("bio-count");

function updateBioCount() {
  const currentLength = bioInput.value.length;
  bioCount.textContent = `${currentLength}/150`;
  
  if (currentLength >= 150) {
    bioCount.style.color = "#ff5722"; // Brand color or warning color
  } else {
    bioCount.style.color = ""; // Reset
  }
}

bioInput.addEventListener("input", updateBioCount);

// Username Validation Logic
const usernameFeedback = document.getElementById("username-feedback");
let isUsernameValid = true;
let originalUsername = ""; // Store original username to allow keeping own name


// Debounce function
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}



const checkUsername = debounce(async (e) => {
  const username = e.target.value.trim();
  
  if (username === originalUsername) {
      usernameFeedback.textContent = "";
      isUsernameValid = true;
      return;
  }

  if (username.length < 3) {
      usernameFeedback.textContent = "⚠️ Username must be at least 3 characters.";
      usernameFeedback.className = "validation-feedback error";
      isUsernameValid = false;
      return;
  }

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("name", username)
    .maybeSingle(); // Use maybeSingle to avoid errors on no-result

  if (data) {
    usernameFeedback.textContent = "❌ Username is already taken.";
    usernameFeedback.className = "validation-feedback error";
    isUsernameValid = false;
  } else {
    usernameFeedback.textContent = "✅ Username is available!";
    usernameFeedback.className = "validation-feedback success";
    isUsernameValid = true;
  }
}, 500);

usernameInput.addEventListener("input", checkUsername);






