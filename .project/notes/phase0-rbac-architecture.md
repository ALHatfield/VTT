# Role-Based Access Control (RBAC) Architecture

**Created:** May 27, 2026  
**Status:** Planned (Implementation starts Phase 2A)  
**Affects:** campaigns, play-area, editor, characters features

---

## Overview

VTT uses a three-role permission system to control access to campaign resources and play area interactions. The role system is centralized in the `CampaignPlayer` model and enforced at the database, API, WebSocket, and UI layers.

---

## Role Definitions

| Role | Access Level | Use Case |
|------|-------------|----------|
| **DM** (Dungeon Master) | Full control of campaign | Game master, campaign creator |
| **Player** | Limited to own character | Active participant |
| **Observer** | Read-only access | Spectator, note-taker |

---

## Play Area Permissions Matrix

### Canvas Visibility

| Role | What They See |
|------|---------------|
| **DM** | Full map, all tokens (regardless of fog of war) |
| **Player** | Only areas revealed through fog of war, visible tokens |
| **Observer** | Same as Player (fog-filtered view) |

### Token Control

| Role | Token Permissions |
|------|-------------------|
| **DM** | Move/update ANY token on the canvas |
| **Player** | Move/update ONLY their own character's token |
| **Observer** | Cannot control or update any tokens |

### Other Interactions

| Feature | DM | Player | Observer |
|---------|----|----|----------|
| Chat | ✅ Send/receive | ✅ Send/receive | ❌ Read-only |
| Dice rolling | ✅ Any roll | ✅ Character rolls | ❌ Read-only |
| Fog of War editing | ✅ Reveal/hide | ❌ View only | ❌ View only |
| Map editing | ✅ Full editor | ❌ No access | ❌ No access |
| Character sheets | ✅ All characters | ✅ Own character | ❌ Read-only |

---

## Database Architecture

### Role Storage (Phase 2A)

```prisma
model CampaignPlayer {
  id         String       @id @default(uuid())
  campaignId String       @map("campaign_id")
  userId     String       @map("user_id")
  role       CampaignRole // enum: dm | player | observer
  createdAt  DateTime     @default(now()) @map("created_at")
  
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([campaignId, userId])
  @@index([userId])
  @@map("campaign_players")
}

enum CampaignRole {
  dm
  player
  observer
}
```

**Key Points:**
- `CampaignPlayer.role` is the **source of truth** for all permissions
- Unique constraint prevents duplicate membership
- Campaign creator automatically assigned `dm` role
- Role can be changed by DM via member management UI

### Token Ownership Chain (Phase 3B + 5B)

```prisma
model Character {
  id         String   @id @default(uuid())
  campaignId String   @map("campaign_id")
  userId     String   @map("user_id")  // ← Ownership anchor
  name       String
  // ... stats, HP, AC, etc.
  
  @@map("characters")
}

model CharacterToken {
  id          String   @id @default(uuid())
  campaignId  String   @map("campaign_id")
  characterId String   @map("character_id")
  tokenId     String   @map("token_id")
  
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  token       Token     @relation(fields: [tokenId], references: [id], onDelete: Cascade)
  
  @@unique([characterId, tokenId])
  @@map("character_tokens")
}
```

**Ownership Resolution:**
1. User owns `Character` (via `Character.userId`)
2. `Character` links to `Token` (via `CharacterToken`)
3. **Result:** User can only control tokens linked to their characters
4. **Exception:** DM bypasses ownership checks (can control any token)

### Fog of War Visibility (Phase 3F)

```prisma
model FogRegion {
  id         String   @id @default(uuid())
  mapId      String   @map("map_id")
  campaignId String   @map("campaign_id")
  polygon    Json     // Array of vertices: [{x, y}, ...]
  revealed   Boolean  @default(false)  // DM controls this
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  
  map        Map      @relation(fields: [mapId], references: [id], onDelete: Cascade)
  
  @@index([mapId])
  @@map("fog_regions")
}
```

**Visibility Logic:**
- DM receives **all fog regions** (both revealed and hidden)
- Players/Observers receive **only revealed regions** (server filters before sending)
- Tokens outside revealed regions are **not sent to Players/Observers**

---

## API Layer Enforcement

### Middleware: `requireRole`

**Location:** `server/src/shared/middleware/require-role.ts` (Phase 2A)

