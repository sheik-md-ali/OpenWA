# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **[P1] Idempotency Key**: Made `generateIdempotencyKey` deterministic by removing `Date.now()`. Keys are now content-based for proper deduplication
- **[P2] Webhook Processor**: Added `lastTriggeredAt` update and `webhook:delivered`/`webhook:error` hooks after queue delivery
- **[P2] Hook Semantics**: Added `webhook:queued` event for queue mode; `webhook:after` now only fires in direct mode
- **[P2] QueueModule DI**: Added `TypeOrmModule.forFeature([Webhook])` and `HooksModule` imports for proper dependency injection
- **[P3] Message Processor**: Changed placeholder to throw error so BullMQ correctly marks job as failed

### Added

- New hook events: `webhook:queued` (after queue add) and `webhook:delivered` (after actual delivery)

## [0.1.0] - 2026-02-05

### 🎉 Initial Release

OpenWA v0.1.0 is the first stable release featuring a complete WhatsApp API Gateway with all core functionality.

### Core Features

- **REST API** for WhatsApp operations
- **Multi-session** support with concurrent session handling
- **Web Dashboard** for visual management
- **WebSocket** real-time events via Socket.IO
- **API Key Authentication** with role-based permissions
- **Webhook System** with HMAC signatures and queue-based retries

### Messaging

- Send/receive text, image, video, audio, document messages
- Message reactions and replies
- Bulk messaging with rate limiting
- Location and contact sharing
- Sticker support

### Advanced Features

- **Groups API** - Full CRUD operations
- **Channels/Newsletter** support
- **Labels Management**
- **Catalog API** for product management
- **Status/Stories** support
- **Proxy per Session** configuration
- **Plugin System** for extensibility

### Infrastructure

- SQLite (development) and PostgreSQL (production) support
- Redis queue for webhook delivery (optional)
- S3/MinIO storage for media (optional)
- Docker + Docker Compose deployment
- Traefik reverse proxy integration
- Health check endpoints
- Zero-config onboarding with auto-generated API key

### Security

- API key authentication with SHA-256 hashing
- Rate limiting (configurable)
- CIDR IP whitelisting
- CORS configuration
- Helmet security headers
- Audit logging for all operations

### Dashboard

- Session management with QR code display
- Webhook configuration and testing
- API key management
- Message tester for debugging
- Infrastructure status monitoring
- Audit logs viewer
- Plugin management
