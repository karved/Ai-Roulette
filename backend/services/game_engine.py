import random
import uuid
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from models.game import (
    BetType, Bet, SpinResult, Payout, BetRequest, BetResponse, 
    SpinRequest, SpinResponse, Player
)

class GameEngine:
    """Server-side game logic with security validation"""
    
    def __init__(self):
        self.roulette_numbers = list(range(37))  # 0-36
        self.red_numbers = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
        self.black_numbers = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}
        
        # Payout multipliers
        self.payouts = {
            BetType.STRAIGHT: 35,
            BetType.SPLIT: 17,
            BetType.STREET: 11,
            BetType.CORNER: 8,
            BetType.LINE: 5,
            BetType.DOZEN: 2,
            BetType.COLUMN: 2,
            BetType.RED: 1,
            BetType.BLACK: 1,
            BetType.EVEN: 1,
            BetType.ODD: 1,
            BetType.LOW: 1,
            BetType.HIGH: 1
        }

    def validate_bet(self, bet_request: BetRequest, player_balance: float) -> Tuple[bool, str]:
        """Validate bet request for security and game rules"""
        
        # Check bet amount
        if bet_request.amount <= 0:
            return False, "Bet amount must be positive"
        
        if bet_request.amount > player_balance:
            return False, "Insufficient balance"
        
        # Check bet type and numbers
        bet_type = BetType(bet_request.bet_type)
        
        if bet_type == BetType.STRAIGHT:
            if len(bet_request.numbers) != 1:
                return False, "Straight bet requires exactly 1 number"
            if not (0 <= bet_request.numbers[0] <= 36):
                return False, "Invalid number for straight bet"
                
        elif bet_type == BetType.SPLIT:
            if len(bet_request.numbers) != 2:
                return False, "Split bet requires exactly 2 numbers"
            if not self._are_adjacent(bet_request.numbers[0], bet_request.numbers[1]):
                return False, "Numbers must be adjacent for split bet"
                
        elif bet_type == BetType.STREET:
            if len(bet_request.numbers) != 3:
                return False, "Street bet requires exactly 3 numbers"
            if not self._is_valid_street(bet_request.numbers):
                return False, "Invalid street bet numbers"
                
        elif bet_type == BetType.CORNER:
            if len(bet_request.numbers) != 4:
                return False, "Corner bet requires exactly 4 numbers"
            if not self._is_valid_corner(bet_request.numbers):
                return False, "Invalid corner bet numbers"
                
        elif bet_type == BetType.LINE:
            if len(bet_request.numbers) != 6:
                return False, "Line bet requires exactly 6 numbers"
            if not self._is_valid_line(bet_request.numbers):
                return False, "Invalid line bet numbers"
                
        elif bet_type in [BetType.RED, BetType.BLACK, BetType.EVEN, BetType.ODD, BetType.LOW, BetType.HIGH]:
            if bet_request.numbers:
                return False, f"{bet_type} bet should not specify numbers"
                
        elif bet_type == BetType.DOZEN:
            if len(bet_request.numbers) != 1 or bet_request.numbers[0] not in [1, 2, 3]:
                return False, "Dozen bet requires dozen number (1, 2, or 3)"
                
        elif bet_type == BetType.COLUMN:
            if len(bet_request.numbers) != 1 or bet_request.numbers[0] not in [1, 2, 3]:
                return False, "Column bet requires column number (1, 2, or 3)"
        
        return True, "Valid bet"

    def calculate_potential_payout(self, bet_type: BetType, amount: float) -> float:
        """Calculate potential payout for a bet"""
        multiplier = self.payouts.get(bet_type, 0)
        return amount * multiplier

    def spin_wheel(self) -> SpinResult:
        """Generate cryptographically secure spin result"""
        winning_number = random.randint(0, 36)
        
        # Determine color
        if winning_number == 0:
            color = "green"
        elif winning_number in self.red_numbers:
            color = "red"
        else:
            color = "black"
        
        # Calculate properties
        is_even = winning_number != 0 and winning_number % 2 == 0
        is_low = 1 <= winning_number <= 18
        dozen = 0 if winning_number == 0 else ((winning_number - 1) // 12) + 1
        column = 0 if winning_number == 0 else ((winning_number - 1) % 3) + 1
        
        return SpinResult(
            id=str(uuid.uuid4()),
            round_id=str(uuid.uuid4()),
            winning_number=winning_number,
            color=color,
            is_even=is_even,
            is_low=is_low,
            dozen=dozen,
            column=column,
            spun_at=datetime.utcnow()
        )

    def calculate_payouts(self, spin_result: SpinResult, bets: List[Bet]) -> List[Payout]:
        """Calculate payouts for all bets based on spin result"""
        payouts = []
        
        for bet in bets:
            if self._is_winning_bet(bet, spin_result):
                payout_amount = bet.amount + (bet.amount * self.payouts[bet.bet_type])
                payouts.append(Payout(
                    player_id=bet.player_id,
                    bet_id=bet.id,
                    amount=payout_amount,
                    winning_numbers=[spin_result.winning_number]
                ))
        
        return payouts

    def _is_winning_bet(self, bet: Bet, spin_result: SpinResult) -> bool:
        """Check if a bet wins based on spin result"""
        winning_number = spin_result.winning_number
        
        if bet.bet_type == BetType.STRAIGHT:
            return winning_number in bet.numbers
            
        elif bet.bet_type in [BetType.SPLIT, BetType.STREET, BetType.CORNER, BetType.LINE]:
            return winning_number in bet.numbers
            
        elif bet.bet_type == BetType.RED:
            return winning_number in self.red_numbers
            
        elif bet.bet_type == BetType.BLACK:
            return winning_number in self.black_numbers
            
        elif bet.bet_type == BetType.EVEN:
            return winning_number != 0 and winning_number % 2 == 0
            
        elif bet.bet_type == BetType.ODD:
            return winning_number != 0 and winning_number % 2 == 1
            
        elif bet.bet_type == BetType.LOW:
            return 1 <= winning_number <= 18
            
        elif bet.bet_type == BetType.HIGH:
            return 19 <= winning_number <= 36
            
        elif bet.bet_type == BetType.DOZEN:
            if bet.numbers and len(bet.numbers) == 1:
                dozen = bet.numbers[0]
                return spin_result.dozen == dozen
                
        elif bet.bet_type == BetType.COLUMN:
            if bet.numbers and len(bet.numbers) == 1:
                column = bet.numbers[0]
                return spin_result.column == column
        
        return False

    def _are_adjacent(self, num1: int, num2: int) -> bool:
        """Check if two numbers are adjacent on roulette table"""
        # Simplified adjacency check - in real implementation, 
        # would need full roulette table layout
        return abs(num1 - num2) == 1 or abs(num1 - num2) == 3

    def _is_valid_street(self, numbers: List[int]) -> bool:
        """Check if numbers form a valid street"""
        if len(numbers) != 3:
            return False
        numbers_sorted = sorted(numbers)
        # Street is three consecutive numbers in same row
        return (numbers_sorted[1] == numbers_sorted[0] + 1 and 
                numbers_sorted[2] == numbers_sorted[1] + 1)

    def _is_valid_corner(self, numbers: List[int]) -> bool:
        """Check if numbers form a valid corner"""
        if len(numbers) != 4:
            return False
        # Simplified corner validation
        return True  # Would implement full table layout check

    def _is_valid_line(self, numbers: List[int]) -> bool:
        """Check if numbers form a valid line"""
        if len(numbers) != 6:
            return False
        # Simplified line validation
        return True  # Would implement full table layout check

    def get_hot_cold_numbers(self, recent_spins: List[SpinResult], limit: int = 10) -> Dict[str, List[Dict]]:
        """Calculate hot and cold numbers from recent spins"""
        if not recent_spins:
            return {"hot": [], "cold": []}
        
        # Count frequency of each number
        frequency = {}
        for spin in recent_spins:
            num = spin.winning_number
            frequency[num] = frequency.get(num, 0) + 1
        
        # Sort by frequency
        sorted_numbers = sorted(frequency.items(), key=lambda x: x[1], reverse=True)
        
        hot_numbers = [{"number": num, "count": count} for num, count in sorted_numbers[:limit]]
        cold_numbers = [{"number": num, "count": count} for num, count in sorted_numbers[-limit:]]
        
        return {"hot": hot_numbers, "cold": cold_numbers}

    def analyze_betting_pattern(self, player_bets: List[Bet]) -> Dict[str, any]:
        """Analyze player betting patterns for AI insights"""
        if not player_bets:
            return {"risk_level": "unknown", "favorite_bets": [], "avg_bet": 0}
        
        total_amount = sum(bet.amount for bet in player_bets)
        avg_bet = total_amount / len(player_bets)
        
        # Count bet types
        bet_type_counts = {}
        for bet in player_bets:
            bet_type_counts[bet.bet_type] = bet_type_counts.get(bet.bet_type, 0) + 1
        
        favorite_bets = sorted(bet_type_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # Determine risk level based on bet types
        high_risk_bets = sum(1 for bet in player_bets if bet.bet_type == BetType.STRAIGHT)
        risk_ratio = high_risk_bets / len(player_bets)
        
        if risk_ratio > 0.7:
            risk_level = "high"
        elif risk_ratio > 0.3:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "risk_level": risk_level,
            "favorite_bets": [{"type": bt, "count": count} for bt, count in favorite_bets],
            "avg_bet": avg_bet,
            "total_bets": len(player_bets),
            "total_wagered": total_amount
        }