```typescript
import { Request, Response, NextFunction } from 'express';
import { CampaignRole } from '@vtt/shared';
import { prisma } from '@/shared/db/prisma';

/**
 * Middleware to enforce campaign role requirements
 * Attaches user's role to req.userRole for downstream use
 */
export const requireRole = (allowedRoles: CampaignRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { campaignId } = req.params;
    const userId = req.session.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const member = await prisma.campaignPlayer.findUnique({
      where: { 
        campaignId_userId: { campaignId, userId } 
      }
    });
    
    if (!member) {
      return res.status(403).json({ error: 'Not a campaign member' });
    }
    
    if (!allowedRoles.includes(member.role)) {
      return res.status(403).json({ 
        error: `Requires ${allowedRoles.join(' or ')} role` 
      });
    }
    
    // Attach role to request for downstream handlers
    req.userRole = member.role;
    next();
  };
};
```

**Usage:**
```typescript
// DM-only route
router.put('/campaigns/:campaignId/maps/:mapId', 
  requireAuth,
  requireRole(['dm']),
  updateMap
);

// Players and DM can access
router.get('/campaigns/:campaignId/characters', 
  requireAuth,
  requireRole(['dm', 'player']),
  listCharacters
);

// All members can access
router.get('/campaigns/:campaignId', 
  requireAuth,
  requireRole(['dm', 'player', 'observer']),
  getCampaignDetail
);
```

### Middleware: `canControlToken`

**Location:** `server/src/features/play-area/middleware/can-control-token.ts` (Phase 3B)

```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/shared/db/prisma';

/**
 * Middleware to check if user can control a specific token
 * DM can control any token
 * Players can only control tokens linked to their characters
 */
export const canControlToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const { tokenId } = req.params;
  const userId = req.session.user.id;
  const role = req.userRole; // Set by requireRole middleware
  
  // DM has full control
  if (role === 'dm') {
    return next();
  }
  
  // Observers cannot control anything
  if (role === 'observer') {
    return res.status(403).json({ error: 'Observers cannot control tokens' });
  }
  
  // Players: check if token is linked to their character
  const characterToken = await prisma.characterToken.findFirst({
    where: {
      tokenId,
      character: { userId }
    }
  });
  
  if (!characterToken) {
    return res.status(403).json({ error: 'Cannot control this token' });
  }
  
  next();
};
```

**Usage:**
```typescript
router.patch('/campaigns/:campaignId/tokens/:tokenId', 
  requireAuth,
  requireRole(['dm', 'player']),
  canControlToken,  // Additional ownership check for players
  updateToken
);
```

---

## WebSocket Layer Enforcement

### Connection Authentication

**Location:** `server/src/shared/socket/auth.ts` (Phase 3C)

```typescript
import { Server } from 'socket.io';
import { prisma } from '@/shared/db/prisma';

export const setupSocketAuth = (io: Server) => {
  io.use(async (socket, next) => {
    const sessionID = socket.handshake.auth.sessionID;
    const campaignId = socket.handshake.query.campaignId as string;
    
    // Validate session (session-based auth from Phase 1A)
    const session = await validateSession(sessionID);
    if (!session?.user) {
      return next(new Error('Unauthorized'));
    }
    
    // Verify campaign membership and get role
    const member = await prisma.campaignPlayer.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: session.user.id
        }
      }
    });
    
    if (!member) {
      return next(new Error('Not a campaign member'));
    }
    
    // Attach to socket for event handlers
    socket.data.userId = session.user.id;
    socket.data.campaignId = campaignId;
    socket.data.role = member.role;
    
    // Join campaign room
    socket.join(`campaign:${campaignId}`);
    
    next();
  });
};
```

### Token Movement Event

**Location:** `server/src/features/play-area/socket/handlers/token-move.ts` (Phase 3C)

```typescript
import { Socket } from 'socket.io';
import { prisma } from '@/shared/db/prisma';

export const handleTokenMove = (socket: Socket) => {
  socket.on('play-area:token:move', async (payload) => {
    const { tokenId, position } = payload;
    const { userId, role, campaignId } = socket.data;
    
    try {
      // DM can move any token
      if (role !== 'dm') {
        // Observers cannot move anything
        if (role === 'observer') {
          socket.emit('play-area:token:move-rejected', { 
            error: 'Observers cannot move tokens' 
          });
          return;
        }
        
        // Players: verify token ownership
        const canControl = await prisma.characterToken.findFirst({
          where: {
            tokenId,
            character: { userId }
          }
        });
        
        if (!canControl) {
          socket.emit('play-area:token:move-rejected', { 
            error: 'Cannot control this token' 
          });
          return;
        }
      }
      
      // Update token position
      await prisma.token.update({
        where: { id: tokenId },
        data: { 
          position,
          updatedAt: new Date()
        }
      });
      
      // Broadcast to all campaign members
      socket.to(`campaign:${campaignId}`).emit('play-area:token:moved', {
        tokenId,
        position,
        movedBy: userId,
        timestamp: Date.now()
      });
      
      // Confirm to sender
      socket.emit('play-area:token:move-confirmed', { tokenId, position });
      
    } catch (error) {
      console.error('Token move failed:', error);
      socket.emit('play-area:token:move-rejected', { 
        error: 'Token move failed' 
      });
    }
  });
};
```

