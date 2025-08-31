import { useGame } from '../contexts/GameContext'

const CHIP_VALUES = [1, 5, 10, 25, 100]

export default function ImprovedBettingChips() {
  const game = useGame()

  const getChipStyle = (value: number) => {
    const baseStyle = "w-12 h-12 rounded-full border-2 border-gray-600 flex items-center justify-center font-bold text-white cursor-pointer transition-all hover:scale-110 shadow-lg"
    
    switch (value) {
      case 1:
        return `${baseStyle} bg-gradient-to-br from-red-700 to-red-900 border-red-800`
      case 5:
        return `${baseStyle} bg-gradient-to-br from-blue-700 to-blue-900 border-blue-800`
      case 10:
        return `${baseStyle} bg-gradient-to-br from-green-700 to-green-900 border-green-800`
      case 25:
        return `${baseStyle} bg-gradient-to-br from-purple-700 to-purple-900 border-purple-800`
      case 100:
        return `${baseStyle} bg-gradient-to-br from-yellow-600 to-yellow-800 text-black border-yellow-700`
      default:
        return `${baseStyle} bg-gradient-to-br from-gray-700 to-gray-900 border-gray-800`
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <h3 className="text-base font-semibold text-white mb-3 text-center">Betting Chips</h3>
      
      <div className="flex justify-center space-x-3">
        {CHIP_VALUES.map((value) => (
          <div
            key={value}
            onClick={() => game.setSelectedChip(value)}
            className={`${getChipStyle(value)} ${
              game.selectedChip === value ? 'ring-4 ring-roulette-gold scale-110' : ''
            }`}
          >
            <div className="text-center">
              <div className="text-xs">$</div>
              <div className="text-sm font-bold">{value}</div>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-center text-gray-400 text-xs mt-3">
        Select a chip value, then click on the table to place your bet
      </p>
    </div>
  )
}
