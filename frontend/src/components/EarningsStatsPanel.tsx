import { useGame } from '../contexts/GameContext'
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Coins } from 'lucide-react'
import { Tooltip } from './ui/Tooltip'

const StatsCard = ({ title, value, tooltip, icon: Icon, bgColor, textColor }: { 
  title: string
  value: string
  tooltip: string
  icon: React.ElementType
  bgColor: string
  textColor: string
}) => (
  <Tooltip content={tooltip}>
    <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-3 transition-all duration-200 hover:border-primary-gold/50">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-4 h-4 ${textColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 truncate">{title}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
      </div>
    </div>
  </Tooltip>
)

export default function EarningsStatsPanel() {
  const { playerStats, player, loading } = useGame()
  
  // Calculate stats from player data
  const stats = {
    currentBalance: player?.balance || 0,
    totalWon: playerStats?.totalWon || 0, // Net winnings from backend
    totalWagered: playerStats?.totalWagered || 0,
    totalBets: playerStats?.totalBets || 0,
    netChange: playerStats?.totalWon || 0, // Net profit/loss
    winRate: playerStats?.winRate || 0 // Use backend calculated win rate
  }
  
  if (loading?.playerStats) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gray-600 animate-pulse">
                  <div className="w-4 h-4 bg-gray-500 rounded"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="h-3 bg-gray-600 rounded w-12 mb-1 animate-pulse"></div>
                  <div className="h-5 bg-gray-600 rounded w-16 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  if (!player) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Quick Stats</h3>
        <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm mb-2">Sign in to track your stats</p>
          <p className="text-xs text-gray-500">Get 100 free chips when you sign up!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Quick Stats</h3>
      <div className="grid grid-cols-2 gap-2">
        <StatsCard
          title="Balance"
          value={`$${Math.round(stats.currentBalance)}`}
          tooltip={`Current balance: $${stats.currentBalance.toFixed(2)}`}
          icon={DollarSign}
          bgColor="bg-yellow-900/30"
          textColor="text-yellow-400"
        />
        <StatsCard
          title="Wagered"
          value={`$${Math.round(stats.totalWagered)}`}
          tooltip={`Total amount wagered: $${stats.totalWagered.toFixed(2)}`}
          icon={Coins}
          bgColor="bg-red-900/30"
          textColor="text-red-400"
        />
        <StatsCard
          title="Net"
          value={`${stats.netChange >= 0 ? '+' : '-'}$${Math.round(Math.abs(stats.netChange))}`}
          tooltip={`Net result: $${stats.netChange.toFixed(2)}`}
          icon={stats.netChange >= 0 ? TrendingUp : TrendingDown}
          bgColor={stats.netChange >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}
          textColor={stats.netChange >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatsCard
          title="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          tooltip={`${stats.winRate.toFixed(1)}% win rate across ${stats.totalBets} bets`}
          icon={BarChart2}
          bgColor="bg-purple-900/30"
          textColor="text-purple-400"
        />
      </div>
    </div>
  )
}