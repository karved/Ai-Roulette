import { useGame } from '../contexts/GameContext'

const GlassmorphicCard = ({ children, className, glowColor = '' }: { children: React.ReactNode, className?: string, glowColor?: string }) => (
  <div
    className={`relative bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl p-4 transition-all duration-300 
      ${glowColor ? `hover:shadow-[0_0_15px_2px_${glowColor}]` : 'hover:shadow-2xl hover:shadow-black/50'}
      ${className}`}>
    {children}
  </div>
)


export default function CompactGameStats() {
  const game = useGame()


  return (
    <div className="space-y-4 font-sans">

      {/* Active Bets */}
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-white flex items-center">
          Active Bets ({game.activeBets.length})
        </h3>
        <GlassmorphicCard className="p-4">
          <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
            {game.activeBets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No active bets</p>
            ) : (
              game.activeBets.map((bet) => (
                <div key={bet.id} className="bg-black/30 rounded-lg p-2 border border-white/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium text-white">{bet.betType}</span>
                      <div className="text-xs text-gray-400">
                        ${bet.amount} • {bet.numbers.join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="text-right">
                            <div className="text-sm font-bold text-green-400">
                                ${bet.potentialPayout.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-400">
                                {Math.round(bet.potentialPayout / bet.amount)}:1
                            </div>
                        </div>
                        <button 
                            onClick={() => game.removeBet(bet.id)}
                            className="text-red-500 hover:text-red-400 transition-colors"
                            title="Remove Bet"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {game.activeBets.length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/10 text-xs text-gray-400 text-center">
              Total Bet: ${game.activeBets.reduce((sum, bet) => sum + bet.amount, 0).toFixed(2)} • 
              Potential Win: ${game.activeBets.reduce((sum, bet) => sum + bet.potentialPayout, 0).toFixed(2)}
            </div>
          )}
        </GlassmorphicCard>
      </div>
    </div>
  )
}
