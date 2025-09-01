import { useEffect, useState } from 'react'
import { useAuth } from './../contexts/AuthContext'
import { useGame } from '../contexts/GameContext'
import ProperRouletteTable from './ProperRouletteTable'
import ImprovedBettingChips from './ImprovedBettingChips'
import CompoundBetting from './CompoundBetting'
import CompactGameStats from './CompactGameStats'
import EarningsStatsPanel from './EarningsStatsPanel'
import IntegratedAssistant from './IntegratedAssistant'
import SpinningWheelModal from './SpinningWheelModal'
import { DollarSign, Users, LogOut } from 'lucide-react'

export default function GameLobby() {
  const { user, signOut } = useAuth()
  const game = useGame()
  const [showSpinModal, setShowSpinModal] = useState(false)
  const [spinResult, setSpinResult] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const initializePlayer = async () => {
      if (user && !game.player) {
        setIsInitializing(true)
        
        // Set temporary player data for immediate UI response
        game.setPlayer({
          id: user.id,
          username: user.email?.split('@')[0] || 'Player',
          balance: 100, // Default starting balance
          totalWinnings: 0
        })
        
        // Initialize frontend-only player stats and start the game
        game.updateGameState({
          playerStats: {
            totalWon: 0,
            totalWagered: 0,
            totalBets: 0,
            winRate: 0
          },
          isGameRunning: false, // Start paused
          phase: 'betting',
          timeRemaining: 30
        })
        
        // Load real player stats from backend (will update the UI when complete)
        try {
          await game.loadPlayerStats(user.id)
        } catch (error) {
          console.error('Failed to load player stats:', error)
        }
        
        setIsInitializing(false)
      }
      
      setIsLoading(false)
    }
    
    initializePlayer()
  }, [user, game])

  // Watch for spin phase changes to show modal
  useEffect(() => {
    if (game.phase === 'spinning') {
      setShowSpinModal(true)
      // Set the spin result from pendingResult when available
      if (game.pendingResult && game.pendingResult.winningNumber !== 0) {
        console.log('GameLobby: Setting wheel to show backend number:', game.pendingResult.winningNumber)
        setSpinResult(game.pendingResult.winningNumber)
      }
    } else if (game.phase === 'results' && game.recentSpins.length > 0) {
      setSpinResult(game.recentSpins[0].winningNumber)
    }
  }, [game.phase, game.pendingResult, game.recentSpins])

  // Format time is now handled directly in the JSX


  // Show loading screen during initial load or when switching between auth states
  if (isLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-background font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-gold mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {isInitializing ? 'Loading Player Data...' : 'Initializing Game...'}
          </h2>
          <p className="text-gray-400">
            {isInitializing ? 'Fetching your latest stats and balance' : 'Setting up your game session'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-primary-gold">🎰 AI Roulette</h1>
              <div className="flex items-center space-x-2 text-gray-400">
                <Users className="w-4 h-4" />
                <span>{game.playerCount} players</span>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Total Pot Display - Between players and timer */}
              {game.totalPot > 0 && (
                <div className="flex items-center space-x-2 bg-primary-gold/20 border border-primary-gold/50 px-4 py-2 rounded-full">
                  <span className="text-sm text-gray-300">Total Pot:</span>
                  <span className="font-bold text-primary-gold text-lg">
                    ${game.totalPot.toFixed(2)}
                  </span>
                </div>
              )}




              {/* Game Phase with Circular Timer */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      game.timeRemaining <= 5 && game.isGameRunning ? 'animate-pulse' : ''
                    }`}
                    style={{
                      background: game.isGameRunning 
                        ? 'radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)'
                        : 'radial-gradient(circle, rgba(100,100,100,0.3) 0%, rgba(100,100,100,0.7) 100%)',
                      boxShadow: game.isGameRunning 
                        ? '0 0 10px rgba(255, 209, 102, 0.2)'
                        : '0 0 10px rgba(150, 150, 150, 0.2)'
                    }}
                  >
                    <span className={`font-bold text-sm ${
                      game.isGameRunning ? 'text-white' : 'text-gray-400'
                    }`}>
                      {game.isGameRunning && game.timeRemaining > 0 ? game.timeRemaining : game.isGameRunning ? 'GO' : game.timeRemaining}
                    </span>
                    <div 
                      className={`absolute inset-0 rounded-full border-2 ${
                        game.isGameRunning ? 'border-primary-gold/30' : 'border-gray-500/30'
                      }`}
                      style={{
                        clipPath: game.timeRemaining > 0 
                          ? `polygon(0 0, 100% 0, 100% 100%, 0% 100%)`
                          : 'none',
                        background: game.isGameRunning ? `conic-gradient(
                          transparent 0% ${100 - (game.timeRemaining / 30 * 100)}%,
                          rgba(255, 209, 102, 0.4) ${100 - (game.timeRemaining / 30 * 100)}% 100%
                        )` : 'none'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className={`text-xs ${
                    game.isGameRunning ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {game.phase.charAt(0).toUpperCase() + game.phase.slice(1)}
                    {!game.isGameRunning && ' (Paused)'}
                  </div>
                </div>
              </div>

              {/* Player Balance */}
              <div className="flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-lg">
                <DollarSign className="w-4 h-4 text-primary-gold" />
                <span className="font-medium text-white">
                  {game.player?.balance?.toFixed(2) || '0.00'}
                </span>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <span className="text-gray-300 font-semibold">
                  {game.player?.username || 'Player'}
                </span>
                <button
                  onClick={signOut}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-6">
        {/* Mobile Landscape Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
          {/* Left Sidebar - Stats */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4">
            <EarningsStatsPanel />
            <CompactGameStats />
          </div>

          {/* Main Game Area */}
          <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
            {/* Recent Spins */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-800 border border-gray-700/50 rounded-xl p-4 shadow-2xl">
              <h3 className="text-sm font-semibold text-gray-200 mb-3 tracking-wide">Recent Spins</h3>
              <div className="flex space-x-2 pb-2">
                {game.recentSpins.slice(0, 10).map((spin, index) => (
                  <div 
                    key={index}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs relative
                      shadow-lg transform transition-all duration-200 hover:scale-110 hover:shadow-xl
                      ${spin.color === 'red' 
                        ? 'bg-gradient-to-br from-red-400 via-red-600 to-red-800 shadow-red-500/30' 
                        : spin.color === 'black' 
                          ? 'bg-gradient-to-br from-gray-600 via-gray-800 to-black shadow-gray-500/30' 
                          : 'bg-gradient-to-br from-green-400 via-green-600 to-green-800 shadow-green-500/30'
                      }
                      before:absolute before:inset-1 before:rounded-full before:bg-gradient-to-br before:from-white/30 before:to-transparent before:opacity-60
                      after:absolute after:top-1 after:left-1 after:w-2 after:h-2 after:rounded-full after:bg-white/40 after:blur-sm`}
                    style={{
                      boxShadow: `
                        0 3px 6px rgba(0, 0, 0, 0.3),
                        0 1px 3px rgba(0, 0, 0, 0.2),
                        inset 0 1px 2px rgba(255, 255, 255, 0.3),
                        inset 0 -1px 2px rgba(0, 0, 0, 0.3)
                      `
                    }}
                  >
                    <span className="relative z-10 drop-shadow-sm font-sans">
                      {spin.winningNumber}
                    </span>
                  </div>
                ))}
                {game.recentSpins.length === 0 && (
                  <p className="text-sm text-gray-300/70 italic">No spins yet</p>
                )}
              </div>
            </div>
            
            {/* Roulette Table */}
            <div className="bg-[#0a5c36] rounded-xl p-2 border border-white/10 relative">
              <ProperRouletteTable />
              
              {/* Betting Controls */}
              <div className="mt-2 space-y-3">
                <ImprovedBettingChips />
                <CompoundBetting />
              </div>
              
            </div>
          </div>

          {/* Right Sidebar - AI Assistant */}
          <div className="lg:col-span-4 order-3">
            <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-4 pb-6 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                <span className="mr-2">🤖</span> AI Assistant
              </h3>
              <div className="flex-1 overflow-hidden">
                <IntegratedAssistant />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Spinning Wheel Modal */}
      <SpinningWheelModal
        isOpen={showSpinModal}
        result={spinResult}
        bettingResult={game.wheelBettingResult}
        isBackendSyncing={game.loading.backendSync}
        onClose={() => {
          setShowSpinModal(false)
          setSpinResult(null)
          // Restart timer when Continue is pressed
          game.continueToNextRound()
        }}
        onSpinComplete={() => {
          game.completeSpinResult()
        }}
      />
      
      {/* Loading overlay during backend sync */}
      {game.loading.backendSync && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-xl p-6 text-center shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-white mb-2">Processing Bets</h3>
            <p className="text-gray-400">Submitting to backend and calculating results...</p>
          </div>
        </div>
      )}
    </div>
  )
}
