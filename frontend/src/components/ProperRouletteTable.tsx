import { useGame } from '../contexts/GameContext'

export default function ProperRouletteTable() {
  const game = useGame()

  // European roulette table layout - proper order
  const tableLayout = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], 
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
  ]

  const getNumberColor = (number: number) => {
    if (number === 0) return 'bg-green-600'
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
    return redNumbers.includes(number) ? 'bg-red-600' : 'bg-black'
  }

  const handleBetClick = async (betType: string, numbers: number[]) => {
    if (game.phase !== 'betting') return
    // The placeBet method will handle insufficient balance notifications
    await game.placeBet(betType, numbers, game.selectedChip)
  }

  const handleNumberClick = async (number: number) => {
    if (game.phase !== 'betting') return
    
    // If compound betting is active, handle number selection for compound bets
    if (game.compoundBetting.isActive && game.compoundBetting.onNumberSelect) {
      game.compoundBetting.onNumberSelect(number)
    } else {
      // Regular straight bet
      await handleBetClick('straight', [number])
    }
  }

  const isNumberSelected = (number: number) => {
    return game.compoundBetting.isActive && game.compoundBetting.selectedNumbers.includes(number)
  }

  const getBetChips = (betType: string, numbers: number[]) => {
    return game.activeBets.filter(bet => {
      if (bet.betType !== betType) return false
      if (numbers.length === 0) return true // Outside bets
      return bet.numbers.length === numbers.length && 
             bet.numbers.every(n => numbers.includes(n))
    })
  }


  return (
    <div className="relative bg-green-800 rounded-lg p-4 min-h-[250px]">
      <div className="mt-2 w-full max-w-full">
        {/* Main Table Layout */}
        <div className="flex flex-col space-y-1">
          {/* Top Row: Zero + Numbers + Column Bets */}
          <div className="flex gap-1 items-start">
            {/* Zero */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => handleNumberClick(0)}
                disabled={game.phase !== 'betting'}
                className={`relative w-7 h-20 rounded flex items-center justify-center text-xs font-bold text-white cursor-pointer transition-all hover:scale-105 ${getNumberColor(0)} ${isNumberSelected(0) ? 'ring-2 ring-roulette-gold' : ''}`}
              >
                0
                {getBetChips('straight', [0]).map((bet, index) => (
                  <div
                    key={bet.id}
                    className="absolute top-0 right-0 w-3 h-3 bg-roulette-gold rounded-full border border-white flex items-center justify-center text-black"
                    style={{ 
                      transform: `translate(${index * 3}px, ${index * 3}px)`, 
                      zIndex: 10 + index, 
                      fontSize: '8px',
                      lineHeight: '1'
                    }}
                  >
                    {bet.amount}
                  </div>
                ))}
              </button>
            </div>

            {/* Numbers Grid */}
            <div className="flex-1 min-w-0">
              {tableLayout.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1 mb-1">
                  {row.map((number) => (
                    <button
                      key={number}
                      onClick={() => handleNumberClick(number)}
                      disabled={game.phase !== 'betting'}
                      className={`relative w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white cursor-pointer transition-all hover:scale-105 ${getNumberColor(number)} ${isNumberSelected(number) ? 'ring-2 ring-roulette-gold' : ''}`}
                    >
                      {number}
                      {getBetChips('straight', [number]).map((bet, index) => (
                        <div
                          key={bet.id}
                          className="absolute top-0 right-0 w-3 h-3 bg-roulette-gold rounded-full border border-white flex items-center justify-center text-black"
                          style={{ 
                            transform: `translate(${index * 3}px, ${index * 3}px)`, 
                            zIndex: 10 + index, 
                            fontSize: '8px',
                            lineHeight: '1'
                          }}
                        >
                          {bet.amount}
                        </div>
                      ))}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Column Bets */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              {[
                { id: 'column1', numbers: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36] },
                { id: 'column2', numbers: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35] },
                { id: 'column3', numbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34] }
              ].map((column) => (
                <button
                  key={column.id}
                  onClick={() => handleBetClick('column', column.numbers)}
                  disabled={game.phase !== 'betting'}
                  className="relative w-10 h-7 bg-gray-600 text-white rounded flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-gray-500 transition-opacity disabled:opacity-50"
                >
                  2:1
                  {getBetChips('column', column.numbers).map((bet, chipIndex) => (
                    <div
                      key={bet.id}
                      className="absolute top-0 right-0 w-3 h-3 bg-roulette-gold rounded-full border border-white flex items-center justify-center text-black"
                      style={{ 
                        transform: `translate(${chipIndex * 3}px, ${chipIndex * 3}px)`, 
                        zIndex: 10 + chipIndex, 
                        fontSize: '8px',
                        lineHeight: '1'
                      }}
                    >
                      {bet.amount}
                    </div>
                  ))}
                </button>
              ))}
            </div>
          </div>

          {/* Dozens Row */}
          <div className="flex gap-1" style={{ marginLeft: '9px' }}>
            {[
              { id: 'dozen1', label: '1st DOZEN', numbers: Array.from({ length: 12 }, (_, i) => i + 1) },
              { id: 'dozen2', label: '2nd DOZEN', numbers: Array.from({ length: 12 }, (_, i) => i + 13) },
              { id: 'dozen3', label: '3rd DOZEN', numbers: Array.from({ length: 12 }, (_, i) => i + 25) }
            ].map((dozen) => (
              <button
                key={dozen.id}
                onClick={() => handleBetClick('dozen', dozen.numbers)}
                disabled={game.phase !== 'betting'}
                className="relative flex-1 h-7 bg-green-600 text-white rounded flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-green-500 transition-opacity disabled:opacity-50"
              >
                {dozen.label}
                {getBetChips('dozen', dozen.numbers).map((bet, chipIndex) => (
                  <div
                    key={bet.id}
                    className="absolute top-0 right-0 w-3 h-3 bg-roulette-gold rounded-full border border-white flex items-center justify-center text-black"
                    style={{ 
                      transform: `translate(${chipIndex * 3}px, ${chipIndex * 3}px)`, 
                      zIndex: 10 + chipIndex, 
                      fontSize: '8px',
                      fontWeight: 'bold'
                    }}
                  >
                    {bet.amount}
                  </div>
                ))}
              </button>
            ))}
          </div>

          {/* Outside Bets Row */}
          <div className="flex gap-1" style={{ marginLeft: '9px' }}>
            {[
              { id: 'low', label: '1-18', color: 'bg-gray-600' },
              { id: 'even', label: 'EVEN', color: 'bg-gray-600' },
              { id: 'red', label: 'RED', color: 'bg-red-600' },
              { id: 'black', label: 'BLACK', color: 'bg-black' },
              { id: 'odd', label: 'ODD', color: 'bg-gray-600' },
              { id: 'high', label: '19-36', color: 'bg-gray-600' }
            ].map((bet) => (
              <button
                key={bet.id}
                onClick={() => handleBetClick(bet.id, [])}
                disabled={game.phase !== 'betting'}
                className={`relative flex-1 h-7 flex items-center justify-center text-xs font-bold text-white cursor-pointer transition-all hover:bg-opacity-80 ${bet.color} transition-opacity disabled:opacity-50`}
              >
                {bet.label}
                {getBetChips(bet.id, []).map((betChip, chipIndex) => (
                  <div
                    key={betChip.id}
                    className="absolute top-0 right-0 w-3 h-3 bg-roulette-gold rounded-full border border-white flex items-center justify-center text-black"
                    style={{ 
                      transform: `translate(${chipIndex * 3}px, ${chipIndex * 3}px)`, 
                      zIndex: 10 + chipIndex, 
                      fontSize: '8px',
                      fontWeight: 'bold'
                    }}
                  >
                    {betChip.amount}
                  </div>
                ))}
              </button>
            ))}
          </div>
        </div>


        {/* Start/Pause Button */}
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => {
              if (game.isGameRunning) {
                game.pauseGame()
              } else {
                game.startGame()
              }
            }}
            className="bg-yellow-500 text-black py-2 px-6 rounded-lg font-bold text-sm transition-colors shadow-lg"
          >
            {game.isGameRunning ? 'Pause' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  )
}
