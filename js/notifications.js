import { supabase } from "./supabase/supabaseClient.js";

const notificationsList = document.getElementById("notifications-list");

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
    notificationsList.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--text-color);">Unable to load notifications at this time.</p>`;
    return;
  }

  renderNotifications(notifications);
}

function renderNotifications(notifications) {
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
    // Fallback for missing actor (e.g. deleted user)
    const actorName = notif.actor?.name || "Someone";
    const actorAvatar = notif.actor?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=random`;
    
    const isUnread = !notif.is_read ? "unread" : "";
    
    // Choose Icon
    let icon = "fi-rr-bell"; // default
    if (notif.type === 'follow') icon = "fi-rr-user-add";
    if (notif.type === 'post') icon = "fi-rr-document";

    // Construct URL
    // Use resource_url if available
    const linkUrl = notif.resource_url || "#";

    return `
      <a href="${linkUrl}" class="notification-item ${isUnread}" data-id="${notif.id}">
        <div class="notif-icon">
          <i class="fi ${icon}"></i>
        </div>
        <img src="${actorAvatar}" alt="${actorName}" class="notif-avatar">
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

// Initial Load
loadNotifications();