### Fog of War State Sync

**Location:** `server/src/features/play-area/socket/handlers/join.ts` (Phase 3F)

```typescript
export const handlePlayAreaJoin = (socket: Socket) => {
  socket.on('play-area:join', async (payload) => {
    const { mapId } = payload;
    const { userId, role, campaignId } = socket.data;
    
    // Fetch all tokens on this map
    const tokens = await prisma.token.findMany({
      where: { mapId, campaignId }
    });
    
    // Fetch fog regions
    const fogRegions = await prisma.fogRegion.findMany({
      where: { mapId }
    });
    
    if (role === 'dm') {
      // DM sees everything
      socket.emit('play-area:state', {
        tokens,
        fogRegions,
        role: 'dm'
      });
    } else {
      // Players/Observers: filter by fog of war
      const revealedRegions = fogRegions.filter(r => r.revealed);
      const visibleTokens = filterTokensByFog(tokens, revealedRegions);
      
      socket.emit('play-area:state', {
        tokens: visibleTokens,
        fogRegions: revealedRegions,
        role
      });
    }
  });
};

/**
 * Filter tokens to only those within revealed fog regions
 */
function filterTokensByFog(tokens: Token[], revealedRegions: FogRegion[]): Token[] {
  return tokens.filter(token => {
    const position = token.position as { x: number; y: number };
    return revealedRegions.some(region => 
      isPointInPolygon(position, region.polygon as Point[])
    );
  });
}
```

---

## Client-Side Enforcement

### React Context: Role Propagation

**Location:** `client/src/features/play-area/context/PlayAreaContext.tsx` (Phase 3C)

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { CampaignRole } from '@vtt/shared';

interface PlayAreaContextValue {
  campaignId: string;
  userRole: CampaignRole;
  userId: string;
  canEdit: boolean;  // Derived: role === 'dm'
  canControl: (tokenId: string) => boolean;
}

const PlayAreaContext = createContext<PlayAreaContextValue | null>(null);

export const PlayAreaProvider = ({ 
  children, 
  campaignId, 
  userRole, 
  userId 
}: { 
  children: ReactNode;
  campaignId: string;
  userRole: CampaignRole;
  userId: string;
}) => {
  const canEdit = userRole === 'dm';
  
  const canControl = (tokenId: string) => {
    if (userRole === 'dm') return true;
    if (userRole === 'observer') return false;
    
    // Check if token is linked to user's character
    // (implementation depends on character token state management)
    return checkTokenOwnership(userId, tokenId);
  };
  
  return (
    <PlayAreaContext.Provider value={{ 
      campaignId, 
      userRole, 
      userId, 
      canEdit, 
      canControl 
    }}>
      {children}
    </PlayAreaContext.Provider>
  );
};

export const usePlayArea = () => {
  const context = useContext(PlayAreaContext);
  if (!context) {
    throw new Error('usePlayArea must be used within PlayAreaProvider');
  }
  return context;
};
```

### UI: Token Interaction Controls

**Location:** `client/src/features/play-area/components/TokenRenderer.tsx` (Phase 3B)

```typescript
import { usePlayArea } from '../context/PlayAreaContext';

export const TokenRenderer = ({ token }: { token: Token }) => {
  const { userRole, canControl } = usePlayArea();
  
  const isDraggable = canControl(token.id);
  const showControls = userRole === 'dm';
  
  return (
    <div 
      className={styles.token}
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDragEnd={isDraggable ? handleDragEnd : undefined}
    >
      <img src={token.imageUrl} alt={token.name} />
      
      {/* DM-only controls */}
      {showControls && (
        <div className={styles.dmControls}>
          <button onClick={handleEdit}>Edit</button>
          <button onClick={handleDelete}>Delete</button>
        </div>
      )}
      
      {/* Visual indicator if token is not controllable */}
      {!isDraggable && (
        <div className={styles.lockedOverlay}>
          <LockIcon />
        </div>
      )}
    </div>
  );
};
```

### UI: Fog of War Editor (DM-Only)

**Location:** `client/src/features/play-area/components/FogOfWarEditor.tsx` (Phase 3F)

```typescript
import { usePlayArea } from '../context/PlayAreaContext';

