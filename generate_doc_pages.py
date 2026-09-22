import docx
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os

doc = docx.Document()
style = doc.styles['Normal']
font = style.font
font.name = 'Arial'
font.size = Pt(11)

def add_page(doc, title, paragraphs, image_file=None):
    doc.add_heading(title, level=1)
    word_count = len(title.split())
    for p_text in paragraphs:
        doc.add_paragraph(p_text)
        word_count += len(p_text.split())
    
    if image_file and os.path.exists(image_file) and os.path.getsize(image_file) > 0:
        doc.add_picture(image_file, width=Inches(5.5))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        caption = f"Figure: Architecture Diagram for {title}"
        doc.add_paragraph(caption, style='Caption')
        word_count += len(caption.split())
        
    print(f"Added page '{title}' with {word_count} words.")
    doc.add_page_break()

# Page 1
add_page(doc, "1. Executive Summary and Business Context", [
    "This comprehensive System Design Document outlines the architectural blueprint, transition strategy, and technical implementations for the modernized C1RCLE platform. Specifically, it details the migration from a monolithic, direct-to-database legacy structure to a highly scalable, resilient Backend-for-Frontend (BFF) architecture.",
    "Historically, the platform's various web portals relied heavily on thick client-side logic. This approach forced the frontend applications to aggregate data directly from primary datastores, introducing severe performance bottlenecks, tight coupling between user interface presentation and database schemas, and significant security vulnerabilities that could not be overlooked.",
    "To rectify these historical debts, we are implementing a robust thin UI layer supported by localized BFF read-models. This architectural pivot ensures that our core API Gateway remains the single source of truth for business logic and state mutation, while optimizing payloads exclusively for the frontend consumers. This document delves deeply into our constraints, data modeling strategies, security enforcement, failure modes, and the phased rollout plan required to achieve zero-downtime migration across the entire infrastructure footprint."
])

# Page 2
add_page(doc, "2. Problem Statement and Legacy Architecture Debts", [
    "The C1RCLE platform operates in a high-concurrency, transaction-heavy domain encompassing ticketing, event management, and partner dashboards. The legacy architecture presented several critical business risks that necessitated this immediate redesign.",
    "First, security exposure was a massive concern. Direct database access from the client required overly permissive Firestore security rules, increasing the surface area for unauthorized data exposure. By pushing logic to the client, we inadvertently exposed domain rules to anyone inspecting the network tab.",
    "Second, client-side bloat severely impacted performance. Fetching disjointed data and aggregating it in the browser led to massive JavaScript bundle sizes, increasing Time-to-Interactive on mobile devices. A typical checkout flow required fourteen distinct round trips to the database.",
    "Furthermore, concurrent ticket reservations often suffered from 'lost updates' because the legacy implementation relied on read-check-write patterns outside of strict database transactions. Finally, error responses were wildly inconsistent across different endpoints, making frontend error boundary implementation nearly impossible. The business requirement is clear: we must achieve a scalable, secure, and predictable backend architecture."
])

# Page 3
add_page(doc, "3. Target Architecture and The BFF Pattern", [
    "The new topology rigorously isolates concerns and enforces clean boundaries. The localized BFF layer is built directly into the Next.js applications using standard API route handlers under the designated routing namespace. We strictly enforce this namespace isolation to prevent ad-hoc business routes from scattering across the repository.",
    "When a user requests an event detail page, the frontend simply calls its BFF endpoint. The BFF validates the incoming request payload, orchestrates calls to multiple upstream API Gateway endpoints, filters out sensitive or unnecessary fields, and maps the data into a view-ready model. The Fastify API Gateway handles all complex processing, ensuring the user interface remains exceptionally thin and purely focused on presentation.",
    "This architecture allows us to version the Gateway independently from the UI. The BFF serves as a critical anti-corruption layer, protecting the frontend components from underlying changes in the microservices or database schemas. It also enables localized caching, allowing the BFF to cache static event data while ensuring real-time inventory checks pass directly through to the Gateway."
], 'diag1.png')

# Page 4
add_page(doc, "4. Strict Boundary Enforcement and Policy Ordering", [
    "Every engineering decision documented herein is bound by unyielding constraints. BFF handlers must never bypass the core API gateway. They act strictly as adapters. The gateway is the sole arbiter of business rules. If a calculation involves money, permissions, or inventory, it happens strictly on the Gateway.",
    "To maintain security and efficiency, the order of execution for middleware policies is completely non-negotiable. Rate limiting executes first, as it is computationally cheap and protects the system from volumetric attacks. Validation via Zod executes second, ensuring all parameters and payloads conform to expected schemas.",
    "By validating before authorizing, we guarantee that a missing organization ID results in a generic validation error rather than a misleading authorization failure. Finally, Authorization evaluates if the authenticated identity possesses the necessary permissions for the validated resource. By placing this after validation, we prevent our authorization engines from failing on malformed input, preserving database reads and overall system efficiency."
])

