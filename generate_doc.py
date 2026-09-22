import docx
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = docx.Document()

# Add Title
title = doc.add_heading('System Design: Guest Portal BFF Architecture and Incremental Migration Strategy', 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# 1. Executive Summary
doc.add_heading('1. Executive Summary & Context', level=1)
doc.add_paragraph("This document outlines the architectural transition of the Guest Portal from a monolithic direct-to-database pattern to a modernized Backend-for-Frontend (BFF) approach. Historically, the Guest Portal relied on thick client-side logic to aggregate data directly from our primary datastores, which introduced performance bottlenecks, tightened coupling between the frontend and database schemas, and complicated our security posture.")
doc.add_paragraph("To resolve these issues, we are introducing a thin UI layer supported by localized BFF read-models under the app/api/app/* routing namespace. This shift preserves our centralized API gateway contracts while optimizing payloads specifically for the Guest Portal’s frontend components, ultimately driving faster rendering times and a more robust security model.")

# 2. Architectural Goals & Constraints
doc.add_heading('2. Architectural Goals & Constraints', level=1)
doc.add_paragraph("Our primary objective is to decouple the frontend presentation logic from the underlying data aggregation mechanics. The frontend should act as a 'thin UI', completely unaware of how the data is stored or fetched upstream.")
doc.add_paragraph("Key Constraints:")
p = doc.add_paragraph(style='List Bullet')
p.add_run("Zero Downtime Migration: ").bold = True
p.add_run("The transition must happen incrementally. Legacy UI paths and direct queries must remain operational until parity logging and Quality Assurance (QA) sign-off on the new BFF routes.")
p = doc.add_paragraph(style='List Bullet')
p.add_run("Strict Boundary Enforcement: ").bold = True
p.add_run("The Guest Portal's BFF handlers must not bypass the core API gateway. They are strictly adapters that fan into existing /api/v1/* gateway contracts. The gateway remains the single source of truth for business logic and state mutation.")
p = doc.add_paragraph(style='List Bullet')
p.add_run("Standardized Envelopes: ").bold = True
p.add_run("Every new BFF endpoint must strictly adhere to our unified response envelope: { ok, data, error, meta }. This ensures consistent error handling and simplified frontend consumption.")

# 3. System Design: The BFF Pattern Implementation
doc.add_heading('3. System Design: The BFF Pattern Implementation', level=1)
doc.add_paragraph("The localized BFF layer is built directly into the Next.js application using standard API route handlers. Rather than allowing ad-hoc business routes scattered throughout the app/api directory, we are enforcing a strict namespace isolation under app/api/app/*.")
doc.add_paragraph("Currently approved boundary surfaces include checkout flows (summary, quote, reserve, initiate, verify), ticketing overviews, event details, profile management, and notification summaries. For instance, when a user accesses the event detail page, the frontend simply calls /api/app/events/[eventId]/detail.")
doc.add_paragraph("Behind the scenes, this BFF handler validates the incoming request Data Transfer Object (DTO). Once validated, the handler orchestrates one or more calls to the backend API Gateway (/api/v1/events/:id, /api/v1/calendar/availability, etc.), aggregates the responses, filters out sensitive or unnecessary fields, and maps the data into a view-ready model before sending it back to the client.")

# 4. Data Flow & Authentication Strategy
doc.add_heading('4. Data Flow & Authentication Strategy', level=1)
doc.add_paragraph("The authentication strategy relies on Firebase JWT tokens. When a guest authenticates on the client, the token is passed in the Authorization header of their request to the BFF. The BFF does not attempt to validate the token itself; instead, it forwards the token transparently to the API Gateway.")
doc.add_paragraph("If the token is expired or invalid, the API Gateway rejects the request with a 401 Unauthorized status. The BFF catches this, maps it to our standardized error envelope, and forwards the 401 to the client, triggering a seamless token refresh or redirecting the user to the login flow. This ensures that authorization enforcement remains centralized within the core services, eliminating the risk of mismatched security policies between the UI layer and the backend.")

# 5. Edge Cases, Failure Modes, and Mitigation
doc.add_heading('5. Edge Cases, Failure Modes, and Mitigation', level=1)
doc.add_paragraph("Designing a resilient system requires explicit consideration of failure modes. We have identified several key edge cases that the new architecture must handle gracefully.")
p = doc.add_paragraph(style='List Bullet')
p.add_run("Gateway Latency Spikes: ").bold = True
p.add_run("If the upstream API Gateway experiences degraded performance, the BFF layer could become a bottleneck, leading to connection timeouts. To mitigate this, all downstream fetches within the BFF use strict timeout policies (e.g., 5 seconds for read operations). If a timeout occurs, the BFF responds with an appropriate error payload rather than hanging indefinitely.")
p = doc.add_paragraph(style='List Bullet')
p.add_run("Partial Failures in Aggregation: ").bold = True
p.add_run("Some BFF endpoints (like the profile overview) aggregate data from multiple backend services (e.g., user metadata and notification counts). If the notification service fails but the profile service succeeds, the BFF must support partial success. The response will still return ok: true with the profile data, but the meta section will indicate that notification data is currently unavailable, allowing the UI to render gracefully with degraded functionality.")
p = doc.add_paragraph(style='List Bullet')
p.add_run("Malformed DTOs and Bad Actors: ").bold = True
p.add_run("To prevent abuse, the BFF layer employs strict Zod schema validation on all incoming request payloads before forwarding anything to the gateway. Invalid payloads are immediately rejected with a 422 Validation Error, preventing unnecessary load on the core backend services.")

# 6. Rollout Plan
doc.add_heading('6. Migration Strategy & Rollout Plan', level=1)
doc.add_paragraph("The migration is structured as a phased, incremental rollout utilizing feature flags. The legacy UI components will continue to function in parallel with the new BFF-backed components.")
doc.add_paragraph("During Phase 1, the new BFF endpoints will be deployed to production in 'shadow mode'. They will receive asynchronous traffic mirrored from a percentage of active user sessions, allowing us to validate payload correctness and monitor latency without impacting the actual user experience. Once parity is achieved and error rates drop below our 0.1% threshold, Phase 2 will involve a gradual traffic shift, starting with 5% of users and ramping up over a two-week period. Legacy catch-all guest runtime bridges have already been deprecated and deleted in preparation for this shift.")

doc.save('Guest_Portal_BFF_Architecture.docx')
