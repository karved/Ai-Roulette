import { useGame } from '../contexts/GameContext'

export default function BalanceTestDemo() {
  const game = useGame()

  const testInsufficientBalance = async () => {
    // Try to place a bet larger than current balance
    const testAmount = (game.player?.balance || 0) + 50 // Bet more than available
    await game.placeBet('straight', [7], testAmount)
  }

  const testValidBet = async () => {
    // Place a normal bet within balance
    await game.placeBet('red', [], 5)
  }

  const addTestBalance = () => {
    if (game.player) {
      game.setPlayer({
        ...game.player,
        balance: game.player.balance + 100
      })
    }
  }

  if (!game.player) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <p className="text-white">Please log in to test balance notifications</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Balance Test Demo</h3>
      
      <div className="space-y-3">
        <div className="text-sm text-gray-300">
          <p><strong>Current Balance:</strong> ${game.player.balance.toFixed(2)}</p>
          <p><strong>Selected Chip:</strong> ${game.selectedChip}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={testValidBet}
            disabled={game.phase !== 'betting'}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Test Valid Bet ($5 on Red)
          </button>

          <button
            onClick={testInsufficientBalance}
            disabled={game.phase !== 'betting'}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:cursor-not-allowed"
          >
            Test Insufficient Balance
          </button>

          <button
            onClick={addTestBalance}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add $100 Balance
          </button>
        </div>

        <div className="text-xs text-gray-400">
          <p>• Click "Test Insufficient Balance" to see the notification popup</p>
          <p>• The notification will show for 4 seconds with an action button</p>
          <p>• No bet will be placed when balance is insufficient</p>
        </div>
      </div>
    </div>
  )
}
