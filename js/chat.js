import { supabase } from "./supabase/supabaseClient.js";

// DOM Elements
const sidebarList = document.getElementById("chat-users-list");
const chatMessagesFn = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const msgInput = document.getElementById("message-input");
const chatHeaderName = document.getElementById("active-chat-name");

// State
let myUser = null;
let activeChatUserId = null;
let realtimeSubscription = null;

// Initialize
init();

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = "auth.html";
    return;
  }
  
  myUser = session.user;
  
  // Check URL for target user (e.g. coming from profile page)
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get("userId");
  
  if (targetId && targetId !== myUser.id) {
    activeChatUserId = targetId;
    // Load that user details immediately
    await selectUser(targetId);
  }

  // Load sidebar list
  loadSidebar();

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) window.location.href = "auth.html";
  });
}

// ------------------------------------------
// SIDEBAR: Load recent chat partners
// ------------------------------------------
async function loadSidebar() {
  // Fetch messages involving me
  // This is a naive implementation; for production, use a 'conversations' table or view
  const { data: sent } = await supabase
    .from("messages")
    .select("receiver_id, created_at, content")
    .eq("sender_id", myUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: received } = await supabase
    .from("messages")
    .select("sender_id, created_at, content")
    .eq("receiver_id", myUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Combine and find unique users
  const partnersMap = new Map();

  // Add partners from sent messages
  sent?.forEach(msg => {
    if (!partnersMap.has(msg.receiver_id)) {
      partnersMap.set(msg.receiver_id, { 
        id: msg.receiver_id, 
        lastMsg: "You: " + msg.content, 
        time: new Date(msg.created_at) 
      });
    }
  });

  // Add partners from received messages
  received?.forEach(msg => {
    const existing = partnersMap.get(msg.sender_id);
    const time = new Date(msg.created_at);
    
    if (!existing || time > existing.time) {
      partnersMap.set(msg.sender_id, { 
        id: msg.sender_id, 
        lastMsg: msg.content, 
        time: time 
      });
    }
  });

  // If activeChatUserId is set (from URL) but not in list, add it partially to fetch details
  if (activeChatUserId && !partnersMap.has(activeChatUserId)) {
      partnersMap.set(activeChatUserId, { id: activeChatUserId, lastMsg: 'Start a conversation', time: new Date() });
  }

  const partners = Array.from(partnersMap.values()).sort((a, b) => b.time - a.time);
  
  // Fetch User Details for these IDs
  if (partners.length === 0) {
    sidebarList.innerHTML = '<p style="padding:20px; text-align:center;">No conversations yet</p>';
    return;
  }

  const partnerIds = partners.map(p => p.id);
  const { data: users } = await supabase
    .from("users")
    .select("id, name, avatar_url")
    .in("id", partnerIds);
  
  const userMap = {};
  users?.forEach(u => userMap[u.id] = u);

  // Render Sidebar
  sidebarList.innerHTML = "";
  partners.forEach(p => {
    const u = userMap[p.id];
    if (!u) return;
    
    const div = document.createElement("div");
    div.className = `chat-user-item ${activeChatUserId === p.id ? "active" : ""}`;
    div.onclick = () => selectUser(p.id);

    const avatarUrl = u.avatar_url || "";
    const avatarHtml = avatarUrl 
       ? `<img src="${avatarUrl}" class="chat-user-avatar">`
       : `<div class="chat-user-placeholder">${u.name.charAt(0).toUpperCase()}</div>`;

    div.innerHTML = `
      ${avatarHtml}
      <div class="chat-user-info">
        <span class="chat-user-name">${escapeHtml(u.name)}</span>
        <span class="chat-last-message">${escapeHtml(p.lastMsg)}</span>
      </div>
    `;
    sidebarList.appendChild(div);
  });
}

// ------------------------------------------
// MAIN: Select User and Load Chat
// ------------------------------------------
async function selectUser(userId) {
  activeChatUserId = userId;
  
  // Update active class in sidebar if exists
  const items = document.querySelectorAll(".chat-user-item");
  items.forEach(el => el.classList.remove("active"));
  // Re-finding the element is tricky without ID, but loadSidebar updates it on refresh. 
  // Let's just visually respond if the list is already loaded, else it'll load eventually.
  
  // Show input form
  chatForm.style.display = "flex";
  
  // Fetch User Details for Header
  const { data: user } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", userId)
    .single();
    
  if (user) {
    chatHeaderName.textContent = user.name;
  }

  // Load Messages
  loadMessages(userId);

  // Subscribe to real-time changes
  subscribeToMessages();
}

// ------------------------------------------
// MESSAGES: Load and Render
// ------------------------------------------
async function loadMessages(partnerId) {
  chatMessagesFn.innerHTML = '<div class="loading-spinner"></div>';
  
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${myUser.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myUser.id})`)
    .order("created_at", { ascending: true });

  chatMessagesFn.innerHTML = "";
  
  if (error) {
    console.error(error);
    return;
  }

  if (!messages || messages.length === 0) {
    chatMessagesFn.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No messages yet. Say hi! 👋</p>';
    return;
  }

  messages.forEach(msg => {
    appendMessage(msg);
  });

  scrollToBottom();
}

function appendMessage(msg) {
  const isMe = msg.sender_id === myUser.id;
  
  const div = document.createElement("div");
  div.className = `message ${isMe ? "sent" : "received"}`;
  
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  div.innerHTML = `
    ${escapeHtml(msg.content)}
    <span class="message-time">${time}</span>
  `;
  
  chatMessagesFn.appendChild(div);
}

function scrollToBottom() {
  chatMessagesFn.scrollTop = chatMessagesFn.scrollHeight;
}

// ------------------------------------------
// SEND MESSAGE
// ------------------------------------------
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const content = msgInput.value.trim();
  if (!content || !activeChatUserId) return;
  
  msgInput.value = ""; // Clear input immediately
  
  // Optimistic update
  const fakeMsg = {
    sender_id: myUser.id,
    content: content,
    created_at: new Date().toISOString()
  };
  appendMessage(fakeMsg);
  scrollToBottom();

  const { error } = await supabase.from("messages").insert({
    sender_id: myUser.id,
    receiver_id: activeChatUserId,
    content: content
  });

  if (error) {
    console.error("Error sending:", error);
    // Ideally show error state on the message
  } else {
      // Refresh sidebar to update last message snippet
      loadSidebar(); 
  }
});

// ------------------------------------------
// REALTIME SUBSCRIPTION
// ------------------------------------------
function subscribeToMessages() {
  if (realtimeSubscription) supabase.removeChannel(realtimeSubscription);
  
  realtimeSubscription = supabase
    .channel('public:messages')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `receiver_id=eq.${myUser.id}` 
    }, (payload) => {
      const newMsg = payload.new;
      // If it's from the active chat user, append it
      if (newMsg.sender_id === activeChatUserId) {
        appendMessage(newMsg);
        scrollToBottom();
      } else {
        // If from someone else, maybe show a notification badge (TODO)
      }
      // Refresh sidebar to show new last message
      loadSidebar();
    })
    .subscribe();
}


// ------------------------------------------
// UTILS
// ------------------------------------------
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
