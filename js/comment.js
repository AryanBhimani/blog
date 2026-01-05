import { supabase } from "./supabase/supabaseClient.js";

// Get URL parameters
const getQueryParam = (param) => new URLSearchParams(window.location.search).get(param);
const postId = getQueryParam("postId");

const postTitleEl = document.getElementById("post-title");
const postContentEl = document.getElementById("post-content");
const postMetaEl = document.getElementById("post-meta");
const commentFormContainer = document.getElementById("comment-form-container");
const commentInput = document.getElementById("comment-input");
const submitCommentBtn = document.getElementById("submit-comment");
const commentsListEl = document.getElementById("comments-list");

let currentUser = null;

// ----------------------------------------------------
// 1. CHECK USER & INIT
// ----------------------------------------------------
supabase.auth.getUser().then(({ data }) => {
  currentUser = data?.user;

  const formWrapper = document.getElementById("comment-form-wrapper");
  const loginPrompt = document.getElementById("login-prompt");

  if (currentUser) {
    formWrapper.style.display = "flex";
    loginPrompt.style.display = "none";
    
    // Set current user avatar in the input box
    supabase.from("users").select("avatar_url").eq("id", currentUser.id).single()
      .then(({data: uData}) => {
         if(uData?.avatar_url) {
             document.getElementById("current-user-avatar").src = uData.avatar_url;
         }
      });

  } else {
    formWrapper.style.display = "none";
    loginPrompt.style.display = "block";
  }

  // Load comments AFTER we check the user, so we know who owns which comment
  loadComments();
});

// ----------------------------------------------------
// 2. LOAD BLOG POST
// ----------------------------------------------------
async function loadPost() {
  if (!postId) return;

  const { data: post, error } = await supabase
    .from("posts")
    .select(`*, users ( name, avatar_url )`) // Fetch avatar
    .eq("id", postId)
    .single();

  if (error) {
    document.getElementById("post-title").textContent = "Post not found or deleted.";
    return;
  }

  // Populate Header
  document.getElementById("post-title").textContent = post.title;

  // -------------------------
  // SEO OPTIMIZATION
  // -------------------------
  document.title = `${post.title} | Blog.in`;
  
  // Strip HTML for description
  const cleanContent = post.content.replace(/<[^>]*>?/gm, '').substring(0, 150) + "...";
  
  const updateMeta = (key, value, isProp = false) => {
      let el = isProp 
        ? document.querySelector(`meta[property="${key}"]`) 
        : document.querySelector(`meta[name="${key}"]`);
      if (el) el.setAttribute("content", value);
  };

  updateMeta("description", `Read ${post.title} on Blog.in. ${cleanContent}`);
  
  // Open Graph
  updateMeta("og:title", post.title, true);
  updateMeta("og:description", cleanContent, true);
  updateMeta("og:url", window.location.href, true);
  
  // Twitter
  updateMeta("twitter:title", post.title, true);
  updateMeta("twitter:description", cleanContent, true);
  updateMeta("twitter:url", window.location.href, true);

  if (post.image_url) {
      updateMeta("og:image", post.image_url, true);
      updateMeta("twitter:image", post.image_url, true);
  }
  // -------------------------

  // Header Tags Injection
  let tags = post.tags;
  // Parse tags if string
  if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } 
      catch { 
          if(tags.startsWith('{')) tags = tags.slice(1,-1).split(',').map(t => t.replace(/"/g,''));
          else tags = tags.split(',').map(t=>t.trim()); 
      }
  }

  if(Array.isArray(tags) && tags.length > 0) {
      const tagsContainer = document.createElement("div");
      tagsContainer.className = "post-tags";
      tagsContainer.style.justifyContent = "center";
      tagsContainer.style.marginTop = "10px";
      
      tags.forEach(tag => {
          const span = document.createElement("span");
          span.className = "post-tag";
          span.style.fontSize = "0.9rem"; // slightly larger for article view
          span.textContent = `#${tag}`;
          tagsContainer.appendChild(span);
      });
      
      // Insert after title
      document.getElementById("post-title").insertAdjacentElement('afterend', tagsContainer);
  }
  document.getElementById("post-author-name").textContent = post.users?.name || "Unknown";
  document.getElementById("post-date").textContent = new Date(post.created_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
  });
  
  // Avatar
  const authorAvatar = post.users?.avatar_url;
  const avatarImg = document.getElementById("post-author-avatar");
  
  if (authorAvatar) {
     avatarImg.src = authorAvatar;
     avatarImg.style.display = 'block';
  } else {
     avatarImg.style.display = 'none';
     // Create placeholder
     const ph = document.createElement("div");
     ph.className = "article-author-placeholder";
     ph.textContent = (post.users?.name || "U").charAt(0);
     ph.onclick = (e) => {
         // Forward click to profile
         avatarImg.onclick(e);
     }
     avatarImg.parentNode.insertBefore(ph, avatarImg);
  }
  
  // Link to profile
  const profileLinkClickHandler = () => window.location.href = `profile.html?userId=${post.user_id}`;
  document.getElementById("post-author-name").onclick = profileLinkClickHandler;
  document.getElementById("post-author-avatar").onclick = profileLinkClickHandler;

  // Featured Image
  if (post.image_url) {
    document.getElementById("post-featured-image-container").innerHTML = 
        `<img src="${post.image_url}" class="article-featured-image" alt="${post.title}">`;
  }

  // Content
  let contentHtml = post.content;

  // 1. Convert Markdown links: [text](url) -> <a href="url">text</a>
  // We use a regex that looks for [text](url) pattern
  contentHtml = contentHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      return `<a href="${url}" target="_blank" style="color: var(--brand); text-decoration: underline;">${text}</a>`;
  });

  // 2. Convert raw newlines to <br> if the content doesn't appear to be rich HTML
  // (Simple check: if it lacks <p>, <div>, or <br> tags, assume it needs line breaks)
  if (!contentHtml.includes('<p>') && !contentHtml.includes('<div>') && !contentHtml.includes('<br>')) {
      contentHtml = contentHtml.replace(/\n/g, '<br>');
  }

  document.getElementById("post-content").innerHTML = contentHtml;
}