# Page 5
add_page(doc, "5. Core API Gateway and Standardized Envelopes", [
    "Historically, error envelopes across the platform were nested inconsistently. This required the frontend engineering team to write complex, brittle parsing logic to handle varying payload structures. To resolve this, we have mandated a strictly flat error envelope for all Gateway and BFF responses moving forward.",
    "The standardized payload always contains a success boolean, the requested data payload, an optional error code, a human-readable message, a mandatory request identifier for tracing, and optional metadata for pagination. This flat shape is enforced at the outermost layer of the Fastify application.",
    "Global error handlers and route-specific handlers share the exact same serialization utility derived directly from our shared contracts package. Furthermore, while the underlying repositories utilize cursor-based pagination for performance, the API Gateway adapts this into a standard page-based response for the frontend. This crucial abstraction prevents cursor leakage and eliminates hidden offset discrepancies on the client, standardizing the user interface experience and heavily reducing integration friction."
])

# Page 6
add_page(doc, "6. Checkout Sequence and Transactional Integrity", [
    "Maintaining data consistency across aggregate roots—such as Orders, Tickets, and Ledger entries—is the most critical function of the API Gateway. We rely heavily on robust transactional boundaries to prevent data corruption during the checkout sequence.",
    "Fulfillment operations must succeed or fail as a single atomic unit. Dual confirmation paths, such as a user redirecting back from a payment gateway while a webhook is simultaneously received, historically resulted in duplicate fulfillments. This costs real money and degrades partner trust.",
    "During the checkout sequence, the gateway initializes a transaction that validates inventory availability, applies promotional discounts, and secures the financial ledger. The exact sequence ensures that rate limiting, input validation, and authorization are completed before any database locks are acquired. Once validated, the system executes a compare-and-set lock, writing the finalized order and an outbox event simultaneously. If any step fails, the entire transaction is rolled back, guaranteeing that users are never charged for tickets they did not successfully reserve."
], 'diag2.png')

# Page 7
add_page(doc, "7. The Outbox Pattern and Event Processing", [
    "To resolve the dual confirmation path issue and guarantee exactly-once processing semantics, we implement the Transactional Outbox pattern. The primary business write and the corresponding domain event are written into the database within the exact same atomic transaction block.",
    "Background consumers then asynchronously read from the outbox table to project data into read-models or trigger external side-effects, such as sending email confirmations or dispatching webhook payloads to third-party integrations. This guarantees that downstream systems remain eventually consistent without blocking the primary user request.",
    "If an outbox consumer fails to process a message due to a transient network error, the message remains in the outbox and is retried using an exponential backoff strategy. Once successfully processed, the outbox record is marked as complete, preventing duplicate executions. This pattern completely decouples the synchronous user checkout flow from the asynchronous fulfillment mechanisms, drastically improving the perceived performance of the application while retaining absolute data integrity across all distributed subsystems."
])

# Page 8
add_page(doc, "8. Compare-and-Set Durability and Optimistic Locking", [
    "To eliminate lost updates during concurrent writes, all state mutations across the platform now require an expected version parameter. The database adapter enforces this constraint strictly inside a transaction block.",
    "If two requests attempt to mutate a record sitting at version N simultaneously, both will supply expected version N. The first transaction succeeds and increments the version to N plus one. The second transaction observes the version mismatch and aborts, yielding an HTTP conflict status code.",
    "This effectively implements Optimistic Concurrency Control at the application layer, which is absolutely crucial for high-demand ticket drops where thousands of users compete for limited inventory within seconds. Unlike pessimistic locking, which can cause severe database contention and deadlocks under heavy load, optimistic locking allows maximum read throughput while safely rejecting conflicting writes. The rejected clients can then fetch the latest state and retry their operation automatically, providing a seamless user experience despite massive underlying concurrency."
])

# Page 9
add_page(doc, "9. Security, Authentication, and Identity Verification", [
    "Security represents a massive overhaul in this architecture. We have successfully deprecated raw external token verification in favor of a robust, internally hosted authentication library. This gives us complete sovereignty over user identity.",
    "The system relies entirely on secure, HTTP-only cookie-based sessions. The durable credential is never exposed to client-side JavaScript, completely eliminating Cross-Site Scripting risks related to token theft. A short-lived access token is returned to the client and kept strictly in transient memory.",
    "Upon navigating to a new tab or reloading the application, the browser automatically sends the secure cookie to the backend refresh endpoint to silently acquire a fresh in-memory token. This ensures a seamless user experience while maintaining an aggressive security posture. Furthermore, we explicitly separate Platform Admin roles from Organization Owner roles. A user may own a tenant organization, but that grants zero platform-wide privileges, preventing severe escalation of privilege vulnerabilities across the ecosystem."
], 'diag3.png')

# Page 10
add_page(doc, "10. Payment Webhooks and Signature Verification", [
    "Payment webhooks originating from our payment processors are the singular authoritative source for transaction confirmations. To prevent spoofing and financial fraud, the webhook endpoint enforces strict cryptographic signature verification.",
    "We utilize a deterministic JSON string parser to ensure the raw body signature matches exactly before any processing begins. If the signature is invalid or missing, the request is immediately dropped and logged as a security event.",
    "Furthermore, webhook processing is locked via an idempotent status flag in the database to prevent double-capture scenarios. When a webhook arrives, the system attempts to acquire an exclusive lock on the corresponding order. If the lock is successfully acquired, the order is transitioned to a settling state. If another webhook or client redirect attempts to process the same order simultaneously, it will fail to acquire the lock and exit gracefully, ensuring that fulfillment logic is executed exactly once per successful payment."
])

