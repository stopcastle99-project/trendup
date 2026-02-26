# **TrendUp: Real-time Global Trends Dashboard**

## **Overview**
TrendUp is a modern, high-performance web application that provides real-time Top 10 trends for various countries. Starting with South Korea and Japan, the platform is designed for global scalability, enabling easy addition of new regions. The service is optimized for Google AdSense approval through high-quality content presentation, SEO-friendly structure, and professional UI/UX.

## **Features & Capabilities**
- **Real-time Trend Tracking:** Dynamically updated Top 10 lists for supported countries.
- **Multi-country Support:** Easily switch between regions (KR, JP) with a scalable architecture.
- **Modern Web Components:** Encapsulated UI elements for trends, navigation, and data cards.
- **Responsive & Accessible:** Fully responsive design using modern CSS (Baseline) for all devices.
- **SEO & AdSense Optimized:** Proper semantic HTML, placeholder ad slots, and fast loading times.
- **3D Interactive Background:** Subtle 3D effects (Three.js) for a premium feel.

## **Implemented Design & Styles** (Current State: Initial)
- **Baseline CSS:** Utilizing Container Queries, `:has()`, and OKLCH colors.
- **Expressive Typography:** High-contrast headings and readable body text.
- **Interactive UI:** Smooth transitions and hover effects for trend items.
- **Texture & Depth:** Subtle noise textures and multi-layered drop shadows.

## **Phase 1: Foundation & Core Features (Current Request)**
1.  **Architecture Setup:**
    - Initialize `blueprint.md` (Done).
    - Configure modern CSS variables and global styles.
2.  **UI Implementation:**
    -   **Layout:** Header with logo, main content area, and footer with legal links (AdSense requirement).
    -   **Country Selector:** Interactive component to switch between Korea and Japan.
    -   **Trend List:** Web Component `<trend-list>` to display TOP 10 items with rank, keyword, and change indicators.
3.  **Data Management:**
    - Create a `TrendService` to fetch/mock real-time data for KR and JP.
    - Implement a refresh mechanism.
4.  **AdSense Readiness:**
    -   Add `About`, `Privacy Policy`, and `Terms` page placeholders.
    -   Reserve designated ad slots (`<div class="ad-slot">`).
    -   Meta tags for SEO.
5.  **Visual Polish:**
    -   Add subtle animations and 3D background elements using Three.js.
    -   Apply premium textures and shadows.

## **Phase 2: Trend Analysis & Detailed View (Current Request)**
1.  **Data Expansion:**
    - Update `TrendService` to include detailed explanations (mocking AI analysis) for each trend item.
2.  **Interactive Components:**
    - Enhance `<trend-list>` to handle click events and emit details.
    - Create a `<trend-modal>` component to display the "Why it's trending" analysis.
3.  **UI/UX Enhancement:**
    - Implement a polished, glass-morphism modal for content reading.
    - Add loading states to simulate "Analyzing..." process for a premium feel.

## **Phase 3: Related Content Integration (Current Request)**
1.  **Link Aggregation:**
    - Update `TrendService` to include related news articles and video links (YouTube) for each trend.
2.  **Enhanced Modal UI:**
    - Add a "Related Sources" section to the modal with icons (News, Video).
    - Style links as interactive buttons for better engagement.

## **Execution Steps**
- [x] Initialize `index.html` with SEO tags and layout structure.
- [x] Create `style.css` with modern CSS features (OKLCH, Container Queries).
- [x] Implement `main.js` with Web Components and `TrendService`.
- [x] Add Three.js for visual enhancements.
- [x] Verify functionality and responsiveness.
- [x] Implement Trend Analysis Modal and detailed content logic.
- [x] Update data service with trend explanations.
- [x] Add related links (News, YouTube) to the trend data and modal UI.
