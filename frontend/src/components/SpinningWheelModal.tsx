// SpinningWheelModal.tsx
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import rouletteWheelImg from "../assets/roulette-wheel.png";

interface SpinningWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: number | null;
  onSpinComplete: () => void;
  bettingResult?: {
    totalWagered: number;
    totalWon: number;
    netResult: number;
    participatedInRound: boolean;
    potentialWinnings?: number;
    winningBetsWagered?: number;
  } | null;
  isBackendSyncing?: boolean;
}

const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
]; // Standard European roulette wheel order (clockwise from 0)

export default function SpinningWheelModal({ isOpen, onClose, result: propResult, onSpinComplete, bettingResult, isBackendSyncing = false }: SpinningWheelModalProps) {
  const [rotation, setRotation] = useState(0); // accumulated rotation degrees
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runActiveRef = useRef(false);

  const SPIN_DURATION_MS = 2000;
  const SLOTS = WHEEL_ORDER.length;
  const DEG_PER_SLOT = 360 / SLOTS;

  useEffect(() => {
    const clearTimers = () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
    };

    // Start a single run when isOpen flips true and no run is active
    if (isOpen && !runActiveRef.current && propResult !== null && propResult !== 0) {
      runActiveRef.current = true;
      setShowResult(false);
      setResult(null);

      // Use the result passed from parent component
      const randomNumber = propResult;
      const index = WHEEL_ORDER.indexOf(randomNumber);
      
      // Calculate the base rotation needed to land on the selected number
      const baseRotation = (360 - (index * DEG_PER_SLOT)) % 360;
      
      // Add extra full spins (5-8 rotations) for natural feel
      const extraSpins = 5 + Math.floor(Math.random() * 4);
      
      // Calculate total rotation (current + full spins + base rotation)
      const targetRotation = rotation + (extraSpins * 360) + baseRotation;

      // trigger animation by updating rotation
      // framer-motion will animate from current rotation -> targetRotation
      setIsSpinning(true);
      setRotation(targetRotation);

      // After spin duration: stop spinning and show result
      spinTimerRef.current = setTimeout(() => {
        setIsSpinning(false);
        setShowResult(true);
        setResult(randomNumber);
        
        // Call onSpinComplete to trigger game state updates
        onSpinComplete();

        // No auto-close timer - user will click Continue button
      }, SPIN_DURATION_MS);
    }

    // If modal closed externally while running, cancel timers and reset state
    if (!isOpen) {
      runActiveRef.current = false;
      clearTimers();
      setIsSpinning(false);
      setShowResult(false);
      setResult(null);
    }

    return () => {
      // cleanup on unmount or deps change
      runActiveRef.current = false;
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, propResult]); // React to both isOpen and propResult changes

  if (!isOpen) return null;

  const getNumberColor = (n: number) => {
    if (n === 0) return "text-green-400";
    const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    return redNumbers.has(n) ? "text-red-400" : "text-white";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 text-center shadow-2xl">
        <div className="mb-4">
          <div className="relative mx-auto w-64 h-64">
            <motion.img
              src={rouletteWheelImg}
              alt="Roulette Wheel"
              style={{ originX: 0.5, originY: 0.5 }}
              animate={{ rotate: rotation }}
              transition={{ 
                duration: SPIN_DURATION_MS / 1000, 
                ease: [0.15, 0.1, 0.15, 1.0],
                type: "tween"
              }}
              className="w-full h-full rounded-full object-cover"
            />
            {/* Ball marker - purely decorative */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border border-gray-300"></div>
          </div>
        </div>

        {isSpinning && <div className="text-white text-lg font-semibold mb-2">Spinning...</div>}
        
        {!isSpinning && !showResult && (
          <div className="text-white text-lg font-semibold mb-2">Fetching random number...</div>
        )}
        
        {isBackendSyncing && showResult && (
          <div className="text-yellow-400 text-sm font-medium mb-2 flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
            <span>Submitting & validating with backend...</span>
          </div>
        )}

        {showResult && result !== null && (
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-1">Winning Number</h3>
            <div className={`text-5xl font-extrabold ${getNumberColor(result)} mb-1`}>{result}</div>
            <div className="text-sm text-gray-400 mb-3">
              {result === 0 ? "Green" : (getNumberColor(result) === "text-red-400" ? "Red" : "Black")}
            </div>
            
            {/* Betting Result Display - Always show if there's betting data */}
            {bettingResult && (
              <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                {!bettingResult.participatedInRound ? (
                  <div className="text-gray-300 text-sm font-medium">
                    💤 You did not participate in this round
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400 flex items-center justify-between">
                      <span>Your Result</span>
                      {isBackendSyncing && (
                        <span className="text-yellow-400 text-xs flex items-center space-x-1">
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-yellow-400"></div>
                          <span>Verifying...</span>
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">Wagered:</span>
                      <span className="text-red-400">-${bettingResult.totalWagered.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">Won:</span>
                      <span className="text-green-400">
                        +${bettingResult.totalWon.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-gray-600 pt-1 mt-2">
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-white">Net Result:</span>
                        <span className={`${bettingResult.netResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {bettingResult.netResult >= 0 ? '+' : ''}${bettingResult.netResult.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Continue Button - Shows loading during backend sync */}
            <button
              onClick={() => {
                setShowResult(false);
                setResult(null);
                runActiveRef.current = false;
                // Call onClose which will trigger continueToNextRound and fresh state
                onClose();
              }}
              disabled={isBackendSyncing}
              className={`mt-4 font-bold py-2 px-6 rounded-lg transition-colors shadow-lg ${
                isBackendSyncing 
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                  : 'bg-primary-gold hover:bg-yellow-400 text-black'
              }`}
            >
              {isBackendSyncing ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300"></div>
                  <span>Submitting & Validating...</span>
                </div>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
