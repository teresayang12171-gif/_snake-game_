import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Play, Pause, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 560;
const GRID_SIZE = 20;
const INITIAL_SPEED = 150; // ms
const SPEED_INCREMENT = 1.5;
const MIN_SPEED = 50;

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const INITIAL_SNAKE: Point[] = [
  { x: 20, y: 14 },
  { x: 19, y: 14 },
  { x: 18, y: 14 },
  { x: 17, y: 14 },
];

const INITIAL_DIRECTION: Direction = 'RIGHT';

export default function SnakeGame() {
  // --- State ---
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 28, y: 7 });
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [nextDirection, setNextDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>('IDLE');
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // --- Helpers ---
  const getRandomPoint = useCallback((): Point => {
    return {
      x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
      y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)),
    };
  }, []);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setNextDirection(INITIAL_DIRECTION);
    setFood(getRandomPoint());
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setStatus('PLAYING');
    lastUpdateTimeRef.current = performance.now();
  };

  const togglePause = () => {
    if (status === 'PLAYING') setStatus('PAUSED');
    else if (status === 'PAUSED') setStatus('PLAYING');
  };

  // --- Logic ---
  const moveSnake = useCallback(() => {
    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = { ...head };

      // Update current direction from queued nextDirection
      setDirection(nextDirection);

      switch (nextDirection) {
        case 'UP': newHead.y -= 1; break;
        case 'DOWN': newHead.y += 1; break;
        case 'LEFT': newHead.x -= 1; break;
        case 'RIGHT': newHead.x += 1; break;
      }

      // 1. Check wall collision
      if (
        newHead.x < 0 ||
        newHead.x >= CANVAS_WIDTH / GRID_SIZE ||
        newHead.y < 0 ||
        newHead.y >= CANVAS_HEIGHT / GRID_SIZE
      ) {
        setStatus('GAME_OVER');
        return prevSnake;
      }

      // 2. Check self collision
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setStatus('GAME_OVER');
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // 3. Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((s) => s + 10);
        setSpeed((s) => Math.max(MIN_SPEED, s - SPEED_INCREMENT));
        setFood(getRandomPoint());
        // Don't pop - let it grow
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, nextDirection, getRandomPoint]);

  // Handle Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction !== 'DOWN') setNextDirection('UP');
          break;
        case 'ArrowDown':
          if (direction !== 'UP') setNextDirection('DOWN');
          break;
        case 'ArrowLeft':
          if (direction !== 'RIGHT') setNextDirection('LEFT');
          break;
        case 'ArrowRight':
          if (direction !== 'LEFT') setNextDirection('RIGHT');
          break;
        case 'Enter':
          if (status === 'IDLE' || status === 'GAME_OVER') resetGame();
          break;
        case ' ':
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction, status]);

  // Game Loop
  useEffect(() => {
    if (status !== 'PLAYING') {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      return;
    }

    const loop = (time: number) => {
      const delta = time - lastUpdateTimeRef.current;

      if (delta > speed) {
        moveSnake();
        lastUpdateTimeRef.current = time;
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [status, speed, moveSnake]);

  // Render Loop (Canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Background Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Draw Food (Energy Node)
    ctx.fillStyle = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.arc(
      food.x * GRID_SIZE + GRID_SIZE / 2,
      food.y * GRID_SIZE + GRID_SIZE / 2,
      GRID_SIZE / 2.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Snake (Circular Segments)
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      ctx.fillStyle = isHead ? '#22c55e' : '#10b981';
      
      if (isHead) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
      }

      ctx.beginPath();
      ctx.arc(
        segment.x * GRID_SIZE + GRID_SIZE / 2,
        segment.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2.2, // Slightly smaller than grid for spacing
        0,
        Math.PI * 2
      );
      ctx.fill();
      
      // Fine border for segments
      ctx.strokeStyle = index % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.02)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.shadowBlur = 0;
    });
  }, [snake, food]);

  // Update High Score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
    }
  }, [score, highScore]);

  const level = Math.floor(score / 50) + 1;
  const speedDisplay = (INITIAL_SPEED / speed).toFixed(1);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-blue-950 font-sans p-10 relative overflow-hidden">
      {/* Background Ambience (Subtle) */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.05] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500 blur-[150px] rounded-full"></div>
      </div>

      {/* UI Badges */}
      <div className="absolute top-10 left-10 flex flex-col gap-2 z-20">
        <div className="px-3 py-1 bg-blue-50 border-l-2 border-emerald-500 text-[11px] tracking-widest uppercase font-semibold text-blue-800">
          Level {level.toString().padStart(2, '0')}
        </div>
        <div className="px-3 py-1 bg-blue-50 border-l-2 border-blue-200 text-[11px] tracking-widest uppercase font-semibold text-blue-800">
          Speed: {speedDisplay}x
        </div>
      </div>

      {/* Header */}
      <header className="w-full max-w-[800px] flex items-end justify-between mb-6 pb-4 border-b border-blue-50 z-10 transition-all duration-300">
        <h1 className="text-2xl font-bold tracking-[4px] uppercase text-blue-950">
          貪心蛇<span className="text-emerald-500">-</span>Snake game
        </h1>
        <div className="flex gap-12">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-blue-400 uppercase tracking-[2px] mb-1">Current Score</span>
            <span className="text-2xl font-mono font-bold text-emerald-600">
              {score.toLocaleString('en-US', { minimumIntegerDigits: 5 }).replace(/,/g, '')}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-blue-400 uppercase tracking-[2px] mb-1">Best Record</span>
            <span className="text-2xl font-mono font-bold text-blue-900">
              {highScore.toLocaleString('en-US', { minimumIntegerDigits: 5 }).replace(/,/g, '')}
            </span>
          </div>
        </div>
      </header>

      {/* Game Board Container */}
      <main className="relative group z-10">
        <div className="relative bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block"
          />

          {/* Overlays */}
          <AnimatePresence>
            {status === 'IDLE' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="mb-8 p-6 border border-blue-50 bg-blue-50/30 rounded-2xl">
                   <Play size={40} className="text-emerald-500 mx-auto mb-6" />
                   <h2 className="text-xl font-bold tracking-[4px] uppercase text-blue-950 mb-2">
                     貪心蛇<span className="text-emerald-500">-</span>Snake game
                   </h2>
                    <p className="text-[11px] text-blue-600 tracking-wider max-w-[280px] leading-relaxed mt-4">
                      遊戲規格：玩家控制一條蛇移動，吃食物來成長，但要避免撞到牆壁或自己的身體。
                    </p>
                </div>
                <button
                  onClick={resetGame}
                  className="px-10 py-3 bg-blue-950 text-white hover:bg-emerald-600 text-xs font-bold tracking-[3px] uppercase transition-all rounded shadow-lg shadow-emerald-200/50"
                >
                  開始遊戲 Start Game
                </button>
              </motion.div>
            )}

            {status === 'PAUSED' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center"
              >
                <div className="text-center group-hover:scale-110 transition-transform duration-500">
                   <Pause size={48} className="text-emerald-500 mx-auto mb-4" />
                   <h2 className="text-2xl font-bold tracking-[6px] uppercase text-blue-950 mb-8">
                     系統暫停 <br/> <span className="text-sm">System Halt</span>
                   </h2>
                   <button
                     onClick={togglePause}
                     className="px-8 py-3 bg-blue-950 text-white text-xs font-bold tracking-[3px] uppercase hover:bg-emerald-600 transition-colors rounded shadow-lg"
                   >
                     恢復運行 Resume
                   </button>
                 </div>
              </motion.div>
            )}

            {status === 'GAME_OVER' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center"
              >
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100">
                  <RotateCcw size={24} className="text-red-500" />
                </div>
                <h2 className="text-4xl font-bold tracking-[10px] uppercase text-red-500 mb-2 leading-none">
                   貪心蛇 <br/> <span className="text-xl">Game Over</span>
                </h2>
                <p className="text-[10px] text-blue-400 uppercase tracking-[3px] mb-8 font-mono">Critical Collision Event Discovered</p>
                
                <div className="grid grid-cols-2 gap-4 w-full max-w-[300px] mb-10">
                   <div className="p-4 bg-blue-50 border border-blue-100 text-right rounded-xl">
                      <div className="text-[9px] text-blue-400 uppercase tracking-widest mb-1">Score 分數</div>
                      <div className="text-xl font-mono text-blue-950 leading-none whitespace-nowrap font-bold">{score.toLocaleString('en-US', { minimumIntegerDigits: 5 }).replace(/,/g, '')}</div>
                   </div>
                   <div className="p-4 bg-blue-50 border border-blue-100 text-right rounded-xl">
                      <div className="text-[9px] text-blue-400 uppercase tracking-widest mb-1">Max 最高</div>
                      <div className="text-xl font-mono text-blue-950 leading-none whitespace-nowrap font-bold">{highScore.toLocaleString('en-US', { minimumIntegerDigits: 5 }).replace(/,/g, '')}</div>
                   </div>
                </div>

                <button
                  onClick={resetGame}
                  className="w-[200px] py-4 bg-red-500 text-white text-xs font-bold tracking-[4px] uppercase hover:bg-red-600 transition-all shadow-[0_10px_30px_rgba(239,68,68,0.3)] mb-4 rounded-xl"
                >
                  重啟核心 Restart
                </button>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-light opacity-50">Authorized Personnel Only</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Game Rules Footer */}
      <div className="absolute bottom-10 left-10 max-w-[300px] z-20 hidden md:block">
        <p className="text-[10px] text-blue-400 uppercase tracking-[2px] font-semibold mb-2">遊戲規格 Specification</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          玩家控制一條蛇移動，吃食物來成長，但要避免撞到牆壁或自己的身體。
        </p>
      </div>

      {/* Controls Hint */}
      <div className="absolute bottom-10 right-10 flex flex-col gap-3 text-right z-20">
         <div className="flex items-center justify-end gap-3 font-mono text-[11px] text-blue-400 uppercase tracking-widest">
            Movement
            <div className="flex gap-2">
               <span className="px-2 py-1 bg-white border border-blue-100 rounded text-blue-700 min-w-[24px] text-center shadow-sm">&uarr;</span>
               <span className="px-2 py-1 bg-white border border-blue-100 rounded text-blue-700 min-w-[24px] text-center shadow-sm">&larr;</span>
               <span className="px-2 py-1 bg-white border border-blue-100 rounded text-blue-700 min-w-[24px] text-center shadow-sm">&darr;</span>
               <span className="px-2 py-1 bg-white border border-blue-100 rounded text-blue-700 min-w-[24px] text-center shadow-sm">&rarr;</span>
            </div>
         </div>
         <div className="flex items-center justify-end gap-3 font-mono text-[11px] text-blue-400 uppercase tracking-widest">
            Pause Game
            <span className="px-3 py-1 bg-white border border-blue-100 rounded text-blue-700 font-sans text-[10px] tracking-normal shadow-sm uppercase">Space</span>
         </div>
         <div className="flex items-center justify-end gap-3 font-mono text-[11px] text-blue-400 uppercase tracking-widest">
            Reset Core
            <span className="px-3 py-1 bg-white border border-blue-100 rounded text-blue-700 font-sans text-[10px] tracking-normal shadow-sm uppercase">Enter</span>
         </div>
      </div>

      {/* Mobile Controls Overlay */}
      <div className="mt-8 flex flex-col items-center gap-2 md:hidden z-20 opacity-60 hover:opacity-100 transition-opacity">
         <button onClick={() => direction !== 'DOWN' && setNextDirection('UP')} className="p-4 bg-white border border-slate-200 rounded-full text-slate-600 shadow-md"><ChevronUp /></button>
         <div className="flex gap-8">
           <button onClick={() => direction !== 'RIGHT' && setNextDirection('LEFT')} className="p-4 bg-white border border-slate-200 rounded-full text-slate-600 shadow-md"><ChevronLeft /></button>
           <button onClick={() => direction !== 'LEFT' && setNextDirection('RIGHT')} className="p-4 bg-white border border-slate-200 rounded-full text-slate-600 shadow-md"><ChevronRight /></button>
         </div>
         <button onClick={() => direction !== 'UP' && setNextDirection('DOWN')} className="p-4 bg-white border border-slate-200 rounded-full text-slate-600 shadow-md"><ChevronDown /></button>
      </div>
    </div>
  );
}
