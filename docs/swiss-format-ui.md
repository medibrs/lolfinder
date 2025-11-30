# Swiss Format UI Documentation

## Overview

The Swiss Format UI is a comprehensive tournament bracket system that displays Swiss-style tournaments with match progression, arrows, and topcut brackets. The system is built with React components and accepts structured JSON data to render the bracket.

## Core Components

### 1. SwissMatchContainer
The main container that orchestrates the entire bracket display.

```tsx
<SwissMatchContainer columns={columnsData} />
```

### 2. SwissMatchColumn
Represents a single column in the bracket (typically a round number).

### 3. SwissMatchCardWrapper
Wraps match groups with titles and optional progression arrows.

### 4. SwissMatchCard
Displays individual matches between two teams with status indicators.

### 5. TopCutCard
Displays the final elimination bracket with configurable layouts.

### 6. BracketArrow
Stylized arrows showing match progression (straight or curved).

## JSON Data Structure

### Top Level Structure

```typescript
interface SwissFormatData {
  columns: Array<{
    rounds: SwissRound[]
  }>
}
```

### Swiss Round Interface

```typescript
interface SwissRound {
  title: string                          // Round display name (e.g., "2:1", "0:3")
  type?: 'matches' | 'topcut'           // Type of round (default: 'matches')
  isLastRound?: boolean                  // Flag for last Swiss round before topcut
  teamPairs?: Array<{                   // Match data for Swiss rounds
    team1: SwissMatchCardTeam | null
    team2: SwissMatchCardTeam | null
    status: 'live' | 'scheduled' | 'done'
    winner?: 'team1' | 'team2' | null
  }>
  topCut?: {                            // Topcut bracket data
    title?: string
    teams?: SwissMatchCardTeam[]        // Single layout teams
    leftTeams?: SwissMatchCardTeam[]    // Versus layout left column
    rightTeams?: SwissMatchCardTeam[]   // Versus layout right column
    leftTitle?: string                  // Versus layout left title
    rightTitle?: string                 // Versus layout right title
    backgroundColor?: 'green' | 'red' | 'default'
  }
}
```

### Team Interface

```typescript
interface SwissMatchCardTeam {
  id: string
  name: string
  team_avatar?: number                  // Avatar ID/number
}
```

## Usage Examples

### Basic Swiss Tournament

```json
{
  "columns": [
    {
      "rounds": [
        {
          "title": "3:0",
          "teamPairs": [
            {
              "team1": { "id": "1", "name": "Team Alpha", "team_avatar": 1 },
              "team2": { "id": "2", "name": "Team Beta", "team_avatar": 2 },
              "status": "done",
              "winner": "team1"
            },
            {
              "team1": { "id": "3", "name": "Team Gamma", "team_avatar": 3 },
              "team2": { "id": "4", "name": "Team Delta", "team_avatar": 4 },
              "status": "live"
            }
          ]
        }
      ]
    }
  ]
}
```

### Complete Swiss Format with Topcut

```json
{
  "columns": [
    {
      "rounds": [
        {
          "title": "3:0",
          "teamPairs": [
            {
              "team1": { "id": "1", "name": "Team Alpha" },
              "team2": { "id": "2", "name": "Team Beta" },
              "status": "done",
              "winner": "team1"
            }
          ]
        },
        {
          "title": "2:1",
          "teamPairs": [
            {
              "team1": { "id": "3", "name": "Team Gamma" },
              "team2": { "id": "4", "name": "Team Delta" },
              "status": "live"
            }
          ]
        },
        {
          "title": "1:2",
          "isLastRound": true,
          "teamPairs": [
            {
              "team1": { "id": "5", "name": "Team Epsilon" },
              "team2": { "id": "6", "name": "Team Zeta" },
              "status": "scheduled"
            }
          ]
        },
        {
          "type": "topcut",
          "title": "3:0",
          "topCut": {
            "teams": [
              { "id": "1", "name": "Team Alpha" },
              { "id": "3", "name": "Team Gamma" }
            ],
            "backgroundColor": "green"
          }
        },
        {
          "type": "topcut",
          "title": "0:3",
          "topCut": {
            "teams": [
              { "id": "2", "name": "Team Beta" },
              { "id": "4", "name": "Team Delta" }
            ],
            "backgroundColor": "red"
          }
        }
      ]
    }
  ]
}
```

### Versus Layout Topcut

