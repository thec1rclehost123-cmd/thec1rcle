# New Joiner Startup Guide

## Welcome to THE C1RCLE! 🚀

This guide will help you understand the codebase and get up to speed quickly.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Key Concepts](#key-concepts)
6. [First Week Tasks](#first-week-tasks)
7. [Resources](#resources)

---

## Architecture Overview

### High-Level System Design

```
                                    ┌─────────────────────────────────────────────┐
                                    │              Client Apps                    │
                                    │  (Guest Portal, Partner Dashboard, Admin)   │
                                    └──────────────────┬──────────────────────────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    API Gateway (Fastify)                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 26+ Route Files: events, checkout, payments, orders, staff, analytics, etc.              │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
    │  Domain Services│       │   Repositories │       │   Plugins       │
    │ - EventService  │       │ - EventRepo     │       │ - Firebase Auth │
    │ - CheckoutService│       │ - OrderRepo     │       │ - Redis Cache  │
    │ - ProfileService│       │ - ProfileRepo   │       │ - Realtime      │
    └────────┬────────┘       └────────┬────────┘       └─────────────────┘
             │                          │
             ▼                          ▼
    ┌─────────────────┐       ┌─────────────────┐
    │   Core Engines   │       │    Firestore    │
    │ - event-engine   │       │    (Database)   │
    │ - pricing-engine │       └─────────────────┘
    │ - staff-engine   │
    │ - promo-service  │
    └─────────────────┘

              │                          │
              ▼                          ▼
    ┌─────────────────┐       ┌─────────────────┐
    │   Inngest       │       │Firebase Functions│
    │ (Background Jobs)│       │ (Webhooks, async)│
    └─────────────────┘       └─────────────────┘
```

### Data Flow Summary

1. **Request Flow**: Client → Fastify Route → Domain Service → Repository → Firestore
2. **Authentication**: Firebase Auth tokens validated on every request
3. **Background Processing**: Inngest for async workflows, Firebase Functions for webhooks
4. **Caching**: Redis for performance optimization

---

## Tech Stack

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| Fastify | API Gateway Framework | ^5.x |
| Firebase Admin | Auth & Firestore | ^13.x |
| Redis | Caching & Pub/Sub | - |
| Inngest | Background Jobs | - |
| TypeScript | Type Safety | ^5.x |

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| React/Next.js | Guest Portal | 14.x |
| React/Vite | Partner Dashboard | 18.x |
| React Native | Mobile App (Expo) | SDK 54 |
| TailwindCSS | Styling | ^3.x |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Firebase Cloud Functions | Serverless compute |
| Firestore | Primary database |
| Firebase Auth | User authentication |
| Razorpay | Payment processing |
| Algolia | Search engine |

### Development Tools
| Tool | Purpose |
|------|---------|
| Turbo | Monorepo orchestration |
| Vitest | Testing framework |
| ESLint | Code linting |
| TypeScript | Static type checking |

---

## Project Structure

```
thec1rcle/
├── apps/                          # Applications
│   ├── api-gateway/               # Fastify API (PORT 4000)
│   ├── guest-portal/              # Next.js consumer app
│   ├── partner-dashboard/        # Vite React dashboard
│   ├── admin-console/            # Admin interface
│   └── mobile-app/               # React Native (Expo)
│
├── packages/                     # Shared packages
│   ├── core/                    # Domain logic & engines
│   │   ├── src/domain/          # Services & repositories
│   │   │   ├── services/        # Business logic
│   │   │   └── repositories/    # Data access
│   │   ├── *.engine.js          # Business engines
│   │   └── types.d.ts           # TypeScript definitions
│   └── ui/                      # Shared React components
│
├── functions/                   # Firebase Cloud Functions
│   └── src/lib/                 # Function handlers
│
├── scripts/                     # Utility scripts
│
└── docs/                       # Documentation
```

---

## Getting Started

### Prerequisites
```bash
# Install Node.js (v20+)
node --version

# Install Firebase CLI
npm install -g firebase-tools

# Install Inngest CLI (for local dev)
npm install -g inngest-cli

# Install Redis (for local dev)
# macOS: brew install redis
# Ubuntu: sudo apt-get install redis-server
```

### Setup Steps

1. **Clone the repo**
```bash
git clone <repository-url>
cd thec1rcle
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Configure environment variables**
```bash
# Create .env file in root (copy from .env.example if available)
# Required variables:
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY..."
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
REDIS_URL=redis://localhost:6379
PORT=4000
```

4. **Start development services**
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Firebase Emulators
firebase emulators:start

# Terminal 3: Start API Gateway
npm run dev --workspace=apps/api-gateway

# Terminal 4: Start Inngest (optional)
npx inngest-cli dev -u http://localhost:4000/api/inngest
```

5. **Start your preferred app**
```bash
npm run dev:guest    # Guest Portal (localhost:3000)
npm run dev:partner  # Partner Dashboard (localhost:5173)
npm run dev:admin    # Admin Console
```

---

## Key Concepts

### 1. Domain-Driven Design
The codebase follows DDD principles:
- **Services**: Business logic (`EventService`, `CheckoutService`)
- **Repositories**: Data access layer (`EventRepository`, `OrderRepository`)
- **Engines**: Core business rules (`event-engine.js`, `pricing-engine.js`)

### 2. Authentication Flow
```
Client → Firebase Auth → JWT Token → API Gateway
                                        ↓
                              authService.verifyToken()
                                        ↓
                              request.user populated
```

### 3. Role-Based Access Control (RBAC)
Roles and permissions are defined in `staff-engine.js`:
```javascript
ROLE_PRESETS = {
    owner: ['all_permissions'],
    manager: ['viewEvents', 'editEvents', 'viewFinance', 'manageStaff'],
    ops: ['viewEvents', 'editEvents', 'scanTickets'],
    viewer: ['viewEvents']
}
```

### 4. Event Lifecycle
```
draft → submitted → approved → scheduled → live → completed
                                       ↓
                                    cancelled
```

### 5. Order Flow
```
Reserve Items → Initiate Checkout → Create Order → Payment → Confirmation
    (5 min TTL)                              (pending)
```

---

## First Week Tasks

### Day 1-2: Environment Setup
- [ ] Clone and configure local environment
- [ ] Run API Gateway locally
- [ ] Make a test API call (GET /health)
- [ ] Explore the database with Firebase Emulator UI

### Day 3: Understand Core Flows
- [ ] Read `checkout-service.ts` - understand ticket purchase flow
- [ ] Read `event-service.ts` - understand event CRUD
- [ ] Trace a request from route to database

### Day 4: Make Your First Contribution
- [ ] Pick a "Good First Issue" from the tracker
- [ ] Make a small fix (typo, logging, etc.)
- [ ] Write a test for existing functionality

### Day 5: Deep Dive
- [ ] Understand the pricing engine
- [ ] Review security (RBAC, auth hooks)
- [ ] Read the documentation files

---

## Common Patterns to Know

### 1. Repository Pattern
```typescript
class EventRepository {
    async getById(id: string): Promise<Event> {
        const doc = await this.db.collection('events').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }
}
```

### 2. Service Layer
```typescript
class EventService {
    constructor(private eventRepo: IEventRepository) {}

    async getEventByIdOrSlug(id: string): Promise<Event | null> {
        const event = await this.eventRepo.getById(id);
        if (event) return event;
        return this.eventRepo.getBySlug(id);
    }
}
```

### 3. Route Handler
```typescript
fastify.get('/events/:id', async (request, reply) => {
    const event = await fastify.eventService.getEventByIdOrSlug(request.params.id);
    if (!event) return reply.status(404).send({ error: "Not found" });
    return event;
});
```

---

## Resources

### Documentation Files
- [API Structure & Endpoints](./01-API-STRUCTURE.md)
- [E2E Flows](./02-E2E-FLOWS.md)
- [Database Schema](./03-DATABASE-SCHEMA.md)
- [Security & Permissions](./04-SECURITY-AUDITS.md)

### Key Files to Read
1. `packages/core/event-engine.js` - Event building logic
2. `packages/core/events.js` - Event utilities
3. `apps/api-gateway/src/app.ts` - Server setup
4. `apps/api-gateway/src/plugins/firebase.ts` - Auth & services
5. `packages/core/src/domain/services/checkout-service.ts` - Purchase flow

### External Resources
- [Fastify Docs](https://fastify.dev)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [Inngest Docs](https://inngest.com/docs)

---

## Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
# Rebuild packages
npm run build
```

**Firebase connection errors**
```bash
# Check emulator is running
firebase emulators:execute
```

**Redis connection errors**
```bash
# Check Redis is running
redis-cli ping
```

**Port already in use**
```bash
# Kill process on port
lsof -i :4000 | awk 'NR>1 {print $2}' | xargs kill
```

---

## Need Help?

1. **Code Questions**: Check the documentation in `/docs`
2. **Environment Issues**: Ask in #dev-help Slack channel
3. **Architecture Questions**: Tag @senior-engineer in PR comments
4. **General**: Reach out to your onboarding buddy

---

*Last Updated: May 2026*