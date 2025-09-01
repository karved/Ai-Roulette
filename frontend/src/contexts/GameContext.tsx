import { createContext, useContext, useEffect, ReactNode } from 'react'
import { create } from 'zustand'
import { createClient } from '@supabase/supabase-js'
import backendService from '../services/backendService'
import NotificationSystem, { Notification } from '../components/NotificationSystem'

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
  isPending?: boolean
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
  netResult?: number
}

interface BettingResult {
  totalWagered: number
  totalWon: number
  netResult: number
  participatedInRound: boolean
  potentialWinnings?: number
  winningBetsWagered?: number // Amount wagered specifically on winning bets
}

interface GameState {
  phase: 'betting' | 'spinning' | 'results'
  timeLeft: number
  timeRemaining: number
  currentRoundId: string
  selectedChip: number
  totalPot: number
  isGameRunning: boolean
  playerCount?: number
  player: Player | null
  activeBets: Bet[]
  recentSpins: SpinResult[]
  pendingResult: SpinResult | null
  lastRoundResult: BettingResult | null
  wheelBettingResult: BettingResult | null
  playerStats: PlayerStats | null
  loading: {
    gameState: boolean
    hotColdNumbers: boolean
    playerStats: boolean
    backendSync: boolean
  }
  error: string | null
  initialRoundBalance: number
  frontendResult?: any
  backendSynced?: boolean
  notifications: Notification[]
  compoundBetting: {
    isActive: boolean
    type: 'split' | 'street' | 'corner' | 'line' | null
    selectedNumbers: number[]
    onNumberSelect?: (number: number) => void
  }
}