```json
{
  "type": "topcut",
  "title": "",
  "topCut": {
    "leftTeams": [
      { "id": "1", "name": "Team Alpha" },
      { "id": "2", "name": "Team Beta" }
    ],
    "rightTeams": [
      { "id": "3", "name": "Team Gamma" },
      { "id": "4", "name": "Team Delta" }
    ],
    "leftTitle": "Winners",
    "rightTitle": "Losers",
    "backgroundColor": "green"
  }
}
```

## Features and Customizations

### 1. Match Status Types

- **`live`**: Shows red glowing border with pulse animation
- **`scheduled`**: Default appearance
- **`done`**: Default appearance with optional winner highlighting

### 2. Arrow Progression System

The system automatically renders progression arrows based on round data:

- **Normal rounds**: Curved arrows on the right side (green for winners, red for losers)
- **Last round** (`isLastRound: true`): Straight arrows from top/bottom pointing to topcut
- **No arrows**: Final column or when no progression is needed

### 3. Topcut Layout Options

#### Single Layout
```json
{
  "topCut": {
    "teams": [team1, team2, team3, team4],
    "backgroundColor": "green"
  }
}
```
- Teams are grouped into pairs and displayed as match cards
- No "vs" text between teams
- Uses SwissMatchCard components for consistency

#### Versus Layout
```json
{
  "topCut": {
    "leftTeams": [team1, team2],
    "rightTeams": [team3, team4],
    "leftTitle": "Winners",
    "rightTitle": "Losers",
    "backgroundColor": "red"
  }
}
```
- Two-column layout on desktop
- Single column (stacked) on mobile for better readability
- Each column can have its own title

### 4. Background Colors

- **`green`**: Winners bracket (green tinted background)
- **`red`**: Losers bracket (red tinted background)
- **`default`**: Standard gray background

### 5. Responsive Design

The system is fully responsive with automatic adjustments:

- **Mobile**: Smaller text, condensed spacing, single-column layouts for versus topcut
- **Desktop**: Full spacing, two-column layouts where appropriate
- **Arrows**: Shorter and smaller on mobile to prevent overcrowding

### 6. Interactive Features

- **Team avatars**: Clickable to navigate to team pages (`/teams/{id}`)
- **Hover effects**: Scale animations on team avatars
- **Tooltips**: Show team names on avatar hover
- **Live indicators**: Pulsing red border for live matches

## Advanced Usage

### Custom Styling

Components accept `className` props for custom styling:

```tsx
<SwissMatchContainer 
  columns={data} 
  className="custom-bracket-container" 
/>
```

### Conditional Arrow Display

Arrows are controlled by the `isLastRound` flag and column position:

```json
{
  "title": "2:2",
  "isLastRound": true,    // Enables straight arrows to topcut
  "teamPairs": [...]
}
```

### Empty States

The system handles empty data gracefully:

```json
{
  "columns": [
    {
      "rounds": []  // Shows empty state placeholder
    }
  ]
}
```

## Best Practices

1. **Team Data**: Always provide `id` and `name` for teams. `team_avatar` is optional but recommended.
2. **Round Progression**: Use `isLastRound: true` for the final Swiss round before topcut.
3. **Status Updates**: Keep match statuses current for proper visual feedback.
4. **Winner Data**: Set `winner` field for completed matches to enable opacity effects.
5. **Mobile Consideration**: Limit teams per round on mobile to prevent overcrowding.

## Integration Example

```tsx
import { SwissMatchContainer } from '@/components/ui/swiss-match-container'

const tournamentData = {
  columns: [
    {
      rounds: [
        {
          title: "Round 1",
          teamPairs: [
            {
              team1: { id: "1", name: "Team A" },
              team2: { id: "2", name: "Team B" },
              status: "live"
            }
          ]
        }
      ]
    }
  ]
}

export function TournamentBracket() {
  return (
    <div className="tournament-container">
      <SwissMatchContainer columns={tournamentData.columns} />
    </div>
  )
}
```

## Data Flow

1. **Fetch Data**: Load tournament data from API or database
2. **Transform**: Convert data to the required JSON structure
3. **Render**: Pass data to `SwissMatchContainer`
4. **Interact**: Users can click teams to view details
5. **Update**: Real-time updates for live matches

## Performance Considerations

- Components are optimized for large tournaments
- Lazy loading can be implemented for very large brackets
- Avatar images should be optimized for web
- Consider pagination for tournaments with many rounds

This comprehensive system provides a flexible, interactive, and visually appealing way to display Swiss-style tournaments with full customization options.