loadPost();


// ----------------------------------------------------
// 3. LOAD COMMENTS
// ----------------------------------------------------
async function loadComments() {
  const { data: comments, error } = await supabase
    .from("comments")
    .select(`
      id, content, created_at, user_id,
      users ( name, avatar_url )
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const listEl = document.getElementById("comments-list");

  if (error) return;
  if (!comments || comments.length === 0) {
    listEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No comments yet. Be the first!</p>`;
    return;
  }

  listEl.innerHTML = "";
  comments.forEach((c) => renderSingleComment(c));
}

function renderSingleComment(c) {
  const userName = c.users?.name || "User";
  const avatar = c.users?.avatar_url; 
  const dateStr = new Date(c.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'});
  const isOwner = currentUser && (currentUser.id === c.user_id);

  // Create Container
  const item = document.createElement("div");
  item.className = "comment-item";
  item.dataset.id = c.id;

  // Avatar HTML
  const avatarHTML = avatar 
    ? `<img src="${avatar}" class="comment-avatar-img" onclick="window.location.href='profile.html?userId=${c.user_id}'">`
    : `<div class="comment-author-placeholder" onclick="window.location.href='profile.html?userId=${c.user_id}'">${userName.charAt(0)}</div>`;

  // Content Box HTML
  item.innerHTML = `
      ${avatarHTML}
      <div class="comment-content-box">
          <div class="comment-meta-header">
             <a class="comment-author-link" onclick="window.location.href='profile.html?userId=${c.user_id}'">${escapeHtml(userName)}</a>
             
             <div class="comment-right-meta">
                 <span class="comment-date-display">${dateStr}</span>
                 ${isOwner ? `
                 <div class="comment-actions">
                     <button class="comment-action-btn edit-btn" title="Edit"><i class="fi fi-rr-edit"></i></button>
                     <button class="comment-action-btn delete-btn" title="Delete"><i class="fi fi-rr-trash"></i></button>
                 </div>
                 ` : ''}
             </div>
          </div>
          <div class="comment-body-text">${escapeHtml(c.content)}</div>
      </div>
  `;

  document.getElementById("comments-list").appendChild(item);

  // Attach Listeners if Owner
  if (isOwner) {
    const editBtn = item.querySelector(".edit-btn");
    const deleteBtn = item.querySelector(".delete-btn");

    editBtn.onclick = () => enableEditMode(item, c);
    deleteBtn.onclick = () => deleteComment(c.id, item);
  }
}

// ----------------------------------------------------
// EDIT FUNCTIONALITY
// ----------------------------------------------------
function enableEditMode(item, commentData) {
  // Prevent multiple forms
  if (item.querySelector(".comment-edit-form")) return;

  const contentBox = item.querySelector(".comment-body-text");
  const currentText = commentData.content; // Use data to avoid parsing HTML

  // Replace content with form
  contentBox.style.display = "none";
  
  const formHtml = `
    <div class="comment-edit-form">
        <textarea class="comment-edit-textarea">${escapeHtml(currentText)}</textarea>
        <div class="comment-edit-actions">
            <button class="btn-sm btn-cancel">Cancel</button>
            <button class="btn-sm comment-save-btn">Save</button>
        </div>
    </div>
  `;
  
  contentBox.insertAdjacentHTML('afterend', formHtml);
  
  const editForm = item.querySelector(".comment-edit-form");
  const textarea = editForm.querySelector("textarea");
  const saveBtn = editForm.querySelector(".comment-save-btn");
  const cancelBtn = editForm.querySelector(".btn-cancel");
  
  textarea.focus();

  // Cancel
  cancelBtn.onclick = () => {
    editForm.remove();
    contentBox.style.display = "block";
  };

  // Save
  saveBtn.onclick = async () => {
    const newContent = textarea.value.trim();
    if (!newContent) return alert("Content cannot be empty");
    
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    const { error } = await supabase
        .from("comments")
        .update({ content: newContent })
        .eq("id", commentData.id);

    if (error) {
        alert("Failed to update comment");
        saveBtn.textContent = "Save";
        saveBtn.disabled = false;
        return;
    }

    // Update Local Data (Optional: Realtime will handle it, but for instant UI feedback)
    commentData.content = newContent;
    contentBox.textContent = newContent; // Update visible text
    contentBox.style.display = "block";
    editForm.remove();
  };
}

// ----------------------------------------------------
// DELETE FUNCTIONALITY
// ----------------------------------------------------
async function deleteComment(id, item) {
    if(!confirm("Delete this comment?")) return;

    // Optimistic UI Removal
    item.style.opacity = "0.5";

    const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Failed to delete comment");
        item.style.opacity = "1";
        return;
    }

    item.remove();
    
    // Check if list empty
    const list = document.getElementById("comments-list");
    if(list.children.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No comments yet. Be the first!</p>`;
    }
}

// ----------------------------------------------------
// 4. REAL-TIME COMMENT UPDATES
// ----------------------------------------------------
supabase
  .channel("comments-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "comments" },
    async (payload) => {
      // HANDLE INSERT
      if (payload.eventType === 'INSERT') {
          if (String(payload.new.post_id) !== String(postId)) return;
          // Check if already exists (optimistic update might have added it? No, ours is simple)
          if(document.querySelector(`[data-id="${payload.new.id}"]`)) return;

          const { data: userData } = await supabase
            .from("users")
            .select("name, avatar_url")
            .eq("id", payload.new.user_id)
            .single();

          const newComment = payload.new;
          newComment.users = { 
              name: userData?.name, 
              avatar_url: userData?.avatar_url 
          };
          renderSingleComment(newComment);
      }
      
      // HANDLE DELETE
      if (payload.eventType === 'DELETE') {
           const item = document.querySelector(`[data-id="${payload.old.id}"]`);
           if(item) item.remove();
      }

      // HANDLE UPDATE
      if(payload.eventType === 'UPDATE') {
           const item = document.querySelector(`[data-id="${payload.new.id}"]`);
           if(item) {
               const contentEl = item.querySelector(".comment-body-text");
               if(contentEl) contentEl.textContent = payload.new.content;
           }
      }
    }
  )
  .subscribe();

// ----------------------------------------------------
// 5. SUBMIT COMMENT
// ----------------------------------------------------
submitCommentBtn.onclick = async () => {
  if (!currentUser) return alert("Please log in first!");

  const text = commentInput.value.trim();
  if (!text) return alert("Comment cannot be empty!");
  
  submitCommentBtn.disabled = true;
  submitCommentBtn.textContent = "Posting...";

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      user_id: currentUser.id,
      content: text,
    })
    .select(`*, users(name, avatar_url)`) // Try fetch user right away
    .single();

  submitCommentBtn.disabled = false;
  submitCommentBtn.textContent = "Post";

  if (error) {
    alert("Failed to post comment");
    return;
  }

  // Clear Input
  commentInput.value = "";
  
  // Clean empty message if first comment
  const listEl = document.getElementById("comments-list");
  if(listEl.querySelector("p")) listEl.innerHTML = "";

  // Render immediately (Realtime will also trigger, so check ID duplicates in renderSingleComment or handle gracefully)
  // Actually, realtime is robust. But for instant feel:
  // If we fetch user data in local insert return, use it.
  
  // We need user name/avatar for renderSingleComment
  // We can use currentUser for optimistic render
  const optimisticComment = {
      ...inserted,
      users: {
          name: currentUser.user_metadata?.name || "Me", // Fallback
          avatar_url: currentUser.user_metadata?.avatar_url
      }
  };
  
  // Wait, Supabase insert selection with relation might require proper foreign key setup which we have.
  // If 'inserted.users' is null (Supabase weirdness sometimes on insert select), fetch it or use currentUser
  if(!inserted.users) {
       // We can just rely on realtime, OR manually construct
       optimisticComment.users = {
           name: "Me", // Pending refresh
           avatar_url: null
       }
  }
  
  // Check if realtime already added it (rare race)
  if(!document.querySelector(`[data-id="${inserted.id}"]`)) {
      renderSingleComment(optimisticComment);
  }
};

// UTIL
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// ----------------------------------------------------
// 6. SOCIAL SHARE
// ----------------------------------------------------
window.sharePost = async (platform) => {
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(document.title);
  
  let shareUrl = "";

  switch (platform) {
      case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
          break;
      case 'linkedin':
          shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
          break;
      case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
          break;
      case 'whatsapp':
          shareUrl = `https://api.whatsapp.com/send?text=${title} ${url}`;
          break;
      case 'copy':
          try {
              await navigator.clipboard.writeText(window.location.href);
              alert("Link copied to clipboard!");
          } catch (err) {
              console.error('Failed to copy: ', err);
          }
          return;
  }
  
  if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
  }
};
