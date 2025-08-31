import { useGame } from '../contexts/GameContext'
import { Target } from 'lucide-react'

export default function GameStats() {
  const game = useGame()

  return (
    <div className="space-y-4">
      {/* Recent Spins */}
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h3 className="text-base font-semibold text-white mb-2 flex items-center">
          Recent Spins
        </h3>
        <div className="grid grid-cols-10 gap-1">
          {game.recentSpins.slice(0, 10).map((spin, index) => (
            <div
              key={index}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                spin.color === 'red' ? 'bg-roulette-red text-white' :
                spin.color === 'black' ? 'bg-roulette-black text-white' :
                'bg-gray-700 text-white' 
              }`}
              title={`${spin.winningNumber} (${spin.color})`}
            >
              {spin.winningNumber}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 10 - game.recentSpins.length) }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-400"
            >
              -
            </div>
          ))}
        </div>
      </div>



      {/* Player Stats */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
          <Target className="w-5 h-5 mr-2 text-roulette-gold" />
          Your Stats
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Balance:</span>
            <span className="text-white font-medium">
              ${game.player?.balance?.toFixed(2) || '0.00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Winnings:</span>
            <span className="text-roulette-gold font-medium">
              ${game.player?.totalWinnings?.toFixed(2) || '0.00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Active Bets:</span>
            <span className="text-white font-medium">
              {game.activeBets.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Bet Total:</span>
            <span className="text-white font-medium">
              ${game.activeBets.reduce((sum, bet) => sum + bet.amount, 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
