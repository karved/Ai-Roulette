import { useState, useEffect } from 'react'
import { useGame } from '../contexts/GameContext'
import { Mic, MicOff, Send } from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'bot'
  content: string
  timestamp: Date
}

export default function IntegratedAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Welcome to AI Roulette! I can help you with game rules, betting strategies, and placing bets using voice commands. Try saying "bet 10 on red" or ask me about odds!',
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const game = useGame()

  useEffect(() => {
    setIsSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  }, [])

  const startListening = () => {
    if (!isSupported || game.phase !== 'betting') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      setInputText(transcript)
      setIsListening(false)
      
      // Try to parse as betting command
      const betCommand = await parseBetCommand(transcript.toLowerCase())
      if (betCommand && game.phase === 'betting') {
        try {
          game.setSelectedChip(betCommand.amount)
          await game.placeBet(betCommand.betType, betCommand.numbers)
          
          const botMessage: Message = {
            id: Date.now().toString(),
            type: 'bot',
            content: `✅ Bet placed: $${betCommand.amount} on ${betCommand.betType}${betCommand.numbers.length > 0 ? ` (${betCommand.numbers.join(', ')})` : ''}`,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
          setInputText('')
        } catch (error) {
          const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'bot',
            content: '❌ Sorry, I could not place that bet',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, errorMessage])
        }
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  const handleSendMessage = async () => {
    if (!inputText.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])

    // Check for remove/undo commands first
    const removeCommand = parseRemoveCommand(inputText.toLowerCase())
    if (removeCommand && game.activeBets.length > 0) {
      const betToRemove = game.activeBets.find(bet => 
        bet.betType === removeCommand.betType && 
        (removeCommand.numbers.length === 0 || bet.numbers.every(n => removeCommand.numbers.includes(n)))
      )
      
      if (betToRemove) {
        game.removeBet(betToRemove.id)
        const botMessage: Message = {
          id: Date.now().toString(),
          type: 'bot',
          content: `✅ Removed bet: $${betToRemove.amount} on ${betToRemove.betType}${betToRemove.numbers.length > 0 ? ` (${betToRemove.numbers.join(', ')})` : ''}`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
      } else {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'bot',
          content: '❌ No matching bet found to remove',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } else {
      // Try to parse as betting command
      const betCommand = await parseBetCommand(inputText.toLowerCase())
      if (betCommand && game.phase === 'betting') {
        try {
          game.setSelectedChip(betCommand.amount)
          await game.placeBet(betCommand.betType, betCommand.numbers)
          
          const botMessage: Message = {
            id: Date.now().toString(),
            type: 'bot',
            content: `✅ Bet placed: $${betCommand.amount} on ${betCommand.betType}${betCommand.numbers.length > 0 ? ` (${betCommand.numbers.join(', ')})` : ''}`,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
        } catch (error) {
          const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'bot',
            content: '❌ Sorry, I could not place that bet',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, errorMessage])
        }
      } else {
        // Handle as regular chat
        const response = await getAIResponse(inputText)
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMessage])
      }
    }

    setInputText('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg max-w-[85%] ${
              message.type === 'user'
                ? 'bg-blue-600 text-white ml-auto'
                : 'bg-gray-700 text-gray-100'
            }`}
          >
            <div className="text-sm">{message.content}</div>
            <div className="text-xs opacity-70 mt-1">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about rules, or say 'bet 10 on red'"
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-roulette-gold pr-12"
            />
            <button
              onClick={startListening}
              disabled={isListening || !isSupported || game.phase !== 'betting'}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded ${
                isListening
                  ? 'text-red-400 animate-pulse'
                  : game.phase === 'betting' && isSupported
                  ? 'text-roulette-gold hover:text-yellow-400'
                  : 'text-gray-500 cursor-not-allowed'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="bg-roulette-gold text-black px-3 py-2 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Try: "bet 10 on red", "place 5 on black"
        </div>
      </div>
    </div>
  )
}

// Enhanced natural language parser for voice commands
async function parseBetCommand(input: string): Promise<{ betType: string; numbers: number[]; amount: number } | null> {
  const inputLower = input.toLowerCase().trim()
  
  // Clean up common speech recognition errors
  const cleanInput = inputLower
    .replace(/bedtime/g, 'bet ten')
    .replace(/bed time/g, 'bet ten')
    .replace(/play spy/g, 'place 5')
    .replace(/play five/g, 'place 5')
    .replace(/place by/g, 'place 5')
    .replace(/put twenty five/g, 'put 25')
    .replace(/put twenty/g, 'put 20')
    .replace(/put fifteen/g, 'put 15')
    .replace(/put ten/g, 'put 10')
    .replace(/put five/g, 'put 5')
    .replace(/bet twenty five/g, 'bet 25')
    .replace(/bet twenty/g, 'bet 20')
    .replace(/bet fifteen/g, 'bet 15')
    .replace(/bet ten/g, 'bet 10')
    .replace(/bet five/g, 'bet 5')
    .replace(/place twenty five/g, 'place 25')
    .replace(/place twenty/g, 'place 20')
    .replace(/place fifteen/g, 'place 15')
    .replace(/place ten/g, 'place 10')
    .replace(/place five/g, 'place 5')
    .replace(/number seven/g, 'number 7')
    .replace(/number eight/g, 'number 8')
    .replace(/number nine/g, 'number 9')
    .replace(/number zero/g, 'number 0')
    .replace(/number one/g, 'number 1')
    .replace(/number two/g, 'number 2')
    .replace(/number three/g, 'number 3')
    .replace(/number four/g, 'number 4')
    .replace(/number five/g, 'number 5')
    .replace(/number six/g, 'number 6')
  
  const patterns: Array<{ regex: RegExp; betType: string; numbers: number[] }> = [
    // Enhanced patterns with more variations
    { regex: /(?:bet|place|put)\s+(\d+)\s+(?:on\s+|dollars?\s+on\s+)?red/i, betType: 'red', numbers: [] },
    { regex: /(?:bet|place|put)\s+(\d+)\s+(?:on\s+|dollars?\s+on\s+)?black/i, betType: 'black', numbers: [] },
    { regex: /(?:bet|place|put)\s+(\d+)\s+(?:on\s+|dollars?\s+on\s+)?even/i, betType: 'even', numbers: [] },
    { regex: /(?:bet|place|put)\s+(\d+)\s+(?:on\s+|dollars?\s+on\s+)?odd/i, betType: 'odd', numbers: [] },
    { regex: /(?:bet|place|put)\s+(\d+)\s+(?:on\s+|dollars?\s+on\s+)?(?:low|one to eighteen|1 to 18)/i, betType: 'low', numbers: [] },
    { regex: /(?:bet|place|put)\s+(\d+)\s+(?:on\s+|dollars?\s+on\s+)?(?:high|nineteen to thirty six|19 to 36)/i, betType: 'high', numbers: [] },
    { regex: /(?:bet|place|put)\s+(\d+)\s+(?:on\s+|dollars?\s+on\s+)?(?:number\s+)?(\d+)/i, betType: 'straight', numbers: [] },
    // Simpler patterns
    { regex: /(\d+)\s+(?:on\s+|dollars?\s+on\s+)?red/i, betType: 'red', numbers: [] },
    { regex: /(\d+)\s+(?:on\s+|dollars?\s+on\s+)?black/i, betType: 'black', numbers: [] },
    { regex: /(\d+)\s+(?:on\s+|dollars?\s+on\s+)?(\d+)/i, betType: 'straight', numbers: [] }
  ]

  for (const pattern of patterns) {
    const match = cleanInput.match(pattern.regex)
    if (match) {
      const amount = parseInt(match[1])
      let numbers = pattern.numbers
      
      if (pattern.betType === 'straight' && match[2]) {
        const number = parseInt(match[2])
        if (number >= 0 && number <= 36) {
          numbers = [number]
        } else {
          continue
        }
      }
      
      if (amount > 0) {
        return { betType: pattern.betType, numbers, amount }
      }
    }
  }
  
  return null
}

async function getAIResponse(input: string): Promise<string> {
  const inputLower = input.toLowerCase()
  
  if (inputLower.includes('rule') || inputLower.includes('how') || inputLower.includes('play')) {
    return "🎰 Roulette Rules: Place bets on numbers, colors, or groups. The wheel spins and if your bet wins, you get paid! Straight numbers pay 35:1, red/black pay 1:1. You can bet by clicking the table or using voice commands like 'bet 10 on red'."
  }
  
  if (inputLower.includes('odd') || inputLower.includes('payout') || inputLower.includes('pay')) {
    return "💰 Payouts: Straight number (35:1), Red/Black/Even/Odd/Low/High (1:1), Dozens/Columns (2:1). The house edge is 2.7% on European roulette."
  }
  
  if (inputLower.includes('strategy') || inputLower.includes('tip')) {
    return "🎯 Strategy Tips: Start with outside bets (red/black, odd/even) for better odds. Straight numbers are riskier but pay more. Manage your bankroll and set limits. Remember, every spin is independent!"
  }
  
  if (inputLower.includes('voice') || inputLower.includes('command')) {
    return "🎤 Voice Commands: Try saying 'bet 10 on red', 'place 5 on black', 'bet 25 on number 7', or 'put 15 on even'. I'll place the bet for you automatically!"
  }
  
  if (inputLower.includes('balance') || inputLower.includes('money')) {
    return "💵 You start with $100. Win bets to increase your balance, lose bets and it decreases. If you reach $0, you'll need to create a new account to continue playing."
  }
  
  return "🤖 I'm here to help with roulette! Ask me about rules, odds, strategies, or use voice commands to place bets. Try 'bet 10 on red' or ask about payout odds!"
}

function parseRemoveCommand(input: string): { betType: string; numbers: number[] } | null {
  const inputLower = input.toLowerCase().trim()
  
  const removePatterns: Array<{ regex: RegExp; betType: string; numbers: number[] }> = [
    { regex: /(?:remove|unplace|undo)\s+(?:bet\s+on\s+)?red/i, betType: 'red', numbers: [] },
    { regex: /(?:remove|unplace|undo)\s+(?:bet\s+on\s+)?black/i, betType: 'black', numbers: [] },
    { regex: /(?:remove|unplace|undo)\s+(?:bet\s+on\s+)?even/i, betType: 'even', numbers: [] },
    { regex: /(?:remove|unplace|undo)\s+(?:bet\s+on\s+)?odd/i, betType: 'odd', numbers: [] },
    { regex: /(?:remove|unplace|undo)\s+(?:bet\s+on\s+)?(?:low|1-18)/i, betType: 'low', numbers: [] },
    { regex: /(?:remove|unplace|undo)\s+(?:bet\s+on\s+)?(?:high|19-36)/i, betType: 'high', numbers: [] },
    { regex: /(?:remove|unplace|undo)\s+(?:bet\s+on\s+)?(?:number\s+)?(\d+)/i, betType: 'straight', numbers: [] },
  ]

  for (const pattern of removePatterns) {
    const match = inputLower.match(pattern.regex)
    if (match) {
      let numbers = pattern.numbers
      
      if (pattern.betType === 'straight' && match[1]) {
        const number = parseInt(match[1])
        if (number >= 0 && number <= 36) {
          numbers = [number]
        } else {
          continue
        }
      }
      
      return { betType: pattern.betType, numbers }
    }
  }
  
  return null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
  
  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null
    onresult: ((this: SpeechRecognition, ev: any) => any) | null
    onerror: ((this: SpeechRecognition, ev: { error: any }) => any) | null
    onend: ((this: SpeechRecognition, ev: Event) => any) | null
    start(): void
    stop(): void
  }
}
