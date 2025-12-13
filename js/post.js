import { supabase } from "./supabase/supabaseClient.js";

const createSection = document.getElementById("create-post");
const postBtn = document.getElementById("submit-post");
const titleInput = document.getElementById("post-title");

// Get edit mode
const editId = new URLSearchParams(window.location.search).get("edit");
const isEdit = !!editId;

// Change title if editing
if (isEdit) {
  document.querySelector("#create-post h2").textContent = "✏️ Edit Blog";
  postBtn.textContent = "Update Blog";
}

// -------------------------------
//  INITIALIZE QUILL + IMAGE UPLOAD
// -------------------------------
const quill = new Quill("#editor-container", {
  theme: "snow",
  placeholder: "Write your blog...",
  modules: {
    toolbar: {
      container: [
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],   // ENABLE IMAGE BUTTON
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

  // Insert image into editor
  const range = quill.getSelection();
  quill.insertEmbed(range.index, "image", publicURL.publicUrl);
}

let currentUser = null;

// -------------------------------
//  CHECK LOGIN (SUPABASE)
// -------------------------------
supabase.auth.getUser().then(async ({ data }) => {
  const user = data?.user;

  if (!user) return (window.location.href = "auth.html");

  currentUser = user;
  createSection.style.display = "block";

  // Load existing post in edit mode
  if (isEdit) {
    const { data: post } = await supabase
      .from("posts")
      .select("*")
      .eq("id", editId)
      .eq("user_id", user.id)
      .single();

    if (!post) return (window.location.href = "profile.html");

    titleInput.value = post.title;
    quill.root.innerHTML = post.content;
  }
});

// -------------------------------
//  CREATE / UPDATE POST
// -------------------------------
postBtn.onclick = async () => {
  if (!currentUser) return alert("Please login!");

  const title = titleInput.value.trim();
  const content = quill.root.innerHTML.trim(); // IMPORTANT: store HTML with images

  if (!title || content === "<p><br></p>") {
    return alert("Please enter title and content!");
  }

  if (isEdit) {
    // Update
    const { error } = await supabase
      .from("posts")
      .update({ title, content })
      .eq("id", editId)
      .eq("user_id", currentUser.id);

    if (error) {
      alert("❌ Error updating post!");
      console.error(error);
      return;
    }

    alert("✅ Post updated!");
  } else {
    // Create new post
    const { error } = await supabase.from("posts").insert({
      user_id: currentUser.id,
      title,
      content,
    });

    if (error) {
      alert("❌ Error publishing post!");
      console.error(error);
      return;
    }

    alert("🎉 Blog published!");
  }

  window.location.href = "profile.html";
};
