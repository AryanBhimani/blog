import { supabase } from "./supabase/supabaseClient.js";

const createSection = document.getElementById("create-post");
const postBtn = document.getElementById("submit-post");
const titleInput = document.getElementById("post-title");
const imageInput = document.getElementById("main-image");

// Get edit mode
const editId = new URLSearchParams(window.location.search).get("edit");
const isEdit = !!editId;

// Change title if editing
if (isEdit) {
  document.querySelector(".post-header h2").textContent = "✏️ Edit Blog";
  postBtn.textContent = "Update Blog";
}

// Initialize Quill
const quill = new Quill("#editor-container", {
  theme: "snow",
  placeholder: "Write your blog...",
  modules: {
    toolbar: {
      container: [
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"]
      ],
      handlers: {
        image: function () {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";

          input.onchange = () => {
            const file = input.files[0];
            if (file) uploadImage(file);
          };
          input.click();
        }
      }
    }
  }
});

// Upload image to Supabase Storage
async function uploadImage(file) {
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from("blog-images")
    .upload(fileName, file);

  if (error) {
    alert("❌ Failed to upload image");
    console.error(error);
    return;
  }

  const { data: publicURL } = supabase.storage
    .from("blog-images")
    .getPublicUrl(fileName);

  const range = quill.getSelection();
  quill.insertEmbed(range.index, "image", publicURL.publicUrl);
}

// Main image upload
let mainImageUrl = null;
imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;

  const fileName = `${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("blog-images").upload(fileName, file);
  if (error) return alert("❌ Failed to upload main image");

  const { data: publicURL } = supabase.storage.from("blog-images").getPublicUrl(fileName);
  mainImageUrl = publicURL.publicUrl;
});

// -------------------------------
// Check login
// -------------------------------
let currentUser = null;
supabase.auth.getUser().then(async ({ data }) => {
  const user = data?.user;
  if (!user) return (window.location.href = "auth.html");

  currentUser = user;
  createSection.style.display = "block";

  // Load existing post in edit mode
  if (isEdit) {
    const { data: post, error } = await supabase
      .from("posts")
      .select(`id, title, content, image_url, created_at, user_id, users(name)`)
      .eq("id", editId)
      .eq("user_id", user.id)
      .single();

    if (error || !post) return (window.location.href = "profile.html");

    titleInput.value = post.title;
    quill.root.innerHTML = post.content;
    mainImageUrl = post.image_url || null;
  }
});

// -------------------------------
// Create / Update Post
// -------------------------------
postBtn.onclick = async () => {
  if (!currentUser) return alert("Please login!");

  const title = titleInput.value.trim();
  const content = quill.root.innerHTML.trim();

  if (!title || content === "<p><br></p>") return alert("Please enter title and content!");

  if (isEdit) {
    // Update
    const { error } = await supabase
      .from("posts")
      .update({ title, content, image_url: mainImageUrl })
      .eq("id", editId)
      .eq("user_id", currentUser.id);

    if (error) return alert("❌ Error updating post!");
    alert("✅ Post updated!");
  } else {
    // Create
    const { error } = await supabase.from("posts").insert({
      user_id: currentUser.id,
      title,
      content,
      image_url: mainImageUrl
    });

    if (error) return alert("❌ Error publishing post!");
    alert("🎉 Blog published!");
  }

  window.location.href = "profile.html";
};
