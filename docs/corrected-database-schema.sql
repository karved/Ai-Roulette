-- AI Roulette Database Schema for Supabase (CORRECTED)
-- This schema matches the actual table names used in the backend code
-- Run this SQL in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    balance DECIMAL(10,2) DEFAULT 100.00,
    total_winnings DECIMAL(10,2) DEFAULT 0.00,
    total_wagered DECIMAL(10,2) DEFAULT 0.00,
    total_bets INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
    preferred_chip_values INTEGER[] DEFAULT ARRAY[1, 5, 10, 25, 100],
    voice_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game rounds table (matches backend code usage)
CREATE TABLE game_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    phase VARCHAR(20) DEFAULT 'betting' CHECK (phase IN ('betting', 'spinning', 'completed')),
    total_pot DECIMAL(10,2) DEFAULT 0.00,
    betting_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 seconds'),
    -- Spin results (null until spun)
    winning_number INTEGER CHECK (winning_number >= 0 AND winning_number <= 36),
    color VARCHAR(5) CHECK (color IN ('red', 'black', 'green')),
    is_even BOOLEAN,
    is_low BOOLEAN,
    dozen INTEGER CHECK (dozen >= 0 AND dozen <= 3),
    roulette_column INTEGER CHECK (roulette_column >= 0 AND roulette_column <= 3),
    spun_at TIMESTAMP WITH TIME ZONE
);

-- Enhanced Bets table with proper constraints
CREATE TABLE bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    round_id UUID REFERENCES game_rounds(id) ON DELETE CASCADE,
    bet_type VARCHAR(20) NOT NULL CHECK (bet_type IN ('straight', 'split', 'street', 'corner', 'line', 'dozen', 'column', 'red', 'black', 'even', 'odd', 'low', 'high')),
    bet_data JSONB NOT NULL, -- {numbers: [1,2,3]}
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    potential_payout DECIMAL(10,2) NOT NULL,
    payout_odds DECIMAL(10,2) DEFAULT 1.00,
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Outcome tracking
    is_winner BOOLEAN,
    actual_payout DECIMAL(10,2) DEFAULT 0.00,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Payouts table
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game lobbies table (referenced in frontend)
CREATE TABLE game_lobbies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL DEFAULT 'Main Lobby',
    max_players INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_last_active ON players(last_active);
CREATE INDEX idx_game_rounds_phase ON game_rounds(phase);
CREATE INDEX idx_game_rounds_spun_at ON game_rounds(spun_at);
CREATE INDEX idx_bets_player_id ON bets(player_id);
CREATE INDEX idx_bets_round_id ON bets(round_id);
CREATE INDEX idx_bets_is_winner ON bets(is_winner);
CREATE INDEX idx_bets_placed_at ON bets(placed_at);
CREATE INDEX idx_payouts_player_id ON payouts(player_id);

-- Views for analytics
CREATE VIEW leaderboard AS
SELECT 
    username,
    total_winnings,
    games_played,
    balance,
    win_rate,
    RANK() OVER (ORDER BY total_winnings DESC) as rank
FROM players
WHERE status = 'active'
ORDER BY total_winnings DESC;

CREATE VIEW hot_cold_numbers AS
WITH number_stats AS (
    SELECT 
        winning_number,
        COUNT(*) as hit_count,
        RANK() OVER (ORDER BY COUNT(*) DESC) as hot_rank,
        RANK() OVER (ORDER BY COUNT(*) ASC) as cold_rank
    FROM game_rounds
    WHERE spun_at >= NOW() - INTERVAL '7 days'
    AND winning_number IS NOT NULL
    GROUP BY winning_number
)
SELECT 
    winning_number,
    hit_count,
    CASE WHEN hot_rank <= 5 THEN 'hot' 
         WHEN cold_rank <= 5 THEN 'cold' 
         ELSE 'neutral' END as temperature
FROM number_stats;

-- Row Level Security (RLS) policies
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Players can only see/update their own data
CREATE POLICY "Players can view own data" ON players
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Players can update own data" ON players
    FOR UPDATE USING (auth.uid() = id);

-- Players can only see their own bets
CREATE POLICY "Players can view own bets" ON bets
    FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Players can insert own bets" ON bets
    FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Players can only see their own payouts
CREATE POLICY "Players can view own payouts" ON payouts
    FOR SELECT USING (auth.uid() = player_id);

-- Players can only see their own chat messages
CREATE POLICY "Players can view own messages" ON chat_messages
    FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Players can insert own messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Public read access for game rounds (game state)
CREATE POLICY "Anyone can view game rounds" ON game_rounds FOR SELECT USING (true);

-- Public read access for game lobbies
CREATE POLICY "Anyone can view game lobbies" ON game_lobbies FOR SELECT USING (true);

-- Functions for game logic
CREATE OR REPLACE FUNCTION create_new_round(lobby_uuid UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    new_round_id UUID;
    next_round_number INTEGER;
BEGIN
    -- Get next round number
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO next_round_number FROM game_rounds;
    
    -- End current active round
    UPDATE game_rounds SET phase = 'completed', ended_at = NOW() 
    WHERE phase IN ('betting', 'spinning');
    
    -- Create new round
    INSERT INTO game_rounds (round_number, phase) VALUES (next_round_number, 'betting') RETURNING id INTO new_round_id;
    
    RETURN new_round_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_game_statistics()
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'total_players', (SELECT COUNT(*) FROM players),
        'active_players', (SELECT COUNT(*) FROM players WHERE last_active >= NOW() - INTERVAL '5 minutes'),
        'total_games', (SELECT COUNT(*) FROM game_rounds WHERE phase = 'completed'),
        'total_bets', (SELECT COUNT(*) FROM bets),
        'total_winnings', (SELECT SUM(total_winnings) FROM players)
    );
END;
$$ LANGUAGE plpgsql;

-- Insert initial data
INSERT INTO game_lobbies (name) VALUES ('Main Lobby');
INSERT INTO game_rounds (round_number, phase) VALUES (1, 'betting');

COMMENT ON TABLE players IS 'User accounts and balances';
COMMENT ON TABLE game_rounds IS 'Game rounds with betting phases and spin results';
COMMENT ON TABLE bets IS 'Individual player bets';
COMMENT ON TABLE payouts IS 'Winning payouts to players';
COMMENT ON TABLE chat_messages IS 'AI chat conversation history';
COMMENT ON TABLE game_lobbies IS 'Game lobby management';
