"use client";

import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Coffee, Pencil, Users } from "lucide-react";
import { supabase } from "./lib/supabase";

export default function Home() {
  // === 狀態管理 ===
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 正式版 25 分鐘
  const [isRunning, setIsRunning] = useState(false);
  
  // 個人資料與排行榜
  const [userId, setUserId] = useState<string>("");
  const [myNickname, setMyNickname] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  // 大廳連線狀態
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 改名專用的狀態
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  // === 1. 初始化使用者 ===
  useEffect(() => {
    const initUser = async () => {
      let currentId = localStorage.getItem("zenstudy_user_id");
      let currentNickname = "";
      
      if (!currentId) {
        // 新手報到
        currentId = crypto.randomUUID();
        currentNickname = "學霸_" + currentId.substring(0, 4);
        localStorage.setItem("zenstudy_user_id", currentId);
        await supabase.from("study_profiles").insert([{ 
          id: currentId, 
          nickname: currentNickname, 
          tomatoes: 0 
        }]);
      } else {
        // 老朋友，去資料庫查他現在叫什麼名字
        const { data } = await supabase.from("study_profiles").select("nickname").eq("id", currentId).single();
        if (data) currentNickname = data.nickname;
      }
      
      setUserId(currentId);
      setMyNickname(currentNickname);
      fetchLeaderboard();
    };
    initUser();
  }, []);

  // === 2. 建立即時大廳 (Supabase Presence) ===
  useEffect(() => {
    if (!userId || !myNickname) return; // 確定有名字才加入大廳

    // 建立一個名為 zenstudy_lobby 的廣播頻道
    const channel = supabase.channel('zenstudy_lobby', {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        // 當有人加入或離開時，更新線上名單
        const state = channel.presenceState();
        const users = Object.values(state).map((presence: any) => presence[0]);
        setOnlineUsers(users);
        setIsConnected(true);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 成功連線後，舉手告訴大家「我來了，這是我的名字」
          await channel.track({
            id: userId,
            nickname: myNickname,
          });
        }
      });

    // 關閉網頁時自動斷開連線
    return () => { channel.unsubscribe(); };
  }, [userId, myNickname]); // 依賴項加上 myNickname，這樣你改名時大廳也會跟著變！

  // === 3. 抓取真實排行榜 ===
  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from("study_profiles")
      .select("*")
      .order("tomatoes", { ascending: false })
      .limit(10);
    if (data) setLeaderboard(data);
  };

  // === 4. 計時器核心與「發放番茄」 ===
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      finishTomato();
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const finishTomato = async () => {
    alert("🎉 太棒了！完成一次專注，獲得一顆 🍅！");
    const { error } = await supabase.rpc("increment_tomato", { profile_id: userId });
    if (!error) fetchLeaderboard();
    setTimeLeft(25 * 60);
  };

  // === 5. 改名儲存功能 ===
  const handleSaveName = async () => {
    if (!newName.trim()) return;
    if (newName.length > 20) {
      alert("名字太長囉！請保持在 20 個字以內。");
      return;
    }

    const { error } = await supabase
      .from("study_profiles")
      .update({ nickname: newName.trim() })
      .eq("id", userId);

    if (!error) {
      setMyNickname(newName.trim()); // 這裡會自動觸發上方 useEffect，大廳名字秒變！
      setIsEditingName(false);
      fetchLeaderboard();
    } else {
      alert("更新失敗，請稍後再試！");
    }
  };

  // === 6. 按鈕控制與格式化 ===
  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(25 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-12 min-h-screen flex flex-col gap-8 relative">
      
      {/* 頂部標題區 */}
      <header className="flex flex-col gap-4 mt-8 mb-2">
        <div className="flex items-center gap-4 text-slate-400 text-sm font-medium tracking-widest">
        
        </div>
        <h1 className="text-6xl font-bold tracking-tight text-slate-700" style={{ fontFamily: 'serif' }}>
          ZenStudy<span className="text-indigo-400">.</span>
        </h1>
        <p className="text-slate-500 leading-relaxed mt-2 text-lg">
          一道屬於這間教室的線上自習室——<span className="italic font-medium">按下開始，立刻專注</span>。即時同步、誰在線上，大家都看得到。
        </p>
        <div className="flex items-center gap-3 mt-2">
          {isConnected ? (
            <span className="px-4 py-1.5 bg-white/60 backdrop-blur-md rounded-full border border-emerald-200 text-sm text-emerald-600 shadow-sm flex items-center gap-2 font-medium transition-all">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span> 連線中
            </span>
          ) : (
            <span className="px-4 py-1.5 bg-white/60 backdrop-blur-md rounded-full border border-slate-200 text-sm text-slate-500 shadow-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> 連線中...
            </span>
          )}
          <span className="px-4 py-1.5 bg-white/60 backdrop-blur-md rounded-full border border-slate-200 text-sm text-slate-600 shadow-sm">
            大廳 {onlineUsers.length} 人
          </span>
        </div>
      </header>

      {/* 番茄鐘卡片區 */}
      <section className="bg-white/70 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] p-10 md:p-16 flex flex-col items-center justify-center relative overflow-hidden transition-all hover:bg-white/80">
        <div className="text-indigo-500 font-medium mb-6 flex items-center gap-2 px-5 py-2 bg-indigo-50/80 rounded-full border border-indigo-100/50">
          <Coffee size={18} />
          <span>專注模式</span>
        </div>
        
        <div className="text-[7rem] md:text-[9rem] leading-none font-bold text-slate-700 tracking-tighter mb-10 font-mono">
          {formattedTime}
        </div>

        <div className="flex gap-6">
          <button 
            onClick={toggleTimer}
            className={`w-16 h-16 flex items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 ${
              isRunning ? "bg-amber-500 shadow-amber-200 hover:bg-amber-600" : "bg-indigo-500 shadow-indigo-200 hover:bg-indigo-600"
            }`}
          >
            {isRunning ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} className="ml-1" />}
          </button>
          <button 
            onClick={resetTimer}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-white text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 hover:scale-105 transition-all"
          >
            <RotateCcw size={24} />
          </button>
        </div>
      </section>

      {/* ========== 全新：即時大廳 ========== */}
      <div className="flex items-center justify-between mt-4">
        <h2 className="text-2xl font-bold text-slate-700 flex items-center gap-2">
          <Users size={24} className="text-indigo-400" />
          線上夥伴
        </h2>
      </div>
      
      <section className="flex flex-wrap gap-3 mb-4">
        {onlineUsers.length === 0 ? (
          <div className="text-slate-400 text-sm py-4">讀取中...</div>
        ) : (
          onlineUsers.map(user => (
            <div key={user.id} className="px-4 py-2 bg-white/60 backdrop-blur-md border border-white/80 shadow-sm rounded-full flex items-center gap-2 text-sm font-medium text-slate-600 transition-all hover:scale-105 hover:bg-white/90 cursor-default">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {user.nickname}
              {user.id === userId && <span className="ml-1 text-[10px] text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-md font-bold">你</span>}
            </div>
          ))
        )}
      </section>
      {/* ================================== */}

      {/* 排行榜與大廳標題 */}
      <div className="flex items-center justify-between mt-4 border-b border-slate-200/50 pb-4">
        <h2 className="text-2xl font-bold text-slate-700">今日排行榜</h2>
        <span className="text-sm text-slate-500">依番茄數排序</span>
      </div>

      {/* 真實排行榜列表 */}
      <section className="flex flex-col gap-4 pb-12">
        {leaderboard.length === 0 ? (
          <div className="text-center py-10 text-slate-400">目前還沒有人獲得番茄，來當第一個吧！</div>
        ) : (
          leaderboard.map((user, index) => (
            <div key={user.id} className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-[2rem] p-6 flex items-center justify-between transition-all hover:bg-white/90">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-indigo-50 text-indigo-400'}`}>
                  {index + 1}
                </div>
                
                {/* 名字與編輯按鈕 */}
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-700 text-xl">
                    {user.nickname}
                  </h3>
                  {user.id === userId && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setNewName(user.nickname);
                          setIsEditingName(true);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-500 transition-colors"
                        title="修改名字"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-2.5 bg-white rounded-full border border-slate-200 shadow-sm flex items-center gap-2 text-slate-600 font-medium">
                🍅 累積 {user.tomatoes} 顆
              </div>
            </div>
          ))
        )}
      </section>

      {/* ========== 改名彈出視窗 (Modal) ========== */}
      {isEditingName && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm border border-slate-100 transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-700 mb-4">修改專屬暱稱</h3>
            <input 
              type="text" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="輸入新名字..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-6 text-slate-700 font-medium bg-slate-50"
              maxLength={20}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsEditingName(false)}
                className="px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSaveName}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-200 font-medium transition-colors"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}