// Zustand store
interface GameStore extends GameState {
  supabase: any
  loading: {
    gameState: boolean
    hotColdNumbers: boolean
    playerStats: boolean
    backendSync: boolean
  }
  setSelectedChip: (amount: number) => void
  removeBet: (betId: string) => void
  placeBet: (betType: string, numbers: number[], amount: number) => Promise<void>
  spin: () => Promise<void>
  spinWheel: () => Promise<void>
  completeSpinResult: () => void
  continueToNextRound: () => void
  updateGameState: (newState: Partial<GameState>) => void
  setPlayer: (player: Player | null) => void
  setCompoundBettingMode: (type: 'split' | 'street' | 'corner' | 'line' | null) => void
  selectCompoundNumber: (number: number) => void
  clearCompoundSelection: () => void
  setInitialRoundBalance: () => void // Set initial balance at start of round
  // Notification methods
  addNotification: (notification: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
  // Database methods
  loadGameState: () => Promise<void>
  // loadHotColdNumbers: () => Promise<void>
  loadPlayerStats: (playerId: string) => Promise<void>
  initializePlayer: (userId: string, email: string, username: string) => Promise<void>
  // Game control methods
  startGame: () => void
  pauseGame: () => void
}

const useGameStore = create<GameStore>((set, get) => ({
  // Initial state - all empty until loaded from database
  currentRoundId: '',
  phase: 'betting',
  timeLeft: 30,
  timeRemaining: 30,
  totalPot: 0,
  selectedChip: 5,
  isGameRunning: false,
  activeBets: [],
  recentSpins: [],
  player: null,
  playerStats: {
    totalWon: 0,
    totalWagered: 0,
    totalBets: 0,
    winRate: 0
  },
  pendingResult: null,
  lastRoundResult: null,
  wheelBettingResult: null,
  initialRoundBalance: 0, // Track initial balance at start of round
  notifications: [],
  error: null,
  compoundBetting: {
    isActive: false,
    type: null,
    selectedNumbers: []
  },
  // Database connection
  supabase: createClient(
    import.meta.env.VITE_SUPABASE_URL || 'https://tdisxnbzdpgzexbeopni.supabase.co',
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkaXN4bmJ6ZHBnemV4YmVvcG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzcxMTUsImV4cCI6MjA3MjI1MzExNX0.MUODImjtrdw__9jw4F_Uw9mS3LyP587GZGmVl7kjRtE'
  ),
  // Loading states
  loading: {
    gameState: true,
    hotColdNumbers: true,
    playerStats: true,
    backendSync: false
  },

  // Actions
  setSelectedChip: (amount: number) => set({ selectedChip: amount }),

  setPlayer: (player: Player | null) => set({ player }),

  setInitialRoundBalance: () => {
    const { player } = get()
    if (player) {
      console.log('Setting initial balance to:', player.balance)
      set({ initialRoundBalance: player.balance })
    }
  },

  removeBet: (betId: string) => {
    const { activeBets, player } = get()
    const betToRemove = activeBets.find(bet => bet.id === betId)
    if (!betToRemove || !player) return
    
    // 1. OPTIMISTIC UPDATE: Immediately update UI
    set(state => ({
      activeBets: state.activeBets.filter(bet => bet.id !== betId),
      totalPot: state.activeBets
        .filter(bet => bet.id !== betId)
        .reduce((sum, bet) => sum + bet.amount, 0),
      player: state.player ? {
        ...state.player,
        balance: state.player.balance + betToRemove.amount
      } : null,
      playerStats: state.playerStats ? {
        ...state.playerStats,
        totalWagered: state.playerStats.totalWagered - betToRemove.amount,
        totalBets: state.playerStats.totalBets - 1
      } : null
    }))
    
    // 2. BACKEND SYNC: Only sync if bet was confirmed (not pending)
    if (!betToRemove.isPending && !betId.startsWith('temp_')) {
      // TODO: Implement backend bet removal API if needed
      // For now, bet removal is only for pending/unconfirmed bets
    }
  },

  placeBet: async (betType: string, numbers: number[], amount: number) => {
    const { player, initialRoundBalance, addNotification } = get()
    if (!player) return
    
    // Check for insufficient balance and show notification
    if (player.balance < amount) {
      addNotification({
        type: 'error',
        title: 'Insufficient Balance',
        message: `You need $${amount} to place this bet, but you only have $${player.balance.toFixed(2)} available.`,
        duration: 4000
      })
      return
    }
    
    // Set initial balance BEFORE deducting bet amount (first bet of the round)
    if (initialRoundBalance === 0) {
      console.log('First bet - setting initial balance to:', player.balance)
      set({ initialRoundBalance: player.balance })
    }
    
    // Generate temporary bet ID for optimistic update
    const tempBetId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Calculate potential payout using proper odds format (winnings only, not including original bet)
    const payoutOdds = {
      "straight": 35, "split": 17, "street": 11, "corner": 8, "line": 5,
      "dozen": 2, "column": 2, "red": 1, "black": 1, "even": 1, "odd": 1, "low": 1, "high": 1
    }
    const odds = payoutOdds[betType as keyof typeof payoutOdds] || 1
    const potentialPayout = amount * odds // This is just the winnings, not including the original bet
    
    // 1. OPTIMISTIC UPDATE: Immediately update UI (frontend only during betting)
    set(state => ({
      player: state.player ? {
        ...state.player,
        balance: state.player.balance - amount
      } : null,
      activeBets: [...state.activeBets, {
        id: tempBetId,
        playerId: player.id,
        betType,
        numbers,
        amount,
        potentialPayout,
        isPending: true // Mark as pending backend confirmation
      }],
      totalPot: state.totalPot + amount,
      playerStats: state.playerStats ? {
        ...state.playerStats,
        totalWagered: state.playerStats.totalWagered + amount,
        totalBets: state.playerStats.totalBets + 1
      } : null
    }))
    
    // No backend calls during betting phase - keep everything frontend only
    // Backend verification will happen only after timer expires and wheel spins
  },

  spin: async () => {
    const { activeBets, player } = get()
    // Allow spinning even with no bets
    
    // 1. IMMEDIATE UI UPDATE: Start spinning animation
    set(state => ({
      ...state,
      phase: 'spinning' as const
    }))
    
    // Placeholder spin result for animation - will be replaced by backend result
    const spinResult = {
      winningNumber: 0, // Will be updated by backend
      color: 'green' as const,
      isEven: false,
      isLow: false,
      dozen: 0,
      column: 0
    }
    
    // Calculate total wagered for animation display only
    let totalWagered = 0
    for (const bet of activeBets) {
      totalWagered += bet.amount
    }
    
    // No win/loss calculations - backend will provide authoritative results
    
    // Keep current balance during spin - don't update with winnings yet
    const currentBalance = player ? player.balance : 0
    
    // Show spinning phase with result for animation
    set(state => ({
      ...state,
      phase: 'spinning',
      pendingResult: spinResult,
      lastRoundResult: {
        totalWagered,
        totalWon: 0, // Will be updated by backend
        netResult: 0, // Will be updated by backend
        participatedInRound: activeBets.length > 0,
        potentialWinnings: 0, // Will be updated by backend
        winningBetsWagered: 0 // Will be updated by backend
      },
      // Store separate betting result for wheel modal display
      wheelBettingResult: {
        totalWagered,
        totalWon: 0,
        netResult: 0,
        participatedInRound: activeBets.length > 0,
        potentialWinnings: 0,
        winningBetsWagered: 0
      }
    }))

    // Fetch backend random number for wheel animation
    setTimeout(async () => {
      // Store frontend results AND bets for backend submission FIRST
      // CRITICAL: Capture activeBets and initialBalance at this moment
      const currentActiveBets = get().activeBets
      const initialBalance = get().initialRoundBalance
      
      console.log('DEBUG: Initial balance for backend:', initialBalance)
      console.log('DEBUG: Current balance:', currentBalance)
      console.log('DEBUG: Active bets:', currentActiveBets)
      
      try {
        // Fetch random winning number from backend for animation
        console.log('Fetching random number from backend for animation...')
        const winningNumberData = await backendService.getWinningNumber()
        
        console.log('Backend random number for animation:', winningNumberData.winning_number, winningNumberData.color)
        
        // Calculate frontend betting results for wheel display
        let frontendTotalWon = 0
        let frontendNetResult = 0
        
        // Calculate winnings based on animation winning number
        for (const bet of currentActiveBets) {
          let isWinningBet = false
          let payout = 0
          
          if (bet.betType === 'red' && winningNumberData.color === 'red') {
            isWinningBet = true
            payout = bet.amount * 2 // 1:1 payout
          } else if (bet.betType === 'black' && winningNumberData.color === 'black') {
            isWinningBet = true
            payout = bet.amount * 2 // 1:1 payout
          } else if (bet.betType === 'even' && winningNumberData.is_even) {
            isWinningBet = true
            payout = bet.amount * 2 // 1:1 payout
          } else if (bet.betType === 'odd' && !winningNumberData.is_even && winningNumberData.winning_number !== 0) {
            isWinningBet = true
            payout = bet.amount * 2 // 1:1 payout
          } else if (bet.betType === 'straight' && bet.numbers.includes(winningNumberData.winning_number)) {
            isWinningBet = true
            payout = bet.amount * 36 // 35:1 payout
          }
          
          if (isWinningBet) {
            frontendTotalWon += payout
          }
        }
        
        frontendNetResult = frontendTotalWon - totalWagered
        
        console.log('Frontend calculation - Wagered:', totalWagered, 'Won:', frontendTotalWon, 'Net:', frontendNetResult)
        
        // Update pendingResult with backend random number for wheel animation
        set(state => ({
          ...state,
          pendingResult: {
            winningNumber: winningNumberData.winning_number,
            color: winningNumberData.color,
            isEven: winningNumberData.is_even,
            isLow: winningNumberData.is_low,
            dozen: winningNumberData.dozen,
            column: winningNumberData.column
          },
          phase: 'results',
          player: state.player ? {
            ...state.player,
            balance: currentBalance // Keep current balance, don't update with winnings yet
          } : null,
          recentSpins: [
            {
              winningNumber: winningNumberData.winning_number,
              color: winningNumberData.color,
              isEven: winningNumberData.is_even,
              isLow: winningNumberData.is_low,
              dozen: winningNumberData.dozen,
              column: winningNumberData.column
            },
            ...state.recentSpins.slice(0, 9)
          ],
          // Update wheel betting result with calculated values
          wheelBettingResult: {
            totalWagered,
            totalWon: frontendTotalWon,
            netResult: frontendNetResult,
            participatedInRound: currentActiveBets.length > 0,
            potentialWinnings: frontendTotalWon,
            winningBetsWagered: frontendTotalWon > 0 ? totalWagered : 0
          },
          frontendResult: {
            totalWagered,
            totalWon: 0, // Backend will provide authoritative values
            netResult: 0, // Backend will provide authoritative values
            initialBalance: initialBalance, // Use initial balance for backend submission
            bets: [...currentActiveBets], // Store a copy of bets for backend submission
            animationWinningNumber: winningNumberData.winning_number // Store for reference
          } as any
          // DON'T clear activeBets here - preserve them for backend sync
        }))
      } catch (error) {
        console.error('Error fetching backend random number:', error)
        // Fallback to frontend random number
        const winningNumber = Math.floor(Math.random() * 37)
        const color = winningNumber === 0 ? 'green' : 
                     [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber) ? 'red' : 'black'
        
        set(state => ({
          ...state,
          pendingResult: {
            winningNumber,
            color,
            isEven: winningNumber % 2 === 0 && winningNumber !== 0,
            isLow: winningNumber >= 1 && winningNumber <= 18,
            dozen: Math.ceil(winningNumber / 12),
            column: winningNumber % 3 === 0 ? 3 : winningNumber % 3
          },
          phase: 'results',
          frontendResult: {
            totalWagered,
            totalWon: 0,
            netResult: 0,
            initialBalance: initialBalance,
            bets: [...currentActiveBets],
            animationWinningNumber: winningNumber
          }
        }))
      }
    }, 500) // Fetch backend random number for animation
  },

  // Simplified single-player spin method (replaces spinWheel and completeSpinResult)
  spinWheel: async () => {
    await get().spin()
  },

  completeSpinResult: () => {
    // This method is kept for interface compatibility but functionality is handled in spin()
  },

  continueToNextRound: async () => {
    const state = get()
    const { activeBets, frontendResult, player } = state
    
    // CRITICAL: Capture bets BEFORE any state changes
    const betsToSubmit = frontendResult?.bets || activeBets || []
    
    // Only proceed if there were bets to process
    if (betsToSubmit.length === 0) {
      // Reset for next round
      set(() => ({
        phase: 'betting' as const,
        timeRemaining: 30,
        activeBets: [],
        pendingResult: null,
        lastRoundResult: null,
        isGameRunning: state.isGameRunning,
        totalPot: 0,
        frontendResult: null,
        backendSynced: false
      }))
      return
    }
    
    // Set loading state
    set(state => ({
      ...state,
      loading: { ...state.loading, backendSync: true }
    }))
    
    try {
      // Send initial balance, bets, and animation winning number for processing
      const spinData = {
        balance: frontendResult?.initialBalance || get().initialRoundBalance || player?.balance || 0,
        winning_number: (frontendResult as any)?.animationWinningNumber, // Use animation number
        bets: betsToSubmit.map((bet: Bet) => ({
          betType: bet.betType,
          numbers: bet.numbers,
          amount: bet.amount
        }))
      }
      
      // Call backend spin endpoint with frontend data
      const spinResponse = await backendService.spinWheel(spinData)
      
      if (spinResponse) {
        console.log('Backend response:', spinResponse)
        console.log('Updating player balance to:', spinResponse.new_balance)
        console.log('Setting wheel to show winning number:', spinResponse.winning_number)
        // Update with authoritative backend result including new balance and stats
        set(state => ({
          ...state,
          player: state.player ? {
            ...state.player,
            balance: spinResponse.new_balance
          } : null,
          // Don't update pendingResult - keep the animation number visible
          lastRoundResult: {
            totalWagered: spinResponse.total_wagered,
            totalWon: spinResponse.total_won,
            netResult: spinResponse.net_result,
            participatedInRound: activeBets.length > 0,
            potentialWinnings: spinResponse.total_won,
            winningBetsWagered: spinResponse.total_won > 0 ? spinResponse.total_wagered : 0
          },
          playerStats: state.playerStats ? {
            ...state.playerStats,
            winRate: spinResponse.win_rate,
            totalWon: spinResponse.net_result + (state.playerStats.totalWon || 0),
            totalWagered: (state.playerStats.totalWagered || 0) + spinResponse.total_wagered,
            totalBets: (state.playerStats.totalBets || 0) + spinResponse.total_bets
          } : null,
          backendSynced: true
        }))
        
        // Skip loadPlayerStats to avoid overriding correct balance from backend response
        // The backend response already contains the authoritative balance and stats
      }
    } catch (error) {
      console.error('Error syncing with backend:', error)
      // Keep frontend results if backend fails
    } finally {
      // Reset for next round but keep timer running if it was running
      const currentState = get()
      
      set(() => ({
        phase: 'betting' as const,
        timeRemaining: 30,
        activeBets: [],
        pendingResult: null,
        lastRoundResult: null,
        isGameRunning: currentState.isGameRunning, // Keep current running state
        totalPot: 0,
        frontendResult: null,
        backendSynced: false,
        loading: { ...currentState.loading, backendSync: false },
        initialRoundBalance: 0 // Reset initial balance for next round
      }))
      
      // Initial balance will be set on first bet of new round
    }
  },

  updateGameState: (newState: Partial<GameState>) => {
    set(state => ({ ...state, ...newState }))
  },
  
  // Add start/pause game functionality
  startGame: () => {
    set(state => ({
      ...state,
      isGameRunning: true, // Start the game
      phase: 'betting',
      timeRemaining: state.timeRemaining || 30
    }))
  },
  
  pauseGame: () => {
    set(state => ({
      ...state,
      isGameRunning: false
    }))
  },

  setCompoundBettingMode: (type: 'split' | 'street' | 'corner' | 'line' | null) => set(() => ({
    compoundBetting: {
      isActive: type !== null,
      type,
      selectedNumbers: [],
      onNumberSelect: type ? (number: number) => {
        const store = get()
        store.selectCompoundNumber(number)
      } : undefined
    }
  })),

  selectCompoundNumber: (number: number) => set(state => {
    if (!state.compoundBetting.isActive || !state.compoundBetting.type) return state

    const { type, selectedNumbers } = state.compoundBetting
    const maxNumbers = type === 'split' ? 2 : type === 'street' ? 3 : type === 'corner' ? 4 : 6
    
    const isSelected = selectedNumbers.includes(number)
    let newSelectedNumbers: number[]

    if (isSelected) {
      // Remove number
      newSelectedNumbers = selectedNumbers.filter(n => n !== number)
    } else {
      // Add number (with limits based on bet type)
      if (selectedNumbers.length >= maxNumbers) {
        // Replace the oldest selection
        newSelectedNumbers = [...selectedNumbers.slice(1), number]
      } else {
        newSelectedNumbers = [...selectedNumbers, number]
      }
    }

    return {
      compoundBetting: {
        ...state.compoundBetting,
        selectedNumbers: newSelectedNumbers
      }
    }
  }),

  clearCompoundSelection: () => set(state => ({
    compoundBetting: {
      ...state.compoundBetting,
      selectedNumbers: []
    }
  })),

  // Notification methods
  addNotification: (notification: Omit<Notification, 'id'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    set(state => ({
      notifications: [...state.notifications, { ...notification, id }]
    }))
  },

  dismissNotification: (id: string) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },

  // Database methods
  loadGameState: async () => {
    const { supabase } = get()
    try {
      set(state => ({ loading: { ...state.loading, gameState: true } }))
      
      // Get current active round
      const { data: rounds } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('phase', 'betting')
        .order('started_at', { ascending: false })
        .limit(1)
      
      if (rounds && rounds.length > 0) {
        const currentRound = rounds[0]
        
        // Get active bets for current round
        const { data: bets } = await supabase
          .from('bets')
          .select('*')
          .eq('round_id', currentRound.id)
          .is('is_winner', null)
        
        // Get recent spins (last 10)
        const { data: recentRounds } = await supabase
          .from('game_rounds')
          .select('winning_number, color, is_even, is_low, dozen, roulette_column, spun_at')
          .not('winning_number', 'is', null)
          .order('spun_at', { ascending: false })
          .limit(10)
        
        const recentSpins = recentRounds?.map((round: any) => ({
          winningNumber: round.winning_number,
          color: round.color,
          isEven: round.is_even,
          isLow: round.is_low,
          dozen: round.dozen,
          column: round.roulette_column
        })) || []
        
        set({
          currentRoundId: currentRound.id,
          phase: currentRound.phase,
          totalPot: parseFloat(currentRound.total_pot || '0'),
          activeBets: bets?.map((bet: any) => ({
            id: bet.id,
            playerId: bet.player_id,
            betType: bet.bet_type,
            numbers: bet.bet_data.numbers || [],
            amount: parseFloat(bet.amount),
            potentialPayout: parseFloat(bet.potential_payout)
          })) || [],
          recentSpins,
          loading: { ...get().loading, gameState: false }
        })
      } else {
        // No active round, create one
        const { data: lobby } = await supabase
          .from('game_lobbies')
          .select('id')
          .eq('name', 'Main Lobby')
          .single()
        
        if (lobby) {
          const { data: newRound } = await supabase.rpc('create_new_round', {
            lobby_uuid: lobby.id
          })
          
          set({
            currentRoundId: newRound,
            phase: 'betting',
            totalPot: 0,
            activeBets: [],
            loading: { ...get().loading, gameState: false }
          })
        }
      }
    } catch (error) {
      console.error('Error loading game state:', error)
      set(state => ({ loading: { ...state.loading, gameState: false } }))
    }
  },

  // loadHotColdNumbers: async () => {
  //   try {
  //     set(state => ({ loading: { ...state.loading, hotColdNumbers: true } }))
  //     
  //     // Use backend service for hot/cold analysis
  //     const hotColdData = await backendService.getHotColdNumbers()
  //     
  //     set({
  //       hotNumbers: hotColdData.hot || [],
  //       coldNumbers: hotColdData.cold || [],
  //       loading: { ...get().loading, hotColdNumbers: false }
  //     })
  //   } catch (error) {
  //     console.error('Error loading hot/cold numbers:', error)
  //     set({
  //       hotNumbers: [],
  //       coldNumbers: [],
  //       loading: { ...get().loading, hotColdNumbers: false }
  //     })
  //   }
  // },

  loadPlayerStats: async (_playerId: string) => {
    try {
      set(state => ({ loading: { ...state.loading, playerStats: true } }))
      
      // Use backend API for player stats - only called after betting/spinning
      const stats = await backendService.getPlayerStats()
      
      if (stats) {
        set(state => ({
          player: state.player ? {
            ...state.player,
            balance: stats.balance,
            totalWinnings: stats.totalWon || stats.total_winnings || 0
          } : null,
          playerStats: {
            totalWon: stats.totalWon || stats.total_winnings || 0,
            totalWagered: stats.totalWagered || stats.total_wagered || 0,
            totalBets: stats.totalBets || stats.total_bets || 0,
            winRate: stats.win_rate || 0
          },
          loading: { ...state.loading, playerStats: false }
        }))
      }
    } catch (error) {
      console.error('Error loading player stats:', error)
      set(state => ({ loading: { ...state.loading, playerStats: false } }))
    }
  },

  initializePlayer: async (userId: string, email: string, username: string) => {
    const { supabase } = get()
    try {
      // Check if player already exists
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (existingPlayer) {
        // Player exists, load their data
        await get().loadPlayerStats(userId)
      } else {
        // Create new player
        const { data: newPlayer, error } = await supabase
          .from('players')
          .insert({
            id: userId,
            email,
            username,
            balance: 100.00,
            total_winnings: 0.00,
            total_wagered: 0.00,
            total_bets: 0,
            games_played: 0,
            win_rate: 0.00
          })
          .select()
          .single()
        
        if (error) {
          console.error('Error creating player:', error)
          return
        }
        
        if (newPlayer) {
          set({
            player: {
              id: newPlayer.id,
              username: newPlayer.username,
              balance: parseFloat(newPlayer.balance),
              totalWinnings: parseFloat(newPlayer.total_winnings)
            },
            playerStats: {
              totalWon: parseFloat(newPlayer.total_winnings),
              totalWagered: parseFloat(newPlayer.total_wagered),
              totalBets: newPlayer.total_bets,
              winRate: parseFloat(newPlayer.win_rate)
            }
          })
        }
      }
    } catch (error) {
      console.error('Error initializing player:', error)
    }
  }
}))

