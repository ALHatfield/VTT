---
description: "Portal feature — authenticated shell layout, navigation, and welcome page."
applyTo: "**/features/portal/**"
---
# Feature: portal

> For current phase status and tasks, see `.project/features/portal.md`

## Overview
The portal is the authenticated user's main navigation hub. It provides the shared layout shell (top bar, sidebar navigation) that wraps the `/welcome`, `/campaigns`, `/characters`, and `/account` routes. After login, users land on the welcome page within the portal layout.

## Layout
- **Top bar**: VTT branding (left), user greeting with display name and avatar placeholder (right)
- **Left sidebar**: Navigation links to all portal routes, highlights the active route
- **Content area**: Renders the matched child route via React Router `<Outlet />`
- Layout uses CSS Grid: `grid-template-areas: "topBar topBar" / "sidebar content"`

## Routes (Client-Side Only)
| Route | Component | Description |
|-------|-----------|-------------|
| `/welcome` | `Welcome` | Static news and information page (MVP) |
| `/campaigns` | Placeholder → campaigns feature | Campaign list entry point |
| `/characters` | Placeholder → characters feature | Character list entry point |
| `/account` | `Account` | Account settings (coming soon) |

## Navigation
- Use React Router `NavLink` for active state styling on sidebar links
- Sidebar highlights the current route with accent color and left border indicator
- Navigation items: news (`/welcome`), campaigns (`/campaigns`), character sheets (`/characters`), account settings (`/account`)

## Integration Points
- **auth**: Portal routes require authentication via `ProtectedRoute` wrapper
- **campaigns**: Campaign list component replaces the campaigns placeholder in Phase 3A
- **characters**: Character list component replaces the characters placeholder in Phase 6A