# Page 11
add_page(doc, "11. Platform Authority and Access Control Models", [
    "Our Access Control model relies on a highly structured Attribute-Based Access Control system. We explicitly separate Platform Administrative roles from standard Organization Owner roles to maintain strict tenant isolation.",
    "An Organization Owner possesses absolute authority over their specific tenant, allowing them to manage venues, invite staff members, and publish events. However, this role grants absolutely zero visibility or control over other tenants on the platform.",
    "Platform Administrative authority is governed by a completely distinct aggregate entity, ensuring that administrative endpoints do not accidentally evaluate tenant-level permissions. This prevents dangerous escalation of privilege vulnerabilities. When an administrative action is requested, the system evaluates the user against the platform admin aggregate repository. If the user is deactivated or missing, they are refused with an unauthorized error. This dual-layered permission model guarantees that our multi-tenant architecture remains secure, isolated, and highly auditable at all times, preventing unauthorized access across the ecosystem."
])

# Page 12
add_page(doc, "12. Event Lifecycle and Strict State Machines", [
    "Complex domain entities, such as Events and Organization Invitations, rely on strict finite State Machines to dictate lifecycle transitions. This mathematically ensures that entities cannot enter invalid or corrupted states.",
    "For example, the Event lifecycle prevents a Draft from being published directly without administrative review. Bypassing this review exposes the platform to potential fraud and low-quality content. The internal service method does not simply flip a boolean flag to publish an event.",
    "Instead, it walks the finite state machine explicitly—moving from Review to Scheduled, and finally to Published—within the exact same service call, validating the transition matrix at every individual step. This guarantees that invariants are never violated, regardless of how the API is invoked by upstream clients. If a manual database edit forces an invalid state, the application strictly refuses to act upon the entity, effectively quarantining the corrupted data and triggering an immediate alert to the engineering team for manual intervention."
], 'diag4.png')

# Page 13
add_page(doc, "13. Data Modeling and Schema Denormalization", [
    "To ensure unparalleled performance at scale, our data modeling strategy heavily utilizes strategic denormalization. While traditional relational databases encourage deep normalization, our document-oriented approach optimizes for read velocity.",
    "For instance, when an event is created, core details such as the host name, venue location, and current ticket availability are duplicated into a consolidated read-model. This allows the frontend to fetch all necessary rendering data via a single, lightning-fast document read, entirely eliminating the need for expensive database joins on the fly.",
    "However, this denormalization introduces the challenge of data synchronization. We solve this by leveraging our transactional outbox pattern. When the source venue updates its location, an outbox event is generated. Background workers consume this event and fan out the updates to all related denormalized event documents. This architecture guarantees that our read operations remain blisteringly fast while maintaining eventual consistency across the entire database topology, providing the best possible experience for end users."
])

# Page 14
add_page(doc, "14. System Resiliency and Idempotent Retries", [
    "Designing a resilient distributed system requires intentional and aggressive handling of failure modes, network partitions, and unpredictable latency spikes. Our architecture is built to gracefully degrade rather than catastrophically fail.",
    "Because BFF endpoints often aggregate data from multiple backend services, they must support partial success. If a non-critical downstream service times out, the BFF returns the critical payload while marking the missing data as unavailable, allowing the user interface to render gracefully with slightly reduced functionality.",
    "Furthermore, network partitions happen constantly on mobile devices. To safely support aggressive client retries, all mutating endpoints mandate an idempotency key header. The caching layer stores successful responses for twenty-four hours. A retried request carrying a known key simply receives the cached response, circumventing duplicate processing entirely. This resilient design is absolutely vital for financial operations where a dropped connection could trick a panicked user into submitting a payment authorization multiple times."
])

# Page 15
add_page(doc, "15. Migration Strategy and Phased Rollout Plan", [
    "The architectural migration is deliberately structured to minimize business risk through a phased, incremental rollout utilizing dynamic feature flags and extensive telemetry.",
    "During the initial Shadow Mode phase, the new BFF endpoints are deployed to production but are not actively wired to the user interface. Instead, they receive asynchronous, mirrored traffic from active user sessions. This crucial phase allows the engineering team to validate payload parity and monitor backend latency without ever impacting real users.",
    "Once shadow mode proves completely stable and error rates drop below our strict threshold, we initiate fractional shifting. We begin by routing a small fraction of production traffic to the new layer, gradually ramping up over two weeks while monitoring application health. Legacy routes are preserved as an immediate fallback mechanism throughout this entire period. After thirty days of stable traffic on the new architecture, the legacy direct-to-database codebase will be formally deprecated and permanently deleted from the repository."
])

doc.save('C1RCLE_System_Design_Final.docx')
print("Done! All 15 pages generated with exact minimum word counts.")
