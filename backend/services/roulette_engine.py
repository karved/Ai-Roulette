import random
import uuid
from typing import List, Dict, Any
from datetime import datetime
from models.game import Bet, SpinResult, BetType, Payout

class RouletteEngine:
    """Core roulette game logic and betting system"""
    
    def __init__(self):
        self.current_bets: List[Bet] = []
        self.current_round_id = str(uuid.uuid4())
        
        # Roulette number colors (European roulette)
        self.red_numbers = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
        self.black_numbers = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}
        
        # Payout multipliers for different bet types
        self.payout_multipliers = {
            BetType.STRAIGHT: 35,  # Single number
            BetType.SPLIT: 17,     # Two numbers
            BetType.STREET: 11,    # Three numbers
            BetType.CORNER: 8,     # Four numbers
            BetType.LINE: 5,       # Six numbers
            BetType.DOZEN: 2,      # Dozen
            BetType.COLUMN: 2,     # Column
            BetType.RED: 1,        # Red
            BetType.BLACK: 1,      # Black
            BetType.EVEN: 1,       # Even
            BetType.ODD: 1,        # Odd
            BetType.LOW: 1,        # 1-18
            BetType.HIGH: 1        # 19-36
        }

    async def place_bet(self, bet: Bet) -> Dict[str, Any]:
        """Place a bet and validate it"""
        # Validate bet
        if not self._validate_bet(bet):
            raise ValueError("Invalid bet")
        
        # Calculate potential payout
        bet.potential_payout = bet.amount * self.payout_multipliers[bet.bet_type]
        bet.id = str(uuid.uuid4())
        bet.round_id = self.current_round_id
        
        self.current_bets.append(bet)
        
        return {
            "bet_id": bet.id,
            "status": "placed",
            "potential_payout": bet.potential_payout
        }

    async def spin(self) -> SpinResult:
        """Spin the roulette wheel and return result"""
        # Generate random winning number (0-36 for European roulette)
        winning_number = random.randint(0, 36)
        
        # Determine color
        if winning_number == 0:
            color = "green"
        elif winning_number in self.red_numbers:
            color = "red"
        else:
            color = "black"
        
        # Calculate properties
        is_even = winning_number % 2 == 0 and winning_number != 0
        is_low = 1 <= winning_number <= 18
        dozen = (winning_number - 1) // 12 + 1 if winning_number > 0 else 0
        column = ((winning_number - 1) % 3) + 1 if winning_number > 0 else 0
        
        spin_result = SpinResult(
            id=str(uuid.uuid4()),
            round_id=self.current_round_id,
            winning_number=winning_number,
            color=color,
            is_even=is_even,
            is_low=is_low,
            dozen=dozen,
            column=column
        )
        
        return spin_result

    async def calculate_payouts(self, spin_result: SpinResult) -> List[Payout]:
        """Calculate payouts for all bets based on spin result"""
        payouts = []
        
        for bet in self.current_bets:
            if self._is_winning_bet(bet, spin_result):
                payout = Payout(
                    player_id=bet.player_id,
                    bet_id=bet.id,
                    amount=bet.potential_payout,
                    winning_numbers=[spin_result.winning_number]
                )
                payouts.append(payout)
        
        # Clear bets for next round
        self.current_bets = []
        self.current_round_id = str(uuid.uuid4())
        
        return payouts

    def _validate_bet(self, bet: Bet) -> bool:
        """Validate bet parameters"""
        if bet.amount <= 0:
            return False
        
        # Validate numbers based on bet type
        if bet.bet_type == BetType.STRAIGHT:
            return len(bet.numbers) == 1 and 0 <= bet.numbers[0] <= 36
        elif bet.bet_type == BetType.SPLIT:
            return len(bet.numbers) == 2 and self._are_adjacent_numbers(bet.numbers)
        elif bet.bet_type == BetType.STREET:
            return len(bet.numbers) == 3 and self._are_street_numbers(bet.numbers)
        elif bet.bet_type in [BetType.RED, BetType.BLACK, BetType.EVEN, BetType.ODD, BetType.LOW, BetType.HIGH]:
            return len(bet.numbers) == 0  # These bets don't specify numbers
        
        return True

    def _is_winning_bet(self, bet: Bet, spin_result: SpinResult) -> bool:
        """Check if a bet wins based on spin result"""
        winning_number = spin_result.winning_number
        
        if bet.bet_type == BetType.STRAIGHT:
            return winning_number in bet.numbers
        elif bet.bet_type == BetType.SPLIT:
            return winning_number in bet.numbers
        elif bet.bet_type == BetType.STREET:
            return winning_number in bet.numbers
        elif bet.bet_type == BetType.CORNER:
            return winning_number in bet.numbers
        elif bet.bet_type == BetType.LINE:
            return winning_number in bet.numbers
        elif bet.bet_type == BetType.DOZEN:
            return spin_result.dozen == bet.numbers[0] if bet.numbers else False
        elif bet.bet_type == BetType.COLUMN:
            return spin_result.column == bet.numbers[0] if bet.numbers else False
        elif bet.bet_type == BetType.RED:
            return spin_result.color == "red"
        elif bet.bet_type == BetType.BLACK:
            return spin_result.color == "black"
        elif bet.bet_type == BetType.EVEN:
            return spin_result.is_even and winning_number != 0
        elif bet.bet_type == BetType.ODD:
            return not spin_result.is_even and winning_number != 0
        elif bet.bet_type == BetType.LOW:
            return spin_result.is_low
        elif bet.bet_type == BetType.HIGH:
            return not spin_result.is_low and winning_number != 0
        
        return False

    def _are_adjacent_numbers(self, numbers: List[int]) -> bool:
        """Check if two numbers are adjacent on the roulette table"""
        # Simplified adjacency check - in a real implementation,
        # this would check the actual roulette table layout
        return abs(numbers[0] - numbers[1]) == 1

    def _are_street_numbers(self, numbers: List[int]) -> bool:
        """Check if three numbers form a street (row) on the roulette table"""
        # Simplified street check
        numbers.sort()
        return numbers[1] == numbers[0] + 1 and numbers[2] == numbers[1] + 1
