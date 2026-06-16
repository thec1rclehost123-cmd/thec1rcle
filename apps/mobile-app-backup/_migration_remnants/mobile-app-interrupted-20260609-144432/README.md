# THE C1RCLE Mobile App

Premium nightlife discovery and ticketing app built with Expo/React Native.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+
- Expo Go app on your iPhone/Android device
- (Optional) Xcode for iOS simulator

### Running the App

1. **Install dependencies** (from monorepo root):
   ```bash
   cd /path/to/thec1rcle
   npm install
   ```

2. **Start the dev server**:
   ```bash
   cd apps/mobile-app
   npm start
   ```
   Or with cache clear if you're having issues:
   ```bash
   npm run start:clear
   ```

3. **Open on your device**:
   - Open the **Camera app** on your iPhone
   - Point it at the **QR code** shown in the terminal
   - Tap the notification to open in **Expo Go**

### Troubleshooting

If you encounter issues:

```bash
# Check for common problems
npm run doctor

# Clear all caches and restart
rm -rf node_modules .expo
npm install
npm run start:clear
```

---

## 📁 Project Structure

```
mobile-app/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Authentication flow
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/             # Main tab navigation
│   │   ├── _layout.tsx     # Premium tab bar with animations
│   │   ├── explore.tsx     # Event discovery
│   │   ├── tickets.tsx     # Ticket wallet
│   │   ├── inbox.tsx       # Messages & chat
│   │   └── profile.tsx     # User profile
│   ├── event/[id].tsx      # Event details
│   ├── checkout/           # Payment flow
│   ├── chat/               # Chat screens
│   ├── safety/             # SOS & safety features
│   ├── social/             # Social features
│   ├── transfer/           # Ticket transfers
│   ├── _layout.tsx         # Root layout (auth, theme, navigation)
│   └── index.tsx           # Entry redirect
│
├── components/             # Reusable UI components
│   ├── ui/                 # Core UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── PremiumButton.tsx
│   │   ├── PremiumEffects.tsx  # Glassmorphism, aurora, etc
│   │   └── ...
│   └── LegalPage.tsx
│
├── lib/                    # Core business logic
│   ├── firebase/           # Firebase setup & auth
│   ├── social/             # Chat, DMs, group messages
│   ├── design/theme.ts     # Design tokens (colors, spacing)
│   ├── safety.ts           # SOS, location sharing
│   ├── wallet.ts           # Ticket management
│   ├── transfers.ts        # Ticket transfer logic
│   └── ...
│
├── store/                  # Zustand state management
│   ├── authStore.ts        # Authentication state
│   ├── eventsStore.ts      # Event data & caching
│   ├── ticketsStore.ts     # User tickets
│   ├── cartStore.ts        # Checkout cart
│   ├── settingsStore.ts    # User preferences
│   └── ...
│
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts
│   └── useSettings.ts
│
├── assets/                 # Static assets
├── app.json                # Expo configuration
├── babel.config.js         # Babel config (NativeWind)
├── metro.config.js         # Metro bundler config
├── tailwind.config.js      # Tailwind/NativeWind theme
└── tsconfig.json           # TypeScript config
```

---

## 🧭 Navigation Structure

### Auth Flow (`/(auth)`)
- `/login` - Email/password login
- `/signup` - Create account
- `/forgot-password` - Password reset

### Main Tabs (`/(tabs)`)
Protected routes - requires authentication.

- `/explore` - Event discovery, search, categories
- `/tickets` - Upcoming/past tickets, QR codes, transfers
- `/inbox` - Event chats, DMs, message requests
- `/profile` - User info, stats, settings access

### Modals & Screens
- `/event/[id]` - Event details page
- `/checkout/*` - Payment flow (modal)
- `/safety/*` - SOS features (modal)
- `/transfer/*` - Ticket transfer (modal)
- `/social/*` - Social features (DMs, attendees)
- `/settings` - Full settings page
- `/notifications` - Notification center
- `/search` - Global search
- `/legal/*` - Terms, Privacy, etc.

---

## 🔐 Authentication

Auth is managed by Firebase and the `authStore`:

```typescript
// Check auth state
const { user, initialized } = useAuthStore();

// Login
await loginWithEmail(email, password);

// Signup
await signupWithEmail(email, password);

// Logout
await logout();
```

The root layout (`app/_layout.tsx`) handles:
1. Initializing auth listener on app start
2. Showing splash until ready
3. Redirecting based on auth state

---

## 🎨 Design System

The app uses a premium dark luxury aesthetic matching the website.

### Colors (`lib/design/theme.ts`)
- **base**: `#161616` - Midnight black
- **iris**: `#F44A22` - Orange accent
- **gold**: `#FEF8E8` - Premium text

### Tailwind Classes (via NativeWind)
```jsx
<View className="bg-base p-4 rounded-bubble">
  <Text className="text-gold font-bold">Premium</Text>
</View>
```

### Premium Components
- `LiquidGlass` - Glassmorphism container
- `AuroraBackground` - Animated ambient glow
- `PremiumButton` - Animated CTA buttons
- `PremiumHeroCard` - Hero event cards

---

## 📱 Key Features

### 1. Event Discovery
- Hero carousel with featured events
- Category filtering
- Search with filters
- Heat score ranking

### 2. Ticketing
- Multi-tier ticket selection
- Promo code support
- Cart with timer
- QR code display
- Offline-capable tickets

### 3. Social
- Event group chats
- Private DMs
- Message requests
- Typing indicators
- Photo gallery

### 4. Safety
- SOS emergency flow
- Trusted contacts
- Live location sharing
- Event-time safety features

### 5. Transfers
- Generate transfer codes
- Share via link
- Claim received tickets

---

## 🔧 Development Tips

### Hot Reload
Changes to `.tsx` files will hot reload automatically.

### Shake to Debug
Shake your device to open the Expo developer menu.

### TypeScript Paths
Use path aliases for clean imports:
```typescript
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store";
import { colors } from "@/lib/design/theme";
```

### Testing Offline Mode
Enable airplane mode to test offline caching.

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-router` | File-based navigation |
| `nativewind` | Tailwind CSS for React Native |
| `react-native-reanimated` | Smooth animations |
| `firebase` | Auth & Firestore |
| `zustand` | State management |
| `expo-blur` | Glassmorphism effects |
| `react-native-qrcode-svg` | QR code generation |

---

## 🚢 Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS (first time)
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

---

*THE C1RCLE - Discover Life Offline* ✨
