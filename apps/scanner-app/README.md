# C1RCLE Scanner App

A dedicated Expo React Native app for venue door staff to scan tickets and process walk-up entries.

## Features

- **QR Ticket Scanning**: Validate pre-purchased tickets with HMAC signature verification
- **Door Entry**: Create walk-up sales with cash/UPI/card payment tracking
- **Live Stats**: Real-time entry counts and door revenue
- **Guest List**: Searchable list with entry status
- **Event Code Auth**: Secure access via event-specific codes

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator or Android Emulator

### Installation

```bash
# Navigate to scanner app
cd apps/scanner-app

# Install dependencies
npm install

# Start development server
npx expo start
```

### Running on Device

1. Install Expo Go app on your phone
2. Scan the QR code from the terminal
3. Enter any event code (e.g., "TEST123" for demo mode)

## Project Structure

```
scanner-app/
├── app/                    # Expo Router screens
│   ├── index.tsx          # Event code entry
│   └── (event)/           # Protected event screens
│       ├── scan.tsx       # QR Scanner
│       ├── door-entry.tsx # Walk-up sales
│       ├── stats.tsx      # Live statistics
│       └── guestlist.tsx  # Guest list
├── components/            # Reusable components
├── lib/api/              # API client functions
├── store/                # State management
└── assets/               # Images and sounds
```

## API Endpoints

The app connects to the Partner Dashboard API:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/scan/auth` | Validate event code |
| `POST /api/scan` | Process QR scan |
| `POST /api/door-entry` | Create walk-up entry |
| `GET /api/guestlist` | Fetch guest list |

## Environment Variables

Create `.env` file:

```
EXPO_PUBLIC_API_URL=http://your-api-url:3001/api
```

## Building for Production

```bash
# Build for Android
npx eas build --platform android --profile production

# Build for iOS
npx eas build --platform ios --profile production
```

## License

Proprietary - THE C1RCLE
