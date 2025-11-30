# Swiss Bracket UI Documentation

## Overview

The Swiss Bracket UI system provides components for displaying Swiss-format tournament brackets. It dynamically generates bracket structures based on team count and win/loss thresholds.

## Core Concepts

### Swiss Format Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `maxWins` | Wins needed to qualify (advance to playoffs) | 2 or 3 |
| `maxLosses` | Losses that eliminate a team | 2 or 3 |
| `teamCount` | Number of teams (should be power of 2) | 8, 16, 32 |

### Calculating Rounds

```
totalRounds = maxWins + maxLosses - 1
```

**Examples:**
- 8 teams, 2W/2L → 3 rounds + initial = **4 columns**
- 16 teams, 3W/3L → 5 rounds + initial = **6 columns**

### Bucket Naming Convention

Buckets are named `W:L` where:
- `W` = number of wins
- `L` = number of losses

**Example progression for 8 teams (2W/2L):**
```
Column 1: 0:0 (all teams start here)
Column 2: 1:0, 0:1
Column 3: 2:0 (qualified), 1:1, 0:2 (eliminated)
Column 4: 2:1 (qualified), 1:1 decider, 1:2 (eliminated)
```

---

## Components

### 1. `SwissBracketPreview`

Main component for rendering a complete Swiss bracket.

**Location:** `/components/tournament/swiss-bracket-preview.tsx`

**Props:**
```typescript
interface SwissBracketPreviewProps {
  teams: Team[]           // Array of team objects
  maxWins?: number        // Default: 2
  maxLosses?: number      // Default: 2
}

interface Team {
  id: string
  name: string
  team_avatar?: number    // League profile icon ID
}
```

**Usage:**
```tsx
<SwissBracketPreview 
  teams={registeredTeams} 
  maxWins={2}
  maxLosses={2}
/>
```

---

### 2. `SwissMatchContainer`

Container component that renders the entire bracket grid.

**Location:** `/components/ui/swiss-match-container.tsx`

**Props:**
```typescript
interface SwissMatchContainerProps {
  columns: Array<{
    rounds: SwissRound[]
  }>
}
```

---

### 3. `SwissMatchColumn`

Renders a single column of rounds.

**Location:** `/components/ui/swiss-match-column.tsx`

**Props:**
```typescript
interface SwissMatchColumnProps {
  rounds: SwissRound[]
  isLastColumn?: boolean
}
```

---

### 4. `SwissMatchCard`

Renders a single match between two teams.

**Location:** `/components/ui/swiss-match-card.tsx`

**Props:**
```typescript
interface SwissMatchCardProps {
  team1: SwissMatchCardTeam | null
  team2: SwissMatchCardTeam | null
  status: 'live' | 'scheduled' | 'done'
  winner?: 'team1' | 'team2' | null
  hideVs?: boolean
  backgroundColor?: 'green' | 'red' | 'default'
}
```

**Status styling:**
- `live` - Red pulsing border
- `scheduled` - Default gray border
- `done` - Winner highlighted with green border

---

### 5. `TopCutTeamGrid`

Displays qualified/eliminated teams in a grid layout.

**Location:** `/components/ui/top-cut-team-grid.tsx`

**Props:**
```typescript
interface TopCutTeamGridProps {
  teams?: SwissMatchCardTeam[]           // Single section
  leftTeams?: SwissMatchCardTeam[]       // Dual section - left
  rightTeams?: SwissMatchCardTeam[]      // Dual section - right
  title?: string
  leftTitle?: string                     // e.g., "3:0"
  rightTitle?: string                    // e.g., "3:1"
  backgroundColor?: 'green' | 'red' | 'default'
}
```

**Layout behavior:**
- **≤2 teams:** Horizontal layout (side by side)
- **>2 teams:** Vertical layout (stacked)

---

### 6. `TeamAvatar`

Renders a team's avatar icon.

**Location:** `/components/ui/team-avatar.tsx`

**Props:**
```typescript
interface TeamAvatarProps {
  team: { id: string; name: string; team_avatar?: number } | null
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  isWinner?: boolean
}
```

---

## Data Structures

### SwissRound

```typescript
interface SwissRound {
  title: string                          // e.g., "1:0", "2:1"
  type?: 'matches' | 'topcut'
  isLastRound?: boolean                  // Enables straight arrows
  teamPairs?: Array<{
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }>
  topCut?: {
    title?: string
    teams?: SwissMatchCardTeam[]
    leftTeams?: SwissMatchCardTeam[]
    rightTeams?: SwissMatchCardTeam[]
    leftTitle?: string
    rightTitle?: string
    backgroundColor?: 'green' | 'red' | 'default'
  }
}
```

