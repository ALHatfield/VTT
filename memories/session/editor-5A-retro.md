# editor phase 5A — Retro Log

| # | Category | Description | Cost | Suggestion |
|---|----------|-------------|------|------------|
| 1 | Blocker | Server route tests fail (`Unexpected token 'with'`) — pre-existing Node 18 issue, affects all server route suites | Medium | Upgrade to Node 20+ to unlock server integration tests |
| 2 | Blocker | `sharp` types missing with node16 moduleResolution — exports map lacks `types` condition | Low | Create `sharp.d.ts` stub in shared/types; or add `paths` override in tsconfig |
