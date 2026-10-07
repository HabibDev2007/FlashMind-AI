import React, { useState, useEffect } from 'react';
import { 
  Sparkles, BrainCircuit, RefreshCw, CheckCircle2, 
  XCircle, Award, Download, Upload, Flame, ChevronLeft, ChevronRight, Zap,
  Volume2, VolumeX, RotateCcw, ThumbsUp, ThumbsDown, Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState(null);
  const [mode, setMode] = useState('input'); // 'input' | 'cards' | 'quiz'
  
  // Flashcard State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Gamification & XP State
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem('study_xp') || '0', 10));
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('study_streak') || '0', 10));

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);

  // Level calculation based on XP
  const userLevel = Math.floor(xp / 100) + 1;

  useEffect(() => {
    let timer;
    if (timerActive && timeLeft > 0 && !quizSubmitted) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && timerActive && !quizSubmitted) {
      handleQuizSubmit();
    }
    return () => clearInterval(timer);
  }, [timerActive, timeLeft, quizSubmitted]);

  // Play Web Audio Sound Effects
  const playSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'flip') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'correct') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Text-to-Speech synthesizer
  const speakText = (text) => {
    if (!audioEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const addXP = (amount) => {
    const newXp = xp + amount;
    setXp(newXp);
    localStorage.setItem('study_xp', newXp.toString());
  };

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_key', key);
  };

  const updateStreak = () => {
    const newStreak = streak + 1;
    setStreak(newStreak);
    localStorage.setItem('study_streak', newStreak.toString());
  };

  // Offline Deck Fallback
  const generateOfflineDeck = (text) => {
    const sentences = text.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 15);
    const flashcards = [];
    const quiz = [];

    sentences.slice(0, 6).forEach((sentence, idx) => {
      const words = sentence.split(' ');
      if (words.length < 5) return;

      const keyWordIndex = Math.floor(words.length / 2);
      const keyWord = words[keyWordIndex].replace(/[^a-zA-Z0-9]/g, '');
      const questionText = words.map((w, i) => i === keyWordIndex ? '________' : w).join(' ');

      flashcards.push({
        id: idx + 1,
        front: `What completes this statement?\n\n"${questionText}"`,
        back: keyWord
      });

      const choices = [keyWord, 'Algorithm', 'Data Structure', 'System', 'Variable']
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 4)
        .sort(() => Math.random() - 0.5);

      quiz.push({
        id: idx + 1,
        question: `Fill in the blank: "${questionText}"`,
        options: choices,
        correctAnswer: keyWord
      });
    });

    return { title: "Generated Study Deck", flashcards, quiz };
  };

  // Gemini API Generator
  const generateWithGemini = async (text) => {
    const prompt = `Analyze the following text and generate a structured json study deck.
Output MUST be raw JSON with this exact schema:
{
  "title": "Topic Summary Title",
  "flashcards": [{"id": 1, "front": "Question/Concept", "back": "Answer/Explanation"}],
  "quiz": [{"id": 1, "question": "Question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": "Exact matching string from options"}]
}
Text: ${text}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json|```/g, '').trim();
    return JSON.parse(rawText);
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);

    try {
      let generatedData = apiKey.trim() 
        ? await generateWithGemini(inputText)
        : generateOfflineDeck(inputText);
      
      setDeck(generatedData);
      setMode('cards');
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setReviewQueue([]);
      updateStreak();
      addXP(25);
    } catch (err) {
      alert("Failed to parse AI output. Generating offline cards instead!");
      setDeck(generateOfflineDeck(inputText));
      setMode('cards');
    } finally {
      setLoading(false);
    }
  };

  const handleDifficulty = (type) => {
    playSound('flip');
    const currentCard = deck.flashcards[currentCardIndex];

    if (type === 'hard' && !reviewQueue.find(c => c.id === currentCard.id)) {
      setReviewQueue(prev => [...prev, currentCard]);
    } else if (type === 'easy') {
      addXP(10);
    }

    if (currentCardIndex < deck.flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    setTimerActive(false);
    playSound('correct');
    
    const correctCount = deck.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length;
    addXP(correctCount * 15);
    
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  };

  const startQuiz = () => {
    setMode('quiz');
    setQuizAnswers({});
    setQuizSubmitted(false);
    setTimeLeft(deck?.quiz?.length * 20 || 60);
    setTimerActive(true);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck?.title || 'deck'}.json`;
    a.click();
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setDeck(imported);
        setMode('cards');
      } catch (err) {
        alert("Invalid JSON format!");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setMode('input')}>
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              FlashMind AI
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Gamified Level & XP Badge */}
            <div className="flex items-center space-x-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-full text-indigo-400 font-semibold text-xs sm:text-sm">
              <Trophy className="w-4 h-4 text-indigo-400" />
              <span>Lvl {userLevel} ({xp} XP)</span>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-amber-400 font-semibold text-xs sm:text-sm">
              <Flame className="w-4 h-4 fill-amber-400" />
              <span>{streak}d Streak</span>
            </div>

            {/* Audio Toggle */}
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)} 
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title={audioEnabled ? "Voice Enabled" : "Voice Muted"}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* API Key Input */}
            <input 
              type="password" 
              placeholder="Gemini API Key"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 hidden md:block w-36"
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        
        {/* INPUT MODE */}
        {mode === 'input' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Turn Lecture Notes into <span className="text-indigo-400">Smart Flashcards</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                Paste study material below to generate interactive flashcards, audio-guided study, and timed quizzes.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste lecture text, textbook summaries, or study notes here..."
                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base resize-none"
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <label className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 text-xs sm:text-sm cursor-pointer border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl bg-slate-950 transition w-full sm:w-auto justify-center">
                  <Upload className="w-4 h-4" />
                  <span>Import JSON Deck</span>
                  <input type="file" accept=".json" onChange={importJSON} className="hidden" />
                </label>

                <button
                  onClick={handleGenerate}
                  disabled={loading || !inputText.trim()}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/30"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Deck (+25 XP)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FLASHCARD MODE */}
        {mode === 'cards' && deck && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => setMode('input')} className="text-slate-400 hover:text-white flex items-center text-sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </button>
              <h2 className="font-bold text-slate-200 text-lg truncate max-w-xs">{deck.title}</h2>
              <div className="flex items-center space-x-2">
                <button onClick={exportJSON} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300" title="Export Deck JSON">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={startQuiz} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center space-x-1">
                  <Zap className="w-4 h-4" />
                  <span>Take Quiz</span>
                </button>
              </div>
            </div>

            {/* Review Banner if queue exists */}
            {reviewQueue.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between text-amber-300 text-xs sm:text-sm">
                <span>{reviewQueue.length} card(s) marked for review</span>
                <button 
                  onClick={() => {
                    setDeck({ ...deck, flashcards: reviewQueue });
                    setReviewQueue([]);
                    setCurrentCardIndex(0);
                    setIsFlipped(false);
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg flex items-center space-x-1 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Review Hard Cards</span>
                </button>
              </div>
            )}

            {/* Flipcard UI */}
            <div 
              className="perspective-1000 w-full h-80 cursor-pointer" 
              onClick={() => {
                playSound('flip');
                const textToRead = isFlipped 
                  ? deck.flashcards[currentCardIndex].front 
                  : deck.flashcards[currentCardIndex].back;
                setIsFlipped(!isFlipped);
                speakText(textToRead);
              }}
            >
              <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
                {/* Front Side */}
                <div className="absolute w-full h-full bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between items-center text-center backface-hidden shadow-2xl">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">Question ({currentCardIndex + 1}/{deck.flashcards.length})</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); speakText(deck.flashcards[currentCardIndex].front); }}
                      className="text-slate-400 hover:text-indigo-400 p-1"
                      title="Read Question"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-lg sm:text-2xl font-medium text-slate-100">{deck.flashcards[currentCardIndex].front}</p>
                  <span className="text-xs text-slate-500">Tap to reveal answer</span>
                </div>

                {/* Back Side */}
                <div className="absolute w-full h-full bg-indigo-950 border border-indigo-800 rounded-3xl p-8 flex flex-col justify-between items-center text-center backface-hidden rotate-y-180 shadow-2xl">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">Answer</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); speakText(deck.flashcards[currentCardIndex].back); }}
                      className="text-indigo-300 hover:text-white p-1"
                      title="Read Answer"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-indigo-100">{deck.flashcards[currentCardIndex].back}</p>
                  <span className="text-xs text-indigo-400">Tap to turn back</span>
                </div>
              </div>
            </div>

            {/* Smart Spaced Repetition Controls */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleDifficulty('hard')}
                className="flex items-center justify-center space-x-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300 font-semibold py-3 rounded-xl transition"
              >
                <ThumbsDown className="w-4 h-4 text-red-400" />
                <span>Need Review (Hard)</span>
              </button>

              <button
                onClick={() => handleDifficulty('easy')}
                className="flex items-center justify-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 font-semibold py-3 rounded-xl transition"
              >
                <ThumbsUp className="w-4 h-4 text-emerald-400" />
                <span>Got It (+10 XP)</span>
              </button>
            </div>

            {/* Standard Nav */}
            <div className="flex items-center justify-between pt-2">
              <button
                disabled={currentCardIndex === 0}
                onClick={() => { setCurrentCardIndex(prev => prev - 1); setIsFlipped(false); }}
                className="p-3 bg-slate-900 border border-slate-800 rounded-xl disabled:opacity-30 hover:bg-slate-800"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-sm font-medium text-slate-400">
                Card {currentCardIndex + 1} of {deck.flashcards.length}
              </span>

              <button
                disabled={currentCardIndex === deck.flashcards.length - 1}
                onClick={() => { setCurrentCardIndex(prev => prev + 1); setIsFlipped(false); }}
                className="p-3 bg-slate-900 border border-slate-800 rounded-xl disabled:opacity-30 hover:bg-slate-800"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* QUIZ MODE */}
        {mode === 'quiz' && deck && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button onClick={() => setMode('cards')} className="text-slate-400 hover:text-white flex items-center text-sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> Exit Quiz
              </button>

              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase font-semibold">Time Remaining</span>
                <div className={`text-xl font-bold font-mono ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-indigo-400'}`}>
                  {timeLeft}s
                </div>
              </div>
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {deck.quiz.map((q, qIdx) => (
                <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-200">{qIdx + 1}. {q.question}</p>
                    <button 
                      onClick={() => speakText(q.question)}
                      className="text-slate-400 hover:text-indigo-400 p-1"
                      title="Read Question"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((option, optIdx) => {
                      const isSelected = quizAnswers[q.id] === option;
                      const isCorrect = option === q.correctAnswer;
                      
                      let btnStyle = "border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800";
                      
                      if (quizSubmitted) {
                        if (isCorrect) btnStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold";
                        else if (isSelected && !isCorrect) btnStyle = "border-red-500/50 bg-red-500/10 text-red-300";
                      } else if (isSelected) {
                        btnStyle = "border-indigo-500 bg-indigo-600/20 text-indigo-200 font-semibold";
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: option }))}
                          className={`p-3 text-left rounded-xl border text-sm transition flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {quizSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          {quizSubmitted && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {!quizSubmitted ? (
              <button
                onClick={handleQuizSubmit}
                disabled={Object.keys(quizAnswers).length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-600/20"
              >
                Submit Quiz
              </button>
            ) : (
              <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-6 text-center space-y-4">
                <Award className="w-12 h-12 text-indigo-400 mx-auto" />
                <h3 className="text-2xl font-bold text-white">Quiz Completed!</h3>
                <p className="text-indigo-200">
                  You scored{' '}
                  <span className="font-bold text-white">
                    {deck.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length}
                  </span>{' '}
                  out of <span className="font-bold text-white">{deck.quiz.length}</span> correct!
                </p>
                <button
                  onClick={() => setMode('cards')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2 rounded-xl text-sm"
                >
                  Review Flashcards
                </button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