### SwissFormatData

```typescript
interface SwissFormatData {
  columns: Array<{
    rounds: SwissRound[]
  }>
}
```

---

## Placeholder Teams

Placeholder teams are used for unfilled slots:

```typescript
const createPlaceholder = (id: string) => ({
  id: `ph-${id}`,      // MUST start with 'ph-' for detection
  name: 'TBD',
  team_avatar: undefined
})
```

**Important:** Placeholder IDs must start with `ph-` for the system to:
- Skip them in match scheduling
- Recognize empty slots for team placement
- Display shield icons instead of avatars

---

## Bracket Generation Logic

### Team Distribution Formula

Teams in each bucket follow the binomial distribution:

```
bucketCount(w, l) = teamCount × C(w+l, w) / 2^(w+l)
```

Where `C(n, r)` is the combination formula.

**Example for 8 teams:**
| Bucket | Formula | Count |
|--------|---------|-------|
| 0:0 | 8 × C(0,0) / 2^0 | 8 |
| 1:0 | 8 × C(1,1) / 2^1 | 4 |
| 0:1 | 8 × C(1,0) / 2^1 | 4 |
| 2:0 | 8 × C(2,2) / 2^2 | 2 |
| 1:1 | 8 × C(2,1) / 2^2 | 4 |
| 0:2 | 8 × C(2,0) / 2^2 | 2 |

---

## Simulation Logic

### Match Progression

1. **Play match** → Determine winner randomly or from result
2. **Update records** → Increment winner's wins, loser's losses
3. **Check bucket completion** → All matches in bucket done?
4. **Collect teams** → Gather winners/losers in pending pool
5. **Wait for all sources** → Target bucket may receive from multiple sources
6. **Shuffle teams** → Randomize matchups
7. **Create new matches** → Pair teams for next round

### Pending Pool System

Teams are collected in a `pendingTeams` array until enough teams arrive:

```typescript
// Add teams to pending pool
(targetRound as any).pendingTeams.push(...winners)

// Check if ready to create matchups
const expectedTeams = targetRound.teamPairs.length * 2
if (pendingTeams.length >= expectedTeams) {
  // Shuffle and create matches
  const shuffled = [...pendingTeams].sort(() => Math.random() - 0.5)
  // ... pair teams
}
```

---

## Usage Examples

### Basic Tournament Page

```tsx
import { SwissBracketPreview } from '@/components/tournament/swiss-bracket-preview'

export default function TournamentPage({ tournament, teams }) {
  return (
    <SwissBracketPreview 
      teams={teams}
      maxWins={Math.ceil(tournament.swiss_rounds / 2)}
      maxLosses={Math.ceil(tournament.swiss_rounds / 2)}
    />
  )
}
```

### Custom Bracket with Manual Data

```tsx
import { SwissMatchContainer } from '@/components/ui/swiss-match-container'

const bracketData = {
  columns: [
    {
      rounds: [
        {
          title: "0:0",
          teamPairs: [
            { team1: teams[0], team2: teams[1], status: 'done', winner: 'team1' },
            { team1: teams[2], team2: teams[3], status: 'done', winner: 'team2' },
          ]
        }
      ]
    },
    // ... more columns
  ]
}

<SwissMatchContainer columns={bracketData.columns} />
```

---

## Styling

### Color Scheme

| Element | Color | Usage |
|---------|-------|-------|
| Qualified | `bg-green-900/30` | Teams that reached maxWins |
| Eliminated | `bg-red-900/30` | Teams that reached maxLosses |
| Winner highlight | `border-green-500` | Match winner |
| Live match | `border-red-500` | Currently playing |
| Default | `bg-zinc-900` | Standard matches |

### Responsive Design

- Desktop: Full bracket with arrows
- Mobile: Compact layout, smaller avatars, hidden VS text

---

## Common Issues

### 1. Teams not showing avatars
- Ensure `team_avatar` is a valid League profile icon ID
- Check that team ID doesn't start with `ph-`

### 2. Matchups created too early
- Ensure pending pool system is working
- Check that `expectedTeams` count matches bucket capacity

### 3. Wrong number of rounds
- Verify `maxWins` and `maxLosses` values
- Formula: `totalRounds = maxWins + maxLosses - 1`

### 4. Placeholders not detected
- Placeholder IDs MUST start with `ph-`
- Check: `team.id.startsWith('ph-')`
