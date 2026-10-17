<div align="center">

# ViniPlay

**A powerful, self-hosted IPTV player with a modern web interface.**

Stream your M3U playlists with EPG data, manage users, cast to your TV, and watch multiple channels at once.

Join my <a href="https://discord.gg/DXxvAw22Us">discord</a> to talk with the community.
<p>
    <img src="https://img.shields.io/badge/docker-ready-blue.svg?style=for-the-badge&logo=docker" alt="Docker Ready">
    <img src="https://img.shields.io/badge/platform-node-green.svg?style=for-the-badge&logo=node.js" alt="Node.js Backend">
</p>

</div>

---

ViniPlay transforms your M3U and EPG files into a polished, high-performance streaming experience. It's a full-featured IPTV solution that runs in a Docker container, providing a robust Node.js backend to handle streams and a sleek, responsive frontend for an exceptional user experience.

The server-side backend resolves common CORS and browser compatibility issues by proxying or transcoding streams with FFMPEG, while the feature-rich frontend provides a user experience comparable to premium IPTV services.

### Main User Interface Flow
![Main User Interface Flow](https://github.com/ardoviniandrea/ViniPlay/blob/main/images/viniplay-main%20ux-min.gif)

### Feature Snapshots

| TV Guide Page | Multi-View Page | Direct Player |
| :---: | :---: | :---: |
| ![TV Guide page](https://i.imgur.com/O7jk6X1.png) | ![Multi-View page](https://i.imgur.com/eE3R0Hr.png) <br> [View Animation](https://github.com/ardoviniandrea/ViniPlay/blob/main/images/multiview.gif) | ![Direct player](https://i.imgur.com/ftmxvss.png) |

| DVR & Recording | Admin Activity Monitoring | Push Notifications |
| :---: | :---: | :---: |
| ![DVR](https://i.imgur.com/XVhT1pH.png) <br> [View Animation](https://github.com/ardoviniandrea/ViniPlay/blob/main/images/DVR.gif) | ![Admin activity](https://i.imgur.com/4zaFF1v.png) | ![Notification](https://i.imgur.com/D4hFLoI.png) <br> [View Animation](https://github.com/ardoviniandrea/ViniPlay/blob/main/images/notification.gif) |

| Powerful Settings | Responsive Mobile View | Favorite Manager |
| :---: | :---: | :---: |
| ![Settings](https://i.imgur.com/FxOFq88.png) | ![Mobile TV Guide view](https://i.imgur.com/j8LjxSf.png) | ![Favorite manager](https://i.imgur.com/kKCnkFg.png) <br> [View Animation](https://github.com/ardoviniandrea/ViniPlay/blob/main/images/Favorites.gif) |


---

## ✨ Features

 - 👤 **Multi-User Management**: Secure the application with a dedicated admin account. Create, edit, and manage standard user accounts.
 - 📺 **Modern TV Guide**: A high-performance, virtualized EPG grid that handles thousands of channels and programs smoothly. Features include advanced search, channel favoriting, and a "Recents" category.
 - 🖼️ **Multi-View**: Drag, drop, and resize players on a grid to watch multiple streams simultaneously. Save and load custom layouts. "Immersive view" will hide all UI elements and only leave the players on the page to maximize the watching experience.
 - 🛜 **Chromecast Support**: Cast your streams directly to any Google Cast-enabled device on your network. (This will only work if your source signal is strong and correctly passed without package missing, due to Cast framework)
 - 🔔 **Push Notifications**: Set reminders for upcoming programs and receive push notifications in your browser, even when the app is closed.
 - ⚙️ **Powerful Transcoding - even with GPUs**: The backend uses FFMPEG to process streams, ensuring compatibility across all modern browsers and devices. Create custom stream profiles to tailor transcoding settings. GPU transcoding supported. (Nvidia, InterlQSV and Vaapi)
 - 📂 **Flexible Source Management**: Add M3U and EPG sources from either local files, XC code and remote URLs. Set automatic refresh intervals for URL-based sources to keep your guide data fresh.
 - 🚀 **High Performance UI**: The frontend is built with performance in mind, using UI virtualization for the guide and efficient state management to ensure a fast and responsive experience.
 - 🐳 **Dockerized Deployment**: The entire application is packaged in a single Docker container for simple, one-command deployment using Docker or Docker Compose.
 - ▶️ **Picture-in-Picture**: Pop out the player to keep watching while you work on other things.
 - 🎥 **DVR**: Record programs using FFMPEG. Schedule recording via the TV Guide, or set specific channels and time with ease.
 - 📽️ **Single player**: Play .m3u8 and .ts links directly from the browser, with detailed console logs and recorded history
 - 👥 **Admin monitoring page**: Monitor users watch stream in real time, store historical plays, and broadcast messages to all users.
 - 📺 **VODs support**: Play your VODs from your provider, divided cleanly in the UI with a scalable grid, with filters and tabs for Movies and Series (IMPORTANT: this only works with XC API log in).
 - 🎬 **Dedicated Full-Page VOD Details View**: Full cinematic page for movies and series (`/vod/details/:id`) featuring dynamic blurred backdrops, high-definition posters, metadata badges, movie progress bar, and interactive episode selectors.
 - ⭐ **Favorites Management**: Star favorite live TV channels as well as movies and series, accessible directly from the Dashboard and catalog filters.
 - ⏯️ **Playback Tracking & Next Episode**: Real-time watch history tracking, exact resume positions, current playback time display, and one-click "Next Episode" button during series streaming.
 - 🧭 **Quick Dashboard Access**: Access the personal dashboard directly by clicking the brand logo or application name.
 - 👤 **Unified User Dropdown Menu**: Clean profile button with user initials avatar and dropdown menu for session management and dashboard shortcut.
 - 📱 **Adaptive & Responsive Layout**: Fluid responsive design that adapts gracefully to mobile devices, tablets, split-screen desktop windows, and widescreen monitors with no horizontal clipping.
 - 📊 **Personalized Dashboard & Watch Progress**: Dedicated home hub featuring starred favorite live channels, "Continue Watching" cards with exact resume timestamps for movies, and a series progress summary tracker.
 - 🌐 **Customizable Base Path (`BASE_PATH`)**: Run ViniPlay under any custom subpath (e.g., `/viniplay` or `/iptv`) or directly at the root domain (`/`), with full reverse proxy and HTTPS support.
---

## ⚡ Custom Enhancements (`feature/custom-features`)

This branch introduces several core improvements designed for reverse proxy environments, modern user interfaces, and enhanced playback tracking:

### 1. Customizable Base Path & Reverse Proxy Support
- **Optional Subpath**: Set `BASE_PATH=/viniplay` in `.env` or Docker to host ViniPlay under a subpath, or leave it empty/unset to host at domain root (`/`).
- **Reverse Proxy Compatibility**: Automatic header handling for `X-Forwarded-Prefix`, `X-Forwarded-Proto`, and Express `trust proxy` support for HTTPS.
- **Unified Routing Helper**: Client-side `withBase` / `basePath.js` ensures all API calls, stream endpoints, WebSockets, service workers, and static assets resolve correctly.

### 2. Personalized Dashboard Hub
- **Favorite Channels**: Top panel with instant access to your starred live TV channels.
- **Continue Watching (Movies)**: Tracks exact playback timestamps and completion percentages, allowing instant one-click resume.
- **Series In-Progress Summary**: Displays active series with episode progress (e.g. `12 / 24 vistos`) and resume button for the next episode.
- **Favorite Movies & Series Section**: Dedicated grid highlighting starred VOD items with quick tabs for All, Movies, and Series.

### 3. Dedicated Full-Page VOD Details (`/vod/details/:id`)
- **Cinematic Experience**: Replaced the previous modal popup with a dedicated full-page layout.
- **Dynamic Backdrop**: High-resolution backdrop image with subtle blur and gradients matching the movie or series.
- **Metadata Badges**: Quick information tags for format type, release year, runtime duration, genre, and rating.
- **Movie Playback Controls**: Visual progress bar indicating percentage watched and elapsed time, with buttons to resume or restart from the beginning.
- **Interactive Series Episode Guide**: Season selector with episode cards displaying titles, runtimes, and play buttons.

### 4. VOD Favorites System
- **One-Click Favoriting**: Star (★) button available on cards across the catalog, in the details page, and on the dashboard.
- **Catalog Filter**: Quick "★ Favoritos" tab in the VOD library to display all saved favorites.
- **Persistent Storage**: Favorites persist per user account in backend storage.

### 5. Advanced Player Controls & Next Episode Flow
- **Current Elapsed Time**: Real-time counter on the player header displaying exact stream time and total duration.
- **Next Episode Button**: In series playback, a dedicated "Next Episode" button appears in the player header and on-screen overlay whenever a consecutive episode exists.
- **Automatic Progress Sync**: Regular background synchronization with the server keeps progress accurate across sessions and devices.

### 6. Quick Dashboard Navigation & Unified User Menu
- **First Navigation Item**: "Dashboard" is positioned at the start of both desktop and mobile navigation menus for immediate access.
- **Brand Logo Navigation**: Clicking the "VINI PLAY" logo/text navigates directly to the Dashboard (`/dashboard`).
- **Unified User Dropdown Component**:
  - Compact profile pill button displaying an avatar badge with the user's initial and username.
  - Smooth dropdown menu with account indicator ("Signed in as <user>"), shortcut to "Dashboard", and distinct "Logout" action.
  - Accessible keyboard navigation (Enter, Space, Escape) and automatic dismissal when clicking outside.

### 7. Responsive & Adaptive UI Design
- **Adaptive Filter Bars**: Updated `#vod-filter-bar` and `#unified-guide-header` to transition from 2-row layouts on tablets/mobile to 1-row on desktop (`lg:flex-row`), preventing search inputs and toggles from clipping off-screen.
- **Elastic Input Fields**: Category select and search inputs adjust proportionally (`flex-1 min-w-[140px]`) to available viewport width.
- **Horizontal Scrollable Pills**: Category buttons support touch scrolling (`overflow-x-auto no-scrollbar`) on compact screens.
- **Native CSS Pagination**: Rebuilt `.pagination-btn` in standard CSS to guarantee cross-browser compatibility, uniform spacing, active states, and adjacent page numbers (e.g. `1 ... 4 5 6 ... 383`).

### 8. VOD Stream Stability & Transcoding Optimizations
- **FFmpeg Resilience**: Injected `-reconnect`, `-reconnect_streamed`, and `-re` parameters to prevent connection drops, buffer underruns, and desync on remote streams.
- **Container Format Auto-Fallback**: Automatically selects FFmpeg transcoding when container formats (MKV, MP4, AVI) are played under redirect profiles.
- **Configurable VOD Settings**: Custom sync interval (default 5s) and minimum watch threshold configurable from Settings.

### 9. Integration with [ambiente-docker](https://github.com/developertechruna/ambiente-docker)
This branch is tailored to integrate with the Docker deployment ecosystem in [developertechruna/ambiente-docker](https://github.com/developertechruna/ambiente-docker):
- **Centralized Reverse Proxy**: Aligns with the Nginx configurations located in `manifests/viniplay/`, enabling ViniPlay to coexist under the `/viniplay` subpath alongside multiple services without port collisions or domain fragmentation.
- **Header Synchronization**: Consumes `X-Forwarded-Prefix`, `X-Forwarded-Proto`, and WebSocket upgrade headers provided by the `ambiente-docker` proxy stack to ensure seamless video streaming, API proxying, and push notification delivery.
- **Ready-to-Use Docker Stack**: Works out-of-the-box with the Compose manifests, automated network policies, and persistent storage layouts defined in the `ambiente-docker` repository.
---


## 🚀 Getting Started

ViniPlay is designed for easy deployment using Docker.

### Prerequisites

-   Docker
-   Docker Compose (Recommended)
    
### Method 1: Using `docker-compose` (Recommended)

1.  **Create Project Files:** Create a directory for your ViniPlay setup and add a `docker-compose.yml` and a `.env` file.
    
    -   `docker-compose.yml`:
        
        ```
        version: "3.8"
        services:
          viniplay:
            image: ardovini/viniplay:latest
            container_name: viniplay
            ports:
              - "8998:8998"
            restart: unless-stopped
            volumes:
              - ./viniplay-data:/data
            env_file:
              - ./.env
        
        ```
        
    -   `.env`:
        
        ```
        # Replace this with a long, random, and secret string
        SESSION_SECRET=your_super_secret_session_key_here

        # (Optional) Subpath routing for reverse proxies (e.g. /viniplay or /iptv). Leave empty for root domain (/).
        BASE_PATH=
        ```
        
        > **Security Note:** Your `SESSION_SECRET` should be a long, random string to properly secure user sessions.
    
2.  **Build and Run the Container:**
    
    ```
    docker-compose up --build -d
    
    ```

### Method 2: Using `docker`

1.  **Build the Image:**
    
    ```
    docker build -t viniplay .
    
    ```
    
2.  **Run the Container:** Create a volume directory (`mkdir viniplay-data`) and a `.env` file first. Then run the container:
    
    ```
    docker run -d \
      -p 8998:8998 \
      --name viniplay \
      --env-file ./.env \
      -v "$(pwd)/viniplay-data":/data \
      viniplay
    
    ```
    
### First-Time Setup

Once the container is running, open your browser and navigate to `http://localhost:8998` (or `http://localhost:8998/your_base_path`). You will be prompted to create your initial **admin account**. After creating the admin account, you can log in and start configuring your sources in the **Settings** tab.

---
## 🔧 Configuration

All configuration is done via the web interface in the **Settings** tab.

-   **Data Sources:** Add your M3U and EPG sources from remote URLs, XC Codes, uploaded files.
-   **Processing:** After adding sources, click the **Process Sources & View Guide** button to download, parse, and merge all your data.
-   **Player Settings:** Manage User-Agent strings and define `ffmpeg` stream profiles.
-   **User Management (Admin):** Admins can create, edit, and delete user accounts.

---
## 🏗️ Project Structure

The project is organized into a Node.js backend and a modular vanilla JavaScript frontend.

```
/
├── public/                          # Frontend static files
│   ├── js/
│   │   ├── main.js                  # Main application entry point
│   │   └── modules/                 # Modular JS components for each feature
│   │       ├── api.js               # Backend API communication
│   │       ├── auth.js              # Authentication flow
│   │       ├── basePath.js          # Dynamic subpath resolution (withBase)
│   │       ├── cast.js              # Google Cast logic
│   │       ├── dashboard.js         # Dashboard hub (Favorites, Continue Watching, Series)
│   │       ├── dvr.js               # DVR logic
│   │       ├── guide.js             # TV Guide logic & rendering
│   │       ├── multiview.js         # Multi-View grid and players
│   │       ├── notification.js      # Push notification management
│   │       ├── player.js            # Video player (mpegts.js)
│   │       ├── player_direct.js     # Direct stream player
│   │       ├── settings.js          # Settings page logic
│   │       ├── state.js             # Shared application state
│   │       ├── ui.js                # Global UI functions (modals, routing, etc.)
│   │       ├── utils.js             # Utility functions (parsers)
│   │       ├── vod.js               # VOD grid, details modal, and seasons
│   │       └── watchTracker.js      # Playback progress tracking & resume sync
│   ├── sw.js                        # Service Worker for push notifications
│   └── index.html                   # Main HTML file
│
├── server.js                        # Node.js backend (Express.js)
├── Dockerfile                       # Docker build instructions
├── docker-compose.yml               # Docker Compose configuration
├── package.json                     # Node.js dependencies
└── .env                             # Environment variables (e.g., SESSION_SECRET, BASE_PATH)

```

---
## 🏗️ Roadmap

Upcoming features and fixes include:

-   Add VODs support for M3U links and File uploads  
-   Making DVR .ts files seekable during recording.
-   Storing logos to improve load time.
-   Implementing full horizontal scroll in the TV Guide.

---
## ⚖️ License

ViniPlay is licensed under **CC BY-NC-SA 4.0**:

- **BY**: Give credit where credit’s due.
- **NC**: No commercial use.
- **SA**: Share alike if you remix.

For full license details, see [LICENSE](https://creativecommons.org/licenses/by-nc-sa/4.0/).
