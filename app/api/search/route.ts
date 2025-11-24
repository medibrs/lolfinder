import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/search - Advanced search for players and teams
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'player' or 'team'
    const query = searchParams.get('query'); // search term
    const role = searchParams.get('role');
    const tier = searchParams.get('tier');
    const region = searchParams.get('region');
    const lookingForTeam = searchParams.get('lookingForTeam');
    const recruiting = searchParams.get('recruiting');

    if (!type) {
      return NextResponse.json(
        { error: 'Search type is required (player or team)' },
        { status: 400 }
      );
    }

    if (type === 'player') {
      let playerQuery = supabase.from('players').select('*');

      // Text search
      if (query) {
        playerQuery = playerQuery.or(`summoner_name.ilike.%${query}%,discord.ilike.%${query}%`);
      }

      // Apply filters
      if (role) {
        playerQuery = playerQuery.or(`main_role.eq.${role},secondary_role.eq.${role}`);
      }
      if (tier) {
        playerQuery = playerQuery.eq('tier', tier);
      }
      if (region) {
        playerQuery = playerQuery.eq('region', region);
      }
      if (lookingForTeam === 'true') {
        playerQuery = playerQuery.eq('looking_for_team', true);
      }

      playerQuery = playerQuery.order('created_at', { ascending: false }).limit(50);

      const { data, error } = await playerQuery;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ type: 'player', results: data });
    } 
    
    else if (type === 'team') {
      let teamQuery = supabase.from('teams').select('*, captain:players!captain_id(*)');

      // Text search
      if (query) {
        teamQuery = teamQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
      }

      // Apply filters
      if (tier) {
        teamQuery = teamQuery.eq('tier', tier);
      }
      if (region) {
        teamQuery = teamQuery.eq('region', region);
      }
      if (recruiting) {
        teamQuery = teamQuery.eq('recruiting_status', recruiting);
      }

      teamQuery = teamQuery.order('created_at', { ascending: false }).limit(50);

      const { data, error } = await teamQuery;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ type: 'team', results: data });
    } 
    
    else {
      return NextResponse.json(
        { error: 'Invalid search type. Must be "player" or "team"' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
