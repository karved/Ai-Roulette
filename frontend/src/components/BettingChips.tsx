import { useGame } from '../contexts/GameContext'
import { clsx } from 'clsx'

const CHIP_VALUES = [1, 5, 10, 25, 100]

export default function BettingChips() {
  const game = useGame()

  const getChipColor = (value: number) => {
    switch (value) {
      case 1: return 'bg-red-500'
      case 5: return 'bg-blue-500'
      case 10: return 'bg-green-500'
      case 25: return 'bg-purple-500'
      case 100: return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const canAffordChip = (value: number) => {
    return game.player && game.player.balance >= value
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-base font-semibold text-white mb-4">Betting Chips</h3>
      <div className="flex flex-wrap gap-4 justify-center">
        {CHIP_VALUES.map((value) => (
          <button
            key={value}
            onClick={() => game.setSelectedChip(value)}
            disabled={!canAffordChip(value) || game.phase !== 'betting'}
            className={clsx(
              'chip relative',
              getChipColor(value),
              game.selectedChip === value && 'ring-4 ring-roulette-gold scale-100',
              (!canAffordChip(value) || game.phase !== 'betting') && 'opacity-50 cursor-not-allowed'
            )}
            title={`$${value} chip`}
          >
            <span className="text-white font-bold text-sm">${value}</span>
            {game.selectedChip === value && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-roulette-gold rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Active Bets Display */}
      {game.activeBets.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-300 mb-3">Your Active Bets</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {game.activeBets.map((bet) => (
              <div
                key={bet.id}
                className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded text-sm"
              >
                <div className="flex items-center space-x-2">
                  <div className={clsx('w-3 h-3 rounded-full', getChipColor(bet.amount))}></div>
                  <span className="text-gray-300">
                    ${bet.amount} on {bet.betType}
                    {bet.numbers.length > 0 && ` (${bet.numbers.join(', ')})`}
                  </span>
                </div>
                <span className="text-roulette-gold font-medium">
                  ${bet.potentialPayout}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Betting Instructions */}
      <div className="mt-4 text-center text-sm text-gray-400">
        <p>Select a chip value, then click on the table to place your bet</p>
        {game.phase !== 'betting' && (
          <p className="text-yellow-400 mt-1">Betting is currently closed</p>
        )}
      </div>
    </div>
  )
}
