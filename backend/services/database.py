from supabase import create_client, Client
from typing import List, Dict, Any, Optional
from models.game import Player, GameState, SpinResult, Bet, Payout
from datetime import datetime, timedelta
import os

class DatabaseService:
    """Database service using Supabase"""
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if supabase_url and supabase_key:
            self.supabase: Client = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None
            print("Warning: Supabase credentials not found, using mock data")

    async def get_game_state(self, player_id: str) -> GameState:
        """Get current game state for a player"""
        try:
            if not self.supabase:
                return self._mock_game_state()
            
            # Get recent spins
            recent_spins_response = self.supabase.table("spins").select("*").order("spun_at", desc=True).limit(10).execute()
            recent_spins = [SpinResult(**spin) for spin in recent_spins_response.data]
            
            # Get active bets for current round
            active_bets_response = self.supabase.table("bets").select("*").eq("round_active", True).execute()
            active_bets = [Bet(**bet) for bet in active_bets_response.data]
            
            # Calculate analytics
            hot_cold_numbers = await self._calculate_hot_cold_numbers()
            
            return GameState(
                current_round_id="current-round",
                phase="betting",
                time_remaining=30,
                total_pot=sum(bet.amount for bet in active_bets),
                active_bets=active_bets,
                recent_spins=recent_spins,
                hot_numbers=hot_cold_numbers["hot"],
                cold_numbers=hot_cold_numbers["cold"],
                player_count=await self._get_active_player_count()
            )
        except Exception as e:
            print(f"Database error: {e}")
            return self._mock_game_state()

    async def update_balances(self, payouts: List[Payout]) -> None:
        """Update player balances after payouts"""
        if not self.supabase:
            return
        
        try:
            for payout in payouts:
                # Update player balance
                self.supabase.table("players").update({
                    "balance": f"balance + {payout.amount}",
                    "total_winnings": f"total_winnings + {payout.amount}"
                }).eq("id", payout.player_id).execute()
                
                # Record payout
                self.supabase.table("payouts").insert({
                    "player_id": payout.player_id,
                    "bet_id": payout.bet_id,
                    "amount": payout.amount,
                    "paid_at": datetime.utcnow().isoformat()
                }).execute()
        except Exception as e:
            print(f"Error updating balances: {e}")

    async def get_leaderboard(self) -> List[Dict[str, Any]]:
        """Get player leaderboard"""
        try:
            if not self.supabase:
                return self._mock_leaderboard()
            
            response = self.supabase.table("players").select(
                "username, total_winnings, games_played"
            ).order("total_winnings", desc=True).limit(10).execute()
            
            return response.data
        except Exception as e:
            print(f"Error getting leaderboard: {e}")
            return self._mock_leaderboard()

    async def get_analytics(self) -> Dict[str, Any]:
        """Get hot/cold numbers and recent statistics"""
        try:
            if not self.supabase:
                return self._mock_analytics()
            
            # Get recent spins for analysis
            recent_spins_response = self.supabase.table("spins").select("winning_number").order("spun_at", desc=True).limit(100).execute()
            
            numbers = [spin["winning_number"] for spin in recent_spins_response.data]
            number_counts = {}
            
            for num in numbers:
                number_counts[num] = number_counts.get(num, 0) + 1
            
            # Sort by frequency
            sorted_numbers = sorted(number_counts.items(), key=lambda x: x[1], reverse=True)
            
            hot_numbers = [{"number": num, "count": count} for num, count in sorted_numbers[:5]]
            cold_numbers = [{"number": num, "count": count} for num, count in sorted_numbers[-5:]]
            
            return {
                "hot_numbers": hot_numbers,
                "cold_numbers": cold_numbers,
                "total_spins": len(numbers),
                "last_updated": datetime.utcnow().isoformat()
            }
        except Exception as e:
            print(f"Error getting analytics: {e}")
            return self._mock_analytics()

    async def save_spin_result(self, spin_result: SpinResult) -> None:
        """Save spin result to database"""
        if not self.supabase:
            return
        
        try:
            self.supabase.table("spins").insert({
                "id": spin_result.id,
                "round_id": spin_result.round_id,
                "winning_number": spin_result.winning_number,
                "color": spin_result.color,
                "is_even": spin_result.is_even,
                "is_low": spin_result.is_low,
                "dozen": spin_result.dozen,
                "column": spin_result.column,
                "spun_at": spin_result.spun_at.isoformat()
            }).execute()
        except Exception as e:
            print(f"Error saving spin result: {e}")

    async def save_bet(self, bet: Bet) -> None:
        """Save bet to database"""
        if not self.supabase:
            return
        
        try:
            self.supabase.table("bets").insert({
                "id": bet.id,
                "player_id": bet.player_id,
                "round_id": bet.round_id,
                "bet_type": bet.bet_type.value,
                "numbers": bet.numbers,
                "amount": bet.amount,
                "potential_payout": bet.potential_payout,
                "placed_at": bet.placed_at.isoformat(),
                "round_active": True
            }).execute()
        except Exception as e:
            print(f"Error saving bet: {e}")

    async def _calculate_hot_cold_numbers(self) -> Dict[str, List[Dict[str, Any]]]:
        """Calculate hot and cold numbers from recent spins"""
        if not self.supabase:
            return {"hot": [], "cold": []}
        
        # This would be implemented with proper SQL queries
        return {"hot": [], "cold": []}

    async def _get_active_player_count(self) -> int:
        """Get count of active players"""
        if not self.supabase:
            return 1
        
        try:
            # Count players active in last 5 minutes
            cutoff_time = datetime.utcnow() - timedelta(minutes=5)
            response = self.supabase.table("players").select("id").gte("last_active", cutoff_time.isoformat()).execute()
            return len(response.data)
        except:
            return 1

    def _mock_game_state(self) -> GameState:
        """Mock game state for development"""
        return GameState(
            current_round_id="mock-round-1",
            phase="betting",
            time_remaining=25,
            total_pot=150.0,
            active_bets=[],
            recent_spins=[],
            hot_numbers=[{"number": 7, "count": 5}, {"number": 23, "count": 4}],
            cold_numbers=[{"number": 13, "count": 1}, {"number": 2, "count": 1}],
            player_count=3
        )

    def _mock_leaderboard(self) -> List[Dict[str, Any]]:
        """Mock leaderboard for development"""
        return [
            {"username": "Player1", "total_winnings": 250.0, "games_played": 15},
            {"username": "Player2", "total_winnings": 180.0, "games_played": 12},
            {"username": "Player3", "total_winnings": 120.0, "games_played": 8}
        ]

    def _mock_analytics(self) -> Dict[str, Any]:
        """Mock analytics for development"""
        return {
            "hot_numbers": [{"number": 7, "count": 8}, {"number": 23, "count": 6}],
            "cold_numbers": [{"number": 13, "count": 1}, {"number": 2, "count": 2}],
            "total_spins": 50,
            "last_updated": datetime.utcnow().isoformat()
        }