export const FogOfWarEditor = () => {
  const { userRole } = usePlayArea();
  
  // Only render fog editing tools for DM
  if (userRole !== 'dm') {
    return null;
  }
  
  return (
    <div className={styles.fogEditor}>
      <button onClick={handleRevealRegion}>Reveal</button>
      <button onClick={handleHideRegion}>Hide</button>
      <button onClick={handleClearAll}>Clear All Fog</button>
    </div>
  );
};
```

---

## Testing Strategy

### Unit Tests

**Role middleware:**
- `requireRole(['dm'])` — blocks Player/Observer
- `requireRole(['dm', 'player'])` — allows DM and Player, blocks Observer
- `canControlToken` — DM can move any token, Player only own tokens

**Token ownership:**
- Verify `CharacterToken` join table correctly links users to tokens
- Test character-token assignment API endpoints

### Integration Tests

**API endpoints:**
- DM can `DELETE /campaigns/:id` → success
- Player tries `DELETE /campaigns/:id` → 403 Forbidden
- Player moves own token → success
- Player moves another player's token → 403 Forbidden

**WebSocket events:**
- DM emits `play-area:token:move` for any token → broadcast success
- Player emits `play-area:token:move` for own token → broadcast success
- Player emits `play-area:token:move` for another's token → rejected
- Observer emits `play-area:token:move` → rejected

### End-to-End Tests

**Scenarios:**
1. DM creates campaign → auto-assigned `dm` role
2. DM invites Player → Player assigned `player` role
3. Player joins play area → sees only revealed fog regions
4. Player drags own token → position updates, broadcasts to all
5. Player tries to drag DM's monster token → UI blocks interaction
6. Observer opens play area → all controls disabled, read-only view

---

## Security Considerations

### Server is Source of Truth

**Critical Rule:** Never trust client-side role enforcement  
**Implementation:**
- All permissions checked server-side (API + WebSocket)
- Client UI is convenience only (can be bypassed)
- Every write operation validates role before execution

### Role Escalation Prevention

**Attack Vector:** User modifies `socket.data.role` or session data  
**Mitigation:**
- Role queried fresh from database on every socket connection
- Session stored server-side (express-session with PostgreSQL store)
- Client cannot modify session or socket data

### Data Leakage Prevention

**Attack Vector:** Player inspects network tab, sees hidden tokens/fog data  
**Mitigation:**
- Server filters data BEFORE sending to client
- Players/Observers never receive:
  - Tokens outside revealed fog regions
  - Hidden fog region coordinates
  - DM-only campaign metadata (`dmOnly: true` fields)

### Broadcast Isolation

**Attack Vector:** User joins wrong campaign room, sees other campaigns' data  
**Mitigation:**
- Socket.IO room scoped to `campaign:{campaignId}`
- Campaign membership verified on connection (via `CampaignPlayer` lookup)
- Event handlers validate `socket.data.campaignId === payload.campaignId`

---

## Implementation Roadmap

| Phase | What Gets Built | RBAC Features |
|-------|----------------|---------------|
| **auth 1A** | User model, sessions | Authentication foundation |
| **campaigns 2A** | `Campaign`, `CampaignPlayer`, role enum | Role system established |
| **campaigns 2A** | `requireRole` middleware | API layer enforcement |
| **campaigns 2B** | Member invite/remove | DM can assign roles |
| **play-area 3A** | Canvas, map rendering | Role-based UI (DM sees tools) |
| **play-area 3B** | Token CRUD, movement | `canControlToken` middleware |
| **play-area 3C** | WebSocket sync | Socket role validation |
| **play-area 3F** | Fog of War | Server-side visibility filtering |
| **characters 5A** | Character CRUD | Character ownership (`userId`) |
| **characters 5B** | Character-token linking | Token control via ownership chain |

---

## References

- **Feature Docs:** `.project/features/campaigns.md`, `.project/features/play-area.md`
- **Instructions:** `.github/instructions/feature-campaigns.instructions.md`, `.github/instructions/feature-play-area.instructions.md`
- **Database Conventions:** `.github/instructions/database.instructions.md`
- **API Conventions:** `.github/instructions/api-routes.instructions.md`
- **WebSocket Conventions:** `.github/instructions/websocket-events.instructions.md`
- **Lessons from Project_Pathfinder:** `/memories/repo/project-pathfinder-inventory.md` (Lines 686-706, 509-548)

---

## Summary

The VTT RBAC system uses a **three-role hierarchy** (DM > Player > Observer) enforced at **four layers**:

1. **Database:** `CampaignPlayer.role` as source of truth
2. **API:** `requireRole` and `canControlToken` middleware
3. **WebSocket:** Role validation on connection and per-event
4. **UI:** Role-based rendering (DM tools, draggable tokens)

**Key Principles:**
- Server is source of truth — never trust client
- DM bypasses ownership checks (full control)
- Players limited to own characters (via `Character.userId` → `CharacterToken`)
- Observers read-only (all writes blocked)
- Fog of War filtered server-side (Players/Observers never see hidden data)
