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

  if (currentUser) {
    commentFormContainer.style.display = "block";
  } else {
    commentFormContainer.style.display = "none";
    commentsListEl.insertAdjacentHTML(
      "beforebegin",
      `<p class="login-prompt">
        <a href="auth.html">Log in</a> to post a comment.
      </p>`
    );
  }
});

// ----------------------------------------------------
// 2. LOAD BLOG POST
// ----------------------------------------------------
async function loadPost() {
  if (!postId) return;

  const { data: post, error } = await supabase
    .from("posts")
    .select(`
      *,
      users ( name )
    `)
    .eq("id", postId)
    .single();

  if (error) {
    console.error("Error loading post:", error);
    postTitleEl.textContent = "Post not found.";
    return;
  }

  postTitleEl.textContent = post.title;
  postContentEl.innerHTML = post.content;

  // CLICKABLE AUTHOR
  postMetaEl.innerHTML = `
    <span class="post-author"
          onclick="window.location.href='profile.html?userId=${post.user_id}'"
          style="cursor:pointer; font-weight:600; color:#ff5722;">
      ${post.users?.name || "Unknown User"}
    </span> 
    • ${new Date(post.created_at).toLocaleDateString()}
  `;
}

loadPost();

// ----------------------------------------------------
// 3. LOAD COMMENTS
// ----------------------------------------------------
async function loadComments() {
  const { data: comments, error } = await supabase
    .from("comments")
    .select(`
      id,
      content,
      created_at,
      user_id,
      users ( name )
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    commentsListEl.innerHTML = "<p>Error loading comments</p>";
    return;
  }

  if (comments.length === 0) {
    commentsListEl.innerHTML = "<p>Be the first to comment!</p>";
    return;
  }

  commentsListEl.innerHTML = "";

  comments.forEach((c) => renderSingleComment(c));
}

function renderSingleComment(c) {
  const userName = c.users?.name || "Unknown User";

  const html = `
    <div class="comment-card">
      <p>
        <strong class="comment-username"
                onclick="window.location.href='profile.html?userId=${c.user_id}'"
                style="cursor:pointer; color:#ff5722;">
          ${userName}
        </strong>: ${c.content}
      </p>
      <small>${new Date(c.created_at).toLocaleString()}</small>
    </div>
    <hr>
  `;

  commentsListEl.insertAdjacentHTML("beforeend", html);
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
        .select("name")
        .eq("id", newComment.user_id)
        .single();

      newComment.users = { name: userData?.name };

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

  // Fetch user name
  const { data: userData } = await supabase
    .from("users")
    .select("name")
    .eq("id", currentUser.id)
    .single();

  inserted.users = { name: userData?.name };

  renderSingleComment(inserted);
  commentInput.value = "";
};
