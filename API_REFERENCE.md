# API Reference

Base URL: `http://localhost:3000/api` (development) or `https://your-app.vercel.app/api` (production)

## Players

### List Players
```http
GET /api/players
```

**Query Parameters:**
- `role` - Filter by role (Top, Jungle, Mid, ADC, Support)
- `tier` - Filter by tier (Iron, Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Challenger)
- `region` - Filter by region (NA, EUW, EUNE, KR, BR, LAN, LAS, OCE, RU, TR, JP)
- `lookingForTeam` - Filter by LFT status (true/false)

**Example:**
```bash
curl "http://localhost:3000/api/players?role=Mid&tier=Gold&lookingForTeam=true"
```

### Create Player
```http
POST /api/players
```

**Body:**
```json
{
  "summoner_name": "PlayerName",
  "discord": "username#1234",
  "main_role": "Mid",
  "secondary_role": "Top",
  "opgg_link": "https://op.gg/...",
  "tier": "Gold",
  "region": "NA",
  "looking_for_team": true
}
```

### Get Player
```http
GET /api/players/{id}
```

### Update Player
```http
PUT /api/players/{id}
```

**Body:** (all fields optional)
```json
{
  "summoner_name": "NewName",
  "tier": "Platinum",
  "looking_for_team": false
}
```

### Delete Player
```http
DELETE /api/players/{id}
```

---

## Teams

### List Teams
```http
GET /api/teams
```

**Query Parameters:**
- `tier` - Filter by tier
- `region` - Filter by region
- `recruiting` - Filter by recruiting status (Open, Closed, Full)

### Create Team
```http
POST /api/teams
```

**Body:**
```json
{
  "name": "Team Name",
  "description": "Team description",
  "captain_id": "uuid-of-captain-player",
  "open_positions": ["Top", "Support"],
  "tier": "Gold",
  "region": "NA",
  "recruiting_status": "Open"
}
```

### Get Team
```http
GET /api/teams/{id}
```

Returns team with captain info and all members.

### Update Team
```http
PUT /api/teams/{id}
```

### Delete Team
```http
DELETE /api/teams/{id}
```

### Add Member to Team
```http
POST /api/teams/{id}/members
```

**Body:**
```json
{
  "player_id": "uuid-of-player"
}
```

### Remove Member from Team
```http
DELETE /api/teams/{id}/members/{playerId}
```

---

## Tournaments

### List Tournaments
```http
GET /api/tournaments
```

**Query Parameters:**
- `upcoming=true` - Only show upcoming tournaments

### Create Tournament
```http
POST /api/tournaments
```

**Body:**
```json
{
  "name": "Tournament Name",
  "description": "Tournament description",
  "start_date": "2024-12-01T10:00:00Z",
  "end_date": "2024-12-01T18:00:00Z",
  "prize_pool": "$1000",
  "max_teams": 16,
  "rules": "Tournament rules..."
}
```

### Get Tournament
```http
GET /api/tournaments/{id}
```

### Update Tournament
```http
PUT /api/tournaments/{id}
```

### Delete Tournament
```http
DELETE /api/tournaments/{id}
```

### Register Team for Tournament
```http
POST /api/tournaments/{id}/register
```

**Body:**
```json
{
  "team_id": "uuid-of-team"
}
```

### Get Tournament Registrations
```http
GET /api/tournaments/{id}/registrations
```

---

## Registrations

### Get Registration
```http
GET /api/registrations/{id}
```

### Update Registration Status
```http
PUT /api/registrations/{id}
```

**Body:**
```json
{
  "status": "Confirmed"
}
```

**Status values:** `Pending`, `Confirmed`, `Rejected`

---

## Search

### Advanced Search
```http
GET /api/search
```

**Required Parameters:**
- `type` - Search type: `player` or `team`

**Optional Parameters:**

For players:
- `query` - Search in summoner name and discord
- `role` - Filter by role
- `tier` - Filter by tier
- `region` - Filter by region
- `lookingForTeam` - Filter by LFT status

For teams:
- `query` - Search in team name and description
- `tier` - Filter by tier
- `region` - Filter by region
- `recruiting` - Filter by recruiting status

**Examples:**
```bash
# Search for Mid players in Gold
curl "http://localhost:3000/api/search?type=player&role=Mid&tier=Gold"

# Search for teams recruiting in NA
curl "http://localhost:3000/api/search?type=team&region=NA&recruiting=Open"

# Text search for players
curl "http://localhost:3000/api/search?type=player&query=faker"
```

---

## Response Formats

### Success Response
```json
{
  "id": "uuid",
  "summoner_name": "PlayerName",
  "created_at": "2024-01-01T00:00:00Z",
  ...
}
```

### Error Response
```json
{
  "error": "Error message"
}
```

### Validation Error Response
```json
{
  "error": "Validation error",
  "details": [
    {
      "path": ["field_name"],
      "message": "Error message"
    }
  ]
}
```

---

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

---

## Data Types

### Role
`Top` | `Jungle` | `Mid` | `ADC` | `Support`

### Tier
`Iron` | `Bronze` | `Silver` | `Gold` | `Platinum` | `Diamond` | `Master` | `Grandmaster` | `Challenger`

### Region
`NA` | `EUW` | `EUNE` | `KR` | `BR` | `LAN` | `LAS` | `OCE` | `RU` | `TR` | `JP`

### Recruiting Status
`Open` | `Closed` | `Full`

### Registration Status
`Pending` | `Confirmed` | `Rejected`
