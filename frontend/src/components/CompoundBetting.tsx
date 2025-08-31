import { useGame } from '../contexts/GameContext'
import { clsx } from 'clsx'

type CompoundBetType = 'street' | 'corner' | 'split' | 'line'

export default function CompoundBetting() {
  const game = useGame()
  const { compoundBetting } = game

  // Validate selection whenever numbers change
  const validation = compoundBetting.type && compoundBetting.selectedNumbers.length > 0 
    ? validateSelection(compoundBetting.type, compoundBetting.selectedNumbers)
    : { isValid: false, errorMessage: '' }

  const handleBetTypeChange = (type: CompoundBetType | null) => {
    game.setCompoundBettingMode(type)
  }

  const handlePlaceBet = async () => {
    if (!validation.isValid || !compoundBetting.type || !game.player) return

    try {
      await game.placeBet(compoundBetting.type, compoundBetting.selectedNumbers)
      // Reset after successful bet
      game.setCompoundBettingMode(null)
    } catch (error) {
      console.error('Failed to place compound bet:', error)
    }
  }

  const getMaxNumbers = (type: CompoundBetType): number => {
    switch (type) {
      case 'split': return 2
      case 'street': return 3
      case 'corner': return 4
      case 'line': return 6
      default: return 0
    }
  }

  const getRequiredNumbers = (type: CompoundBetType): number => {
    return getMaxNumbers(type)
  }

  const getBetTypeDescription = (type: CompoundBetType): string => {
    switch (type) {
      case 'split': return 'Two adjacent numbers'
      case 'street': return 'Three numbers in a column'
      case 'corner': return 'Four numbers that meet at a corner'
      case 'line': return 'Six numbers in two adjacent columns'
      default: return ''
    }
  }

  const canAffordBet = () => {
    return game.player && game.player.balance >= game.selectedChip
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-base font-semibold text-white mb-4">Compound Betting</h3>
      
      {/* Bet Type Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Bet Type
        </label>
        <select
          value={compoundBetting.type || ''}
          onChange={(e) => handleBetTypeChange(e.target.value as CompoundBetType || null)}
          disabled={game.phase !== 'betting'}
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-roulette-gold disabled:opacity-50"
        >
          <option value="">Select bet type...</option>
          <option value="split">Split (2 numbers) - 17:1 payout</option>
          <option value="street">Street (3 numbers) - 11:1 payout</option>
          <option value="corner">Corner (4 numbers) - 8:1 payout</option>
          <option value="line">Line (6 numbers) - 5:1 payout</option>
        </select>
      </div>

      {/* Instructions */}
      {compoundBetting.type && (
        <div className="mb-4 p-3 bg-gray-700 rounded-md">
          <p className="text-sm text-gray-300">
            <strong>{compoundBetting.type.toUpperCase()}:</strong> {getBetTypeDescription(compoundBetting.type)}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Click {getRequiredNumbers(compoundBetting.type)} numbers on the roulette table.
            Selected: {compoundBetting.selectedNumbers.length}/{getRequiredNumbers(compoundBetting.type)}
          </p>
        </div>
      )}

      {/* Selected Numbers Display */}
      {compoundBetting.selectedNumbers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Selected Numbers</h4>
          <div className="flex flex-wrap gap-2">
            {compoundBetting.selectedNumbers.map((number) => (
              <span
                key={number}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-roulette-gold text-black"
              >
                {number}
                <button
                  onClick={() => game.selectCompoundNumber(number)}
                  className="ml-1 text-black hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Validation Message */}
      {validation.errorMessage && (
        <div className="mb-4 p-2 bg-red-900/50 border border-red-600 rounded-md">
          <p className="text-sm text-red-300">{validation.errorMessage}</p>
        </div>
      )}

      {/* Place Bet Button */}
      <button
        onClick={handlePlaceBet}
        disabled={!validation.isValid || !canAffordBet() || game.phase !== 'betting'}
        className={clsx(
          'w-full py-2 px-4 rounded-md font-medium transition-colors',
          validation.isValid && canAffordBet() && game.phase === 'betting'
            ? 'bg-roulette-gold text-black hover:bg-yellow-500'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        )}
      >
        {!canAffordBet() ? 'Insufficient Balance' : 
         !validation.isValid ? 'Select Valid Numbers' :
         `Place ${compoundBetting.type?.toUpperCase()} Bet ($${game.selectedChip})`}
      </button>

      {/* Status Messages */}
      <div className="mt-4 text-center text-sm text-gray-400">
        {!compoundBetting.type && <p>Select a compound bet type to start</p>}
        {compoundBetting.type && game.phase !== 'betting' && (
          <p className="text-yellow-400">Betting is currently closed</p>
        )}
      </div>
    </div>
  )
}

// Validation functions
function validateSelection(type: CompoundBetType, numbers: number[]): { isValid: boolean; errorMessage: string } {
  if (numbers.length === 0) {
    return { isValid: false, errorMessage: '' }
  }

  // Check if all numbers are valid (0-36)
  if (numbers.some(n => n < 0 || n > 36)) {
    return { isValid: false, errorMessage: 'Invalid numbers selected' }
  }

  switch (type) {
    case 'split':
      return validateSplit(numbers)
    case 'street':
      return validateStreet(numbers)
    case 'corner':
      return validateCorner(numbers)
    case 'line':
      return validateLine(numbers)
    default:
      return { isValid: false, errorMessage: 'Unknown bet type' }
  }
}

function validateSplit(numbers: number[]): { isValid: boolean; errorMessage: string } {
  if (numbers.length !== 2) {
    return { isValid: false, errorMessage: `Select exactly 2 numbers (${numbers.length}/2 selected)` }
  }

  const [a, b] = numbers.sort((x, y) => x - y)
  
  // Check if numbers are adjacent horizontally or vertically
  // Horizontal adjacency: consecutive numbers in same row
  if (Math.abs(a - b) === 1) {
    // Make sure they're in the same row (not wrapping around)
    const rowA = Math.ceil(a / 3)
    const rowB = Math.ceil(b / 3)
    if (rowA === rowB) {
      return { isValid: true, errorMessage: '' }
    }
  }
  
  // Vertical adjacency: numbers 3 apart
  if (Math.abs(a - b) === 3) {
    return { isValid: true, errorMessage: '' }
  }

  // Special case for 0 (can be adjacent to 1, 2, 3)
  if ((a === 0 && [1, 2, 3].includes(b)) || (b === 0 && [1, 2, 3].includes(a))) {
    return { isValid: true, errorMessage: '' }
  }

  return { isValid: false, errorMessage: 'Numbers must be adjacent on the table' }
}

function validateStreet(numbers: number[]): { isValid: boolean; errorMessage: string } {
  if (numbers.length !== 3) {
    return { isValid: false, errorMessage: `Select exactly 3 numbers (${numbers.length}/3 selected)` }
  }

  const sorted = numbers.sort((a, b) => a - b)
  
  // Check if numbers form a horizontal row (consecutive numbers)
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) {
    // Ensure they're all in the same row
    const row = Math.ceil(sorted[0] / 3)
    if (sorted.every(n => Math.ceil(n / 3) === row)) {
      return { isValid: true, errorMessage: '' }
    }
  }

  return { isValid: false, errorMessage: 'Numbers must be three consecutive numbers in the same row' }
}

function validateCorner(numbers: number[]): { isValid: boolean; errorMessage: string } {
  if (numbers.length !== 4) {
    return { isValid: false, errorMessage: `Select exactly 4 numbers (${numbers.length}/4 selected)` }
  }

  const sorted = numbers.sort((a, b) => a - b)
  
  // Check if numbers form a 2x2 square
  // Pattern: [n, n+1, n+3, n+4] where n is the top-left corner
  const [a, b, c, d] = sorted
  
  if (b === a + 1 && c === a + 3 && d === a + 4) {
    // Ensure the top-left number is not at the right edge of a row
    if (a % 3 !== 0) { // Not at the right edge (multiples of 3 are right edge)
      return { isValid: true, errorMessage: '' }
    }
  }

  return { isValid: false, errorMessage: 'Numbers must form a 2×2 square on the table' }
}

function validateLine(numbers: number[]): { isValid: boolean; errorMessage: string } {
  if (numbers.length !== 6) {
    return { isValid: false, errorMessage: `Select exactly 6 numbers (${numbers.length}/6 selected)` }
  }

  const sorted = numbers.sort((a, b) => a - b)
  
  // Check if numbers form two adjacent rows (6 consecutive numbers)
  // Pattern: [n, n+1, n+2, n+3, n+4, n+5] where they span exactly 2 rows
  const [a, b, c, d, e, f] = sorted
  
  if (b === a + 1 && c === a + 2 && d === a + 3 && e === a + 4 && f === a + 5) {
    // Check if they span exactly 2 rows
    const startRow = Math.ceil(a / 3)
    const endRow = Math.ceil(f / 3)
    
    // Must span exactly 2 adjacent rows and start at the beginning of a row
    if (endRow === startRow + 1 && a % 3 === 1) { // Start at position 1 of a row (1, 4, 7, etc.)
      return { isValid: true, errorMessage: '' }
    }
  }

  return { isValid: false, errorMessage: 'Numbers must be 6 consecutive numbers spanning two adjacent columns' }
}
