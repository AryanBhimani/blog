# <div align="center">Blog.in ✍️</div>

<div align="center">
  <h3>A Modern, Lightweight Blogging Platform</h3>
  <p>Built with Vanilla JavaScript, CSS, and Supabase</p>
  <a href="https://blog--in.vercel.app/">View Demo</a>
</div>

<br />

**Blog.in** is a sleek, responsive blogging application that allows users to share their thoughts, connect with others, and manage their content seamlessly. It features a complete authentication system, dynamic feeds, and real-time data handling powered by [Supabase](https://supabase.com/).

---

## 🚀 Features

### 🔐 Authentication & Accounts
- **Secure Sign Up & Login**: Powered by Supabase Auth (Email/Password).
- **Password Reset**: Secure email-based password recovery flow.
- **Profile Management**: Customize bio, avatar, and personal details.

### 📝 Content Management
- **Rich Blog Creation**: Create and edit blog posts with a clean interface.
- **Dynamic Feed**: Real-time fetching of latest posts from all users.
- **Search**: Find posts and users instantly.

### 🤝 Social Interaction
- **Follow System**: Follow your favorite authors to see their posts in your feed.
- **Comments**: Engage with content through a dynamic commenting system.
- **Likes**: (Coming Soon) Express appreciation for posts.

### 🎨 UI/UX
- **Responsive Design**: Fully optimized for mobile, tablet, and desktop.
- **Glassmorphism UI**: Modern aesthetic with translucent cards and animated backgrounds.
- **Dark Mode**: (In Progress) System-aware color themes.

---

## �️ Tech Stack

- **Frontend**:
  - HTML5 (Semantic Structure)
  - CSS3 (Custom Variables, Flexbox/Grid, Glassmorphism)
  - JavaScript (ES6+ Modules, Async/Await)
- **Backend**:
  - **Supabase Auth**: User management and session handling.
  - **Supabase Database**: PostgreSQL for storing posts, profiles, and comments.
  - **Supabase Storage**: (Optional) For hosting user avatars and post images.

---

## 📂 Project Structure

```bash
Blog.in/
├── assets/             # Static assets (images, icons)
├── components/         # Reusable HTML snippets (Navbar, Footer)
├── css/                # Styling files
│   ├── main.css        # Global variables and resets
│   ├── auth.css        # Login/Register styles
│   ├── feed.css        # Main feed layout
│   ├── profile.css     # User profile styles
│   └── ...             # Specific page styles
├── js/                 # Application logic
│   ├── supabase/       # Supabase configuration
│   │   └── supabaseClient.js
│   ├── auth.js         # Authentication logic
│   ├── feed.js         # Feed rendering
│   ├── profile.js      # Profile management
│   └── ...             # Feature-specific scripts
├── auth.html           # Login/Signup page
├── index.html          # Main landing/feed page
├── profile.html        # User profile page
├── post.html           # Create/View post page
└── ...                 # Other HTML pages
```

---

## ⚡ Getting Started

### Prerequisites
- A modern web browser.
- A [Supabase](https://supabase.com/) account.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/blog.in.git
   cd blog.in
   ```

2. **Configure Supabase**
   - Create a new project in Supabase.
   - Go to `Database` and create the following tables (or use the SQL editor):
     - `profiles` (id, username, full_name, avatar_url, bio, website)
     - `posts` (id, user_id, title, content, created_at)
     - `comments` (id, post_id, user_id, content, created_at)
     - `followers` (follower_id, following_id)

3. **Connect to Supabase**
   - Rename `js/supabase/supabaseClient.example.js` to `js/supabase/supabaseClient.js` (if strictly following a template, otherwise just edit the existing file).
   - Open `js/supabase/supabaseClient.js` and paste your project credentials:
     ```javascript
     const supabaseUrl = "https://your-project-url.supabase.co";
     const supabaseKey = "your-anon-key";
     export const supabase = createClient(supabaseUrl, supabaseKey);
     ```

4. **Run the App**
   - Use a local development server (e.g., [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for VS Code).
   - Open `index.html` in your browser.

---

## � Future Roadmap

- [ ] **Rich Text Editor**: Integrate a library like Quill.js or Tiptap.
- [ ] **Image Uploads**: Drag-and-drop image hosting via Supabase Storage.
- [ ] **Notifications**: Real-time alerts for likes and comments.
- [ ] **PWA Support**: Make the app installable on mobile devices.

---

<div align="center">
  <p>Made with ❤️ by the Blog.in Team</p>
</div>