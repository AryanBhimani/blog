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
// 1. CHECK USER
// ----------------------------------------------------
supabase.auth.getUser().then(({ data }) => {
  currentUser = data?.user;

  const formWrapper = document.getElementById("comment-form-wrapper");
  const loginPrompt = document.getElementById("login-prompt");

  if (currentUser) {
    formWrapper.style.display = "flex";
    loginPrompt.style.display = "none";
    
    // Set current user avatar in the input box
    // Fetch profile to get avatar
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
});

// ----------------------------------------------------
// 2. LOAD BLOG POST
// ----------------------------------------------------
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
  document.getElementById("post-author-name").textContent = post.users?.name || "Unknown";
  document.getElementById("post-date").textContent = new Date(post.created_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
  });
  
  // Avatar
  const authorAvatar = post.users?.avatar_url || "./assets/images/default-avatar.png";
  document.getElementById("post-author-avatar").src = authorAvatar;
  
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
  document.getElementById("post-content").innerHTML = post.content;
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
  const avatar = c.users?.avatar_url || "./assets/images/default-avatar.png";
  const dateStr = new Date(c.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'});

  const html = `
    <div class="comment-item">
      <img src="${avatar}" class="comment-avatar-img" onclick="window.location.href='profile.html?userId=${c.user_id}'">
      <div class="comment-content-box">
        <div class="comment-meta-header">
           <a class="comment-author-link" onclick="window.location.href='profile.html?userId=${c.user_id}'">${userName}</a>
           <span class="comment-date-display">${dateStr}</span>
        </div>
        <div class="comment-body-text">${c.content}</div>
      </div>
    </div>
  `;

  document.getElementById("comments-list").insertAdjacentHTML("beforeend", html);
}
loadComments();

// ----------------------------------------------------
// 4. REAL-TIME COMMENT UPDATES
// ----------------------------------------------------
supabase
  .channel("comments-realtime")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "comments" },
    async (payload) => {
      const newComment = payload.new;
      if (String(newComment.post_id) !== String(postId)) return;

      const { data: userData } = await supabase
        .from("users")
        .select("name, avatar_url")
        .eq("id", newComment.user_id)
        .single();

      newComment.users = { 
          name: userData?.name, 
          avatar_url: userData?.avatar_url 
      };

      renderSingleComment(newComment);
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

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      user_id: currentUser.id,
      content: text,
    })
    .select()
    .single();

  if (error) {
    alert("Failed to post comment");
    return;
  }

  // Real-time subscription will handle rendering the new comment
  commentInput.value = "";
};
