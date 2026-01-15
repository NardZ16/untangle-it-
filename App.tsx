
import React, { useState, useEffect } from 'react';
import GameScene from './components/GameScene';

const App: React.FC = () => {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [unlockedLevel, setUnlockedLevel] = useState(1);
  const [isWon, setIsWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const [showMenu, setShowMenu] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('untangle-progress-mobile-v1');
    if (saved) setUnlockedLevel(parseInt(saved));
  }, []);

  const handleLevelComplete = () => {
    setIsWon(true);
    const next = currentLevel + 1;
    if (next > unlockedLevel) {
      setUnlockedLevel(next);
      localStorage.setItem('untangle-progress-mobile-v1', next.toString());
    }
  };

  const startLevel = (lvl: number) => {
    setCurrentLevel(lvl);
    setMoves(0);
    setIsWon(false);
    setShowMenu(false);
  };

  const nextLevel = () => {
    if (currentLevel < 100) {
      startLevel(currentLevel + 1);
    } else {
      setShowMenu(true);
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#f8fafc] text-slate-800 overflow-hidden font-sans select-none touch-none">
      {/* HUD - Mobile Optimized */}
      {!showMenu && (
        <div className="fixed top-0 left-0 w-full z-10 pointer-events-none p-4 md:p-10 flex justify-between items-start">
          <button 
            onClick={() => setShowMenu(true)}
            className="pointer-events-auto bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white hover:scale-105 active:scale-90 transition-all"
          >
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
          
          <div className="flex flex-col items-center">
            <div className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-3xl shadow-xl border border-white flex flex-col items-center min-w-[140px]">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Level</h2>
              <span className="text-3xl font-black text-slate-900 leading-none">{currentLevel}</span>
            </div>
            <div className="mt-2 bg-pink-500 text-white px-5 py-1 rounded-full shadow-lg shadow-pink-200 font-black text-[10px] uppercase tracking-widest">
              {moves} MOVES
            </div>
          </div>

          <div className="w-14"></div>
        </div>
      )}

      {/* Game Canvas */}
      {!showMenu && (
        <GameScene 
          level={currentLevel} 
          onComplete={handleLevelComplete} 
          onMove={() => setMoves(m => m + 1)}
        />
      )}

      {/* Main Menu - Mobile Friendly Grid */}
      {showMenu && (
        <div className="absolute inset-0 z-40 bg-[#f8fafc] flex flex-col items-center justify-start p-6 pt-20 overflow-y-auto">
          <div className="text-center mb-10 shrink-0">
            <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter mb-2 drop-shadow-sm">KNOT</h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-1 w-8 bg-blue-600 rounded-full"></div>
              <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Untangle 3D</p>
              <div className="h-1 w-8 bg-blue-600 rounded-full"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 md:grid-cols-5 gap-3 w-full max-w-sm mb-12">
            {Array.from({ length: 100 }).map((_, i) => {
              const lvl = i + 1;
              const isLocked = lvl > unlockedLevel;
              return (
                <button
                  key={lvl}
                  disabled={isLocked}
                  onClick={() => startLevel(lvl)}
                  className={`
                    aspect-square rounded-2xl font-black text-lg flex items-center justify-center transition-all
                    ${isLocked 
                      ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                      : 'bg-white shadow-md text-blue-600 active:scale-95 border-2 border-transparent hover:border-blue-200'}
                  `}
                >
                  {isLocked ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zM7 7a3 3 0 016 0v2H7V7z" />
                    </svg>
                  ) : lvl}
                </button>
              );
            })}
          </div>
          
          <button 
            onClick={() => startLevel(Math.min(unlockedLevel, 100))}
            className="shrink-0 bg-blue-600 text-white w-full max-w-sm py-5 rounded-3xl font-black text-xl shadow-2xl shadow-blue-200 active:scale-95 transition-all mb-10"
          >
            PLAY NOW
          </button>
        </div>
      )}

      {/* Win Modal - Full Screen Mobile Style */}
      {isWon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6">
          <div className="bg-white w-full max-w-sm p-10 rounded-[3rem] shadow-2xl text-center scale-up-center border-4 border-white">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-100">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-4xl font-black mb-1 text-slate-900 tracking-tight">SOLVED!</h2>
            <p className="text-slate-400 font-bold mb-8 tracking-widest uppercase text-[10px]">Level {currentLevel} Cleared</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={nextLevel}
                className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xl transition-all active:scale-95 shadow-lg shadow-blue-200"
              >
                {currentLevel < 100 ? 'NEXT LEVEL' : 'ALL SOLVED!'}
              </button>
              <button 
                onClick={() => setShowMenu(true)}
                className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-black transition-all active:scale-95"
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
