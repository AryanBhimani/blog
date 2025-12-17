import { supabase } from "./supabase/supabaseClient.js";

const section = document.getElementById("create-post");
const titleInput = document.getElementById("post-title");
const tagsInput = document.getElementById("post-tags");
const imageInput = document.getElementById("main-image");
const submitBtn = document.getElementById("submit-post");
const pageTitle = document.getElementById("page-title");

// Edit Mode
const editId = new URLSearchParams(window.location.search).get("edit");
const isEdit = Boolean(editId);

// Quill
const quill = new Quill("#editor-container", {
  theme: "snow",
  placeholder: "Write something amazing...",
  modules: {
    toolbar: [
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"],
      ["clean"]
    ]
  }
});

// Auth
let user = null;
let mainImageUrl = null;

supabase.auth.getUser().then(async ({ data }) => {
  if (!data.user) return location.href = "auth.html";
  user = data.user;
  section.style.display = "block";

  if (isEdit) {
    pageTitle.textContent = "Edit Blog";
    submitBtn.textContent = "Update Blog";

    const { data: post } = await supabase
      .from("posts")
      .select("title, content, image_url, tags")
      .eq("id", editId)
      .eq("user_id", user.id)
      .single();

    if (!post) return location.href = "profile.html";

    titleInput.value = post.title;
    quill.setText(post.content);
    tagsInput.value = post.tags?.join(", ") || "";
    mainImageUrl = post.image_url;
  }
});

// Image Upload
imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;

  const name = `${Date.now()}_${file.name}`;
  await supabase.storage.from("blog-images").upload(name, file);
  const { data } = supabase.storage.from("blog-images").getPublicUrl(name);
  mainImageUrl = data.publicUrl;
});

// Save
submitBtn.onclick = async () => {
  const title = titleInput.value.trim();
  const content = quill.getText().trim();
  const tags = tagsInput.value.split(",").map(t => t.trim()).filter(Boolean);

  if (!title || !content) return alert("Title & content required");

  const payload = {
    title,
    content,
    tags,
    image_url: mainImageUrl,
    user_id: user.id
  };

  if (isEdit) {
    await supabase.from("posts").update(payload).eq("id", editId);
  } else {
    await supabase.from("posts").insert(payload);
  }

  location.href = "profile.html";
};
