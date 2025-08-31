import { createContext, useContext, useEffect, ReactNode } from 'react'
import { create } from 'zustand'

// Types
interface Player {
  id: string
  username: string
  balance: number
  totalWinnings: number
}

interface Bet {
  id: string
  playerId: string
  betType: string
  numbers: number[]
  amount: number
  potentialPayout: number
}

interface SpinResult {
  winningNumber: number
  color: string
  isEven: boolean
  isLow: boolean
  dozen: number
  column: number
}

interface PlayerStats {
  totalWon: number
  totalWagered: number
  totalBets: number
  winRate: number
}

interface GameState {
  currentRoundId: string
  phase: 'betting' | 'spinning' | 'results'
  timeRemaining: number
  totalPot: number
  activeBets: Bet[]
  recentSpins: SpinResult[]
  hotNumbers: Array<{ number: number; count: number }>
  coldNumbers: Array<{ number: number; count: number }>
  playerCount: number
  selectedChip: number
  player: Player | null
  playerStats: PlayerStats
  pendingResult: SpinResult | null
}

// Zustand store
interface GameStore extends GameState {
  setSelectedChip: (amount: number) => void
  removeBet: (betId: string) => void
  placeBet: (betType: string, numbers: number[]) => Promise<void>
  spin: () => Promise<void>
  completeSpinResult: () => void
  updateGameState: (newState: Partial<GameState>) => void
  setPlayer: (player: Player) => void
}

const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  currentRoundId: 'round-1',
  phase: 'betting',
  timeRemaining: 30,
  totalPot: 0,
  activeBets: [],
  recentSpins: [],
  hotNumbers: [
    { number: 7, count: 8 },
    { number: 23, count: 6 },
    { number: 17, count: 5 }
  ],
  coldNumbers: [
    { number: 13, count: 1 },
    { number: 2, count: 2 },
    { number: 34, count: 2 }
  ],
  playerCount: 3,
  selectedChip: 5,
  player: null,
  playerStats: {
    totalWon: 0,
    totalWagered: 0,
    totalBets: 0,
    winRate: 0
  },
  pendingResult: null,

  // Actions
  setSelectedChip: (amount: number) => set({ selectedChip: amount }),

  setPlayer: (player: Player) => set({ player }),

  removeBet: (betId: string) => set((state) => ({
    activeBets: state.activeBets.filter(bet => bet.id !== betId),
    totalPot: state.activeBets
      .filter(bet => bet.id !== betId)
      .reduce((sum, bet) => sum + bet.amount, 0)
  })),

  placeBet: async (betType: string, numbers: number[]) => {
    const state = get()
    if (!state.player || state.phase !== 'betting') return

    const bet: Bet = {
      id: `bet-${Date.now()}`,
      playerId: state.player.id,
      betType,
      numbers,
      amount: state.selectedChip,
      potentialPayout: state.selectedChip * getPayout(betType)
    }

    // Check if player has enough balance
    if (state.player.balance < bet.amount) {
      alert('Insufficient balance!')
      return
    }

    try {
      // In a real app, this would call the API
      // await apiClient.placeBet(bet)
      
      // Update local state
      set(state => ({
        activeBets: [...state.activeBets, bet],
        totalPot: state.totalPot + bet.amount,
        player: state.player ? {
          ...state.player,
          balance: state.player.balance - bet.amount
        } : null
      }))
    } catch (error) {
      console.error('Failed to place bet:', error)
    }
  },

  spin: async () => {
    const state = get()
    if (state.phase !== 'betting') return

    set({ phase: 'spinning', timeRemaining: 0 })

    try {
      // Generate random result immediately but don't update UI yet
      const winningNumber = Math.floor(Math.random() * 37) // 0-36
      const spinResult: SpinResult = {
        winningNumber,
        color: getNumberColor(winningNumber),
        isEven: winningNumber % 2 === 0 && winningNumber !== 0,
        isLow: winningNumber >= 1 && winningNumber <= 18,
        dozen: winningNumber > 0 ? Math.ceil(winningNumber / 12) : 0,
        column: winningNumber > 0 ? ((winningNumber - 1) % 3) + 1 : 0
      }

      // Store the result but don't update phase yet - wait for wheel animation
      set(state => ({ 
        ...state,
        pendingResult: spinResult 
      }))

    } catch (error) {
      console.error('Spin failed:', error)
      set({ phase: 'betting', timeRemaining: 30 })
    }
  },

  completeSpinResult: () => {
    const state = get()
    if (state.phase !== 'spinning' || !state.pendingResult) return

    const spinResult = state.pendingResult
    const winnings = calculateWinnings(state.activeBets, spinResult)
    
    set(state => ({
      phase: 'results',
      recentSpins: [spinResult, ...state.recentSpins.slice(0, 9)],
      activeBets: [],
      totalPot: 0,
      pendingResult: null,
      player: state.player ? {
        ...state.player,
        balance: state.player.balance + winnings,
        totalWinnings: state.player.totalWinnings + winnings
      } : null
    }))

    // Auto-start next round after 5 seconds
    setTimeout(() => {
      set({ phase: 'betting', timeRemaining: 30 })
    }, 5000)
  },

  updateGameState: (newState: Partial<GameState>) => set(newState)
}))

// Helper functions
function getPayout(betType: string): number {
  const payouts: Record<string, number> = {
    straight: 35,
    split: 17,
    street: 11,
    corner: 8,
    line: 5,
    dozen: 2,
    column: 2,
    red: 1,
    black: 1,
    even: 1,
    odd: 1,
    low: 1,
    high: 1
  }
  return payouts[betType] || 1
}

function getNumberColor(number: number): string {
  if (number === 0) return 'green'
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
  return redNumbers.includes(number) ? 'red' : 'black'
}

function calculateWinnings(bets: Bet[], spinResult: SpinResult): number {
  let totalWinnings = 0
  
  for (const bet of bets) {
    if (isWinningBet(bet, spinResult)) {
      totalWinnings += bet.potentialPayout
    }
  }
  
  return totalWinnings
}

function isWinningBet(bet: Bet, spinResult: SpinResult): boolean {
  const { winningNumber, color, isEven, isLow } = spinResult
  
  switch (bet.betType) {
    case 'straight':
      return bet.numbers.includes(winningNumber)
    case 'red':
      return color === 'red'
    case 'black':
      return color === 'black'
    case 'even':
      return isEven
    case 'odd':
      return !isEven && winningNumber !== 0
    case 'low':
      return isLow
    case 'high':
      return !isLow && winningNumber !== 0
    default:
      return false
  }
}

// Context for components that need game state
const GameContext = createContext<GameStore | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const gameStore = useGameStore()
  
  // Betting countdown and auto-spin
  useEffect(() => {
    if (gameStore.phase !== 'betting') return
    // Tick every 1s
    const interval = setInterval(() => {
      const { timeRemaining, phase } = useGameStore.getState()
      if (phase !== 'betting') return
      if (timeRemaining > 0) {
        useGameStore.setState({ timeRemaining: timeRemaining - 1 })
      } else {
        clearInterval(interval)
        // Always spin when timer reaches 0, regardless of bets
        useGameStore.getState().spin()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [gameStore.phase])

  return (
    <GameContext.Provider value={gameStore}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}

// Export the store hook for direct access
export { useGameStore }