// Helper functions (now handled by backend but kept for compatibility)
export function getPayout(betType: string): number {
  // Returns the odds ratio (winnings only, not including original bet)
  const payoutOdds: Record<string, number> = {
    straight: 35, // 35:1 odds
    split: 17,    // 17:1 odds
    street: 11,   // 11:1 odds
    corner: 8,    // 8:1 odds
    line: 5,      // 5:1 odds
    dozen: 2,     // 2:1 odds
    column: 2,    // 2:1 odds
    red: 1,       // 1:1 odds
    black: 1,     // 1:1 odds
    even: 1,      // 1:1 odds
    odd: 1,       // 1:1 odds
    low: 1,       // 1:1 odds
    high: 1       // 1:1 odds
  }
  return payoutOdds[betType] || 1
}

export function getNumberColor(number: number): string {
  if (number === 0) return 'green'
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
  return redNumbers.includes(number) ? 'red' : 'black'
}

export function calculateWinnings(bets: Bet[], spinResult: SpinResult): number {
  let totalWinnings = 0
  
  for (const bet of bets) {
    if (isWinningBet(bet, spinResult)) {
      // Return only the winnings (potentialPayout is already just the odds-based winnings)
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
    case 'split':
    case 'street':
    case 'corner':
    case 'line':
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
  const { notifications, dismissNotification } = gameStore
  
  // Initialize backend connection and WebSocket
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Connect to WebSocket for real-time updates
        const clientId = Math.random().toString(36).substring(7)
        await backendService.connectWebSocket(clientId)
        
        // Set up WebSocket message handlers
        backendService.onWebSocketMessage('game_state', (data: any) => {
          gameStore.updateGameState({
            phase: data.data.phase as 'betting' | 'spinning' | 'results',
            timeRemaining: data.data.time_remaining,
            playerCount: data.data.player_count || 1
          })
          
          if (gameStore.player) {
            gameStore.setPlayer({
              ...gameStore.player,
              balance: data.data.player_balance
            })
          }
        })
        
        backendService.onWebSocketMessage('bet_placed', (_data: any) => {
          // Handle bet placed event if needed
        })
        
        backendService.onWebSocketMessage('spin_result', (_data: any) => {
          // Handle spin result event if needed
        })
        
        // Load initial game state from backend
        const gameState = await backendService.getGameState()
        gameStore.updateGameState({
          phase: gameState.phase as 'betting' | 'spinning' | 'results',
          timeRemaining: gameState.time_remaining,
          playerCount: gameState.player_count,
          recentSpins: gameState.recent_spins.map(spin => ({
            winningNumber: spin.winning_number,
            color: spin.color,
            isEven: spin.winning_number % 2 === 0 && spin.winning_number !== 0,
            isLow: spin.winning_number >= 1 && spin.winning_number <= 18,
            dozen: Math.ceil(spin.winning_number / 12),
            column: spin.winning_number % 3 === 0 ? 3 : spin.winning_number % 3
          }))
        })
        
        if (gameStore.player) {
          gameStore.setPlayer({
            ...gameStore.player,
            balance: gameState.player_balance
          })
        }
        
        // await gameStore.loadHotColdNumbers() // Disabled - not used in UI
      } catch (error) {
        console.error('Failed to initialize game:', error)
      }
    }
    
    initializeGame()
    
    // Cleanup WebSocket on unmount
    return () => {
      backendService.disconnectWebSocket()
    }
  }, [])
  
  // Handle authentication state changes
  useEffect(() => {
    const { supabase } = gameStore
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user
        const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Player'
        
        await gameStore.initializePlayer(user.id, user.email, username)
      } else if (event === 'SIGNED_OUT') {
        gameStore.setPlayer(null)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [gameStore])
  
  // Fixed timer effect - runs once and manages itself
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    const startTimer = () => {
      if (interval) clearInterval(interval)
      
      interval = setInterval(() => {
        const currentState = useGameStore.getState()
        
        if (currentState.phase !== 'betting' || !currentState.isGameRunning) {
          if (interval) {
            clearInterval(interval)
            interval = null
          }
          return
        }
        
        if (currentState.timeRemaining > 0) {
          useGameStore.setState({ timeRemaining: currentState.timeRemaining - 1 })
        } else {
          if (interval) {
            clearInterval(interval)
            interval = null
          }
          useGameStore.getState().spin()
        }
      }, 1000)
    }
    
    // Subscribe to game state changes
    const unsubscribe = useGameStore.subscribe((state) => {
      if (state.isGameRunning && state.phase === 'betting' && !interval) {
        startTimer()
      } else if ((!state.isGameRunning || state.phase !== 'betting') && interval) {
        clearInterval(interval)
        interval = null
      }
    })
    
    // Initial check
    const initialState = useGameStore.getState()
    if (initialState.isGameRunning && initialState.phase === 'betting') {
      startTimer()
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
      unsubscribe()
    }
  }, []) // No dependencies - runs once

  return (
    <GameContext.Provider value={gameStore}>
      {children}
      <NotificationSystem 
        notifications={notifications} 
        onDismiss={dismissNotification} 
      />
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
