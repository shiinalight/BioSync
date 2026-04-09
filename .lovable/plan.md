

## HealthPulse — Light & Modern Health Dashboard

### Design System
- **Palette**: Light base with mint accents — white (#ffffff), soft gray (#f0faf5), mint (#2dd4a8), deep teal (#0d6b58), dark text (#1a2332)
- **Typography**: Apple system font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif`)
- **Style**: Clean white cards with subtle borders, 12px rounded corners, soft shadows, generous whitespace, no glassmorphism — crisp and minimal
- **Layout**: Dashboard with slim collapsible sidebar

### Pages to Build

**1. Sidebar Navigation**
- Slim sidebar with icons + labels: Dashboard, AI Coach, Shop, Appointments
- Mint highlight on active route, user avatar at bottom
- Collapses to icons on mobile

**2. Dashboard (Home)**
- Health score ring (animated, mint gradient)
- Bento cards: Steps, Heart Rate, Sleep, Calories, Water
- Weekly trend sparklines
- Quick actions: "Talk to Coach", "Book Appointment", "Shop"

**3. AI Coach**
- Clean chat UI with message bubbles
- Suggested prompt chips
- Streaming AI responses via edge function

**4. Health Shop**
- Category tabs: Vitamins, Proteins, Recovery, Sleep, Immunity
- Product cards: image, name, price, rating, "AI Recommended" badge
- Cart sidebar, product detail modal

**5. Appointment Booking**
- Calendar date picker + time slot grid
- Booking form with confirmation
- Upcoming appointments list

### Technical Plan
- All pages as React routes with sidebar layout wrapper
- Mock/seed data for products, metrics, appointments
- Supabase via Lovable Cloud for DB and auth (later phase)
- Stripe for checkout (later phase)
- Lovable AI gateway for coach chatbot (later phase)

### Implementation Order
1. Design system (CSS variables, fonts, global styles)
2. Sidebar layout + routing
3. Dashboard with mock metrics
4. AI Coach chat UI (mock responses first)
5. Shop with product catalog
6. Appointment booking
7. Backend integrations (DB, auth, AI, payments)

