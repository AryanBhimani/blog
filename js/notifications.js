import { supabase } from "./supabase/supabaseClient.js";

const notificationsList = document.getElementById("notifications-list");
const clearAllBtn = document.getElementById("clear-all-btn");

// Date formatter
function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + " years ago";
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + " months ago";
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + " days ago";
  if (interval === 1) return "Yesterday";
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + " hours ago";
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + " mins ago";
  
  return "Just now";
}

async function loadNotifications() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  // Fetch notifications with actor details
  // Note: The select syntax relies on Supabase detecting the foreign key relationship.
  // We use the column name 'actor_id' which references 'users'.
  // However, sometimes Supabase requires the exact relationship naming.
  // If 'actor:users' doesn't work, we might need to adjust.
  // Standard syntax: select(`*, actor:actor_id(...)`) if relation name is clear.
  
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select(`
      *,
      actor:users!actor_id ( id, name, avatar_url )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching notifications:", error);
    if (clearAllBtn) clearAllBtn.style.display = 'none';
    notificationsList.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--text-color);">Unable to load notifications at this time.</p>`;
    return;
  }

  renderNotifications(notifications);
}

function renderNotifications(notifications) {
  if (clearAllBtn) {
    clearAllBtn.style.display = (notifications && notifications.length > 0) ? 'block' : 'none';
  }

  if (!notifications || notifications.length === 0) {
    notificationsList.innerHTML = `
      <div class="empty-notif">
        <i class="fi fi-rr-bell"></i>
        <p>No notifications yet.</p>
      </div>
    `;
    return;
  }

  notificationsList.innerHTML = notifications.map(notif => {
    // Fallback for missing actor
    const actorName = notif.actor?.name || "Someone";
    const actorAvatar = notif.actor?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=random`;
    
    const isUnread = !notif.is_read ? "unread" : "";
    
    // Choose Icon and Type Class
    let icon = "fi-rr-bell";
    let typeClass = "";
    
    if (notif.type === 'follow') {
        icon = "fi-rr-user-add";
        typeClass = "follow";
    } else if (notif.type === 'post') {
        // Disambiguate 'post' type based on message content
        if (notif.message && notif.message.toLowerCase().includes('liked')) {
            icon = "fi-rr-heart";
            typeClass = "like";
        } else if (notif.message && notif.message.toLowerCase().includes('comment')) {
            icon = "fi-rr-comment";
            typeClass = "comment";
        } else {
            icon = "fi-rr-document"; // Generic post notification
        }
    }

    // Construct URL
    let linkUrl = notif.resource_url;

    if (!linkUrl) {
        if (notif.type === 'follow') {
            const actorId = notif.actor?.id || notif.actor_id;
            if (actorId) linkUrl = `profile.html?userId=${actorId}`;
        } else if ((notif.type === 'post' || notif.type === 'like' || notif.type === 'comment') && notif.post_id) {
            linkUrl = `comment.html?postId=${notif.post_id}`;
        }
    }

    if (!linkUrl) linkUrl = "#";

    return `
      <a href="${linkUrl}" class="notification-item ${isUnread}" data-id="${notif.id}">
        <div class="notif-avatar-wrapper">
            <img src="${actorAvatar}" alt="${actorName}" class="notif-avatar">
            <div class="notif-badge ${typeClass}">
                <i class="fi ${icon}"></i>
            </div>
        </div>
        <div class="notif-content">
          <p class="notif-message">
            <strong>${actorName}</strong> ${notif.message}
          </p>
          <span class="notif-time">${timeAgo(notif.created_at)}</span>
        </div>
      </a>
    `;
  }).join("");

  // Add click handlers to mark as read
  document.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      // Don't prevent default, we want the link to work.
      // But we fire the update in background
      const id = item.getAttribute('data-id');
      const isUnread = item.classList.contains('unread');
      
      if (isUnread) {
        // Optimistic update
        item.classList.remove('unread');
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      }
    });
  });
}

// Clear All Event Listener
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear all notifications?")) return;

    const originalText = clearAllBtn.innerText;
    clearAllBtn.innerText = "Clearing...";
    clearAllBtn.disabled = true;

    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        throw new Error("No active session");
      }

      const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('user_id', session.user.id);

      if (error) throw error;
      
      // Success feedback
      notificationsList.innerHTML = `
        <div class="empty-notif">
          <i class="fi fi-rr-check-circle" style="color: var(--brand);"></i>
          <p>All notifications cleared!</p>
        </div>
      `;
      clearAllBtn.style.display = 'none';
      
    } catch (err) {
      console.error("Error clearing notifications:", err);
      if (err.message === "No active session") {
          window.location.href = "auth.html";
      } else {
          alert("Failed to clear notifications. Please try again.");
      }
    } finally {
      if (clearAllBtn) {
          clearAllBtn.innerText = originalText;
          clearAllBtn.disabled = false;
      }
    }
  });
}

// Initial Load
loadNotifications();
