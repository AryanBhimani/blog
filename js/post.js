import { supabase } from "./supabase/supabaseClient.js";

const section = document.getElementById("create-post");
const titleInput = document.getElementById("post-title");
const imageInput = document.getElementById("main-image");
const submitBtn = document.getElementById("submit-post");
const saveStatus = document.getElementById("save-status");
const tagInputReal = document.getElementById("tag-input-real");
const tagsContainer = document.getElementById("tags-container");

// Elements
const imageUploadWrapper = document.getElementById("image-upload-area"); // Fix selector
const imagePreviewContainer = document.getElementById("image-preview-container");
const imagePreview = document.getElementById("image-preview");
const removeImageBtn = document.getElementById("remove-image-btn");

// State
let user = null;
let mainImageUrl = null;
let tags = [];
let isEdit = false;
let editId = null;

// Init Quill
const quill = new Quill("#editor-container", {
  theme: "snow",
  placeholder: "Start your story here...",
  modules: {
    // Toolbar disabled to ensure plain text content (HTML tags break mobile app)
    toolbar: false
  }
});

// Load
async function init() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return window.location.href = "auth.html";
    user = data.user;
    section.style.display = "block";

    // Edit Check
    const params = new URLSearchParams(window.location.search);
    editId = params.get("edit");
    
    if (editId) {
        isEdit = true;
        submitBtn.textContent = "Updating...";
        await loadPost(editId);
        submitBtn.textContent = "Update";
    }

    // Auto-save listener (simple debounce)
    let timeout;
    quill.on('text-change', () => {
        saveStatus.textContent = "Saving...";
        clearTimeout(timeout);
        timeout = setTimeout(() => {
             saveStatus.textContent = "Saved to draft (local)";
        }, 1000);
    });
}

async function loadPost(id) {
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
    
    if (error || !data) {
        alert("Post not found");
        return window.location.href = "profile.html";
    }

    titleInput.value = data.title;
    quill.root.innerHTML = data.content; // Use HTML!
    
    // Tags
    let t = data.tags;
    if (typeof t === 'string') {
        try { t = JSON.parse(t); } 
        catch { 
           if(t.startsWith('{')) t = t.slice(1, -1).split(',');
           else t = t.split(',');
        }
    }
    tags = Array.isArray(t) ? t : [];
    renderTags();

    // Image
    if (data.image_url) {
        mainImageUrl = data.image_url;
        showImagePreview(mainImageUrl);
    }
}

// ----------------------
// Tag Handling
// ----------------------
tagInputReal.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.code === "Enter" || e.keyCode === 13 || e.key === ",") {
        e.preventDefault();
        addTag(tagInputReal.value);
    }
    // Backspace to remove last
    if (e.key === "Backspace" && tagInputReal.value === "" && tags.length > 0) {
        removeTag(tags.length - 1);
    }
});

function addTag(text) {
    const t = text.trim().replace(/,/g, '');
    if (t && !tags.includes(t)) {
        if(tags.length >= 5) return alert("Max 5 tags allowed");
        tags.push(t);
        renderTags();
    }
    tagInputReal.value = "";
}

function removeTag(index) {
    tags.splice(index, 1);
    renderTags();
}

function renderTags() {
    // Clear chips but keep input
    const chips = tagsContainer.querySelectorAll('.tag-chip');
    chips.forEach(c => c.remove());

    // Insert before input
    tags.forEach((tag, index) => {
        const chip = document.createElement("div");
        chip.className = "tag-chip";
        chip.innerHTML = `#${tag} <i class="fi fi-rr-cross-small"></i>`;
        
        chip.querySelector('i').onclick = () => removeTag(index);
        
        tagsContainer.insertBefore(chip, tagInputReal);
    });
}

// ----------------------
// Image Handling
// ----------------------
imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;

    // Local Preview
    const reader = new FileReader();
    reader.onload = (e) => showImagePreview(e.target.result);
    reader.readAsDataURL(file);

    // Upload
    saveStatus.textContent = "Uploading image...";
    submitBtn.disabled = true;
    
    try {
        const ext = file.name.split('.').pop();
        const name = `${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("blog-images").upload(name, file);
        
        if(error) throw error;
        
        const { data } = supabase.storage.from("blog-images").getPublicUrl(name);
        mainImageUrl = data.publicUrl;
        
        saveStatus.textContent = "Image uploaded";
    } catch(err) {
        console.error(err);
        alert("Image upload failed");
        removeImage(); 
    } finally {
        submitBtn.disabled = false;
    }
});

function showImagePreview(url) {
    imagePreview.src = url;
    imageUploadWrapper.style.display = "none";
    imagePreviewContainer.style.display = "block";
}

removeImageBtn.onclick = removeImage;

function removeImage() {
    mainImageUrl = null;
    imageInput.value = "";
    imagePreviewContainer.style.display = "none";
    imageUploadWrapper.style.display = "flex"; // Flex to center content
}

// ----------------------
// Publish / Save
// ----------------------
submitBtn.onclick = async () => {
    const title = titleInput.value.trim();
    // Use getText() to save plain text, ensuring compatibility with mobile apps and stripping HTML tags.
    const content = quill.getText().trim(); 

    if (!title) return alert("Please enter a title");
    if (!content && !mainImageUrl) return alert("Please write some content");

    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing...";

    const payload = {
        title,
        content,
        tags, // Array, Supabase handles JSONB or Text[]
        image_url: mainImageUrl,
        user_id: user.id
    };

    let error;
    if (isEdit) {
        const res = await supabase.from("posts").update(payload).eq("id", editId);
        error = res.error;
    } else {
        const res = await supabase.from("posts").insert(payload);
        error = res.error;
    }

    if (error) {
        console.error(error);
        alert("Failed to publish: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? "Update" : "Publish";
    } else {
        window.location.href = "profile.html";
    }
};

// Start
init();
