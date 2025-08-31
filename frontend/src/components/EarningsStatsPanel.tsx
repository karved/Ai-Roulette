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
  const { playerStats, player } = useGame()
  
  // Calculate stats from player data
  const stats = {
    currentBalance: player?.balance || 0,
    totalWon: playerStats?.totalWon || 0,
    totalWagered: playerStats?.totalWagered || 0,
    totalBets: playerStats?.totalBets || 0,
    netChange: (playerStats?.totalWon || 0) - (playerStats?.totalWagered || 0),
    winRate: playerStats?.totalWagered ? 
      Math.round(((playerStats?.totalWon || 0) / playerStats.totalWagered) * 100) : 0
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Quick Stats</h3>
      <div className="grid grid-cols-2 gap-2">
        <StatsCard
          title="Balance"
          value={`$${stats.currentBalance.toFixed(2)}`}
          tooltip={`Current balance: $${stats.currentBalance.toFixed(2)}`}
          icon={DollarSign}
          bgColor="bg-yellow-900/30"
          textColor="text-yellow-400"
        />
        <StatsCard
          title="Wagered"
          value={`$${stats.totalWagered.toFixed(2)}`}
          tooltip={`Total amount wagered`}
          icon={Coins}
          bgColor="bg-red-900/30"
          textColor="text-red-400"
        />
        <StatsCard
          title="Net"
          value={`${stats.netChange >= 0 ? '+' : '-'}$${Math.abs(stats.netChange).toFixed(2)}`}
          tooltip={`${stats.netChange >= 0 ? 'Profit' : 'Loss'} of $${Math.abs(stats.netChange).toFixed(2)}`}
          icon={stats.netChange >= 0 ? TrendingUp : TrendingDown}
          bgColor={stats.netChange >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}
          textColor={stats.netChange >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatsCard
          title="Win Rate"
          value={`${stats.winRate}%`}
          tooltip={`${stats.winRate}% win rate across ${stats.totalBets} bets`}
          icon={BarChart2}
          bgColor="bg-purple-900/30"
          textColor="text-purple-400"
        />
      </div>
    </div>
  )
}