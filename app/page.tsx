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
        currentId = crypto.randomUUID();
        currentNickname = "學霸_" + currentId.substring(0, 4);
        localStorage.setItem("zenstudy_user_id", currentId);
        await supabase.from("study_profiles").insert([{ 
          id: currentId, 
          nickname: currentNickname, 
          tomatoes: 0 
        }]);
      } else {
        const { data } = await supabase.from("study_profiles").select("nickname").eq("id", currentId).single();
        if (data) currentNickname = data.nickname;
      }
      
      setUserId(currentId);
      setMyNickname(currentNickname);
    };
    initUser();
  }, []);

  // === 2. 建立即時大廳 與 連動動態排行榜 ===
  useEffect(() => {
    if (!userId || !myNickname) return;

    const channel = supabase.channel('zenstudy_lobby', {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).map((presence: any) => presence[0]);
        setOnlineUsers(users);
        setIsConnected(true);
        
        // 核心修改：當大廳人員有名單變動（有人上線或下線），立刻觸發排行榜刷新
        fetchOnlineLeaderboard(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: userId,
            nickname: myNickname,
          });
        }
      });

    return () => { channel.unsubscribe(); };
  }, [userId, myNickname]);

  // === 3. 抓取「僅限線上夥伴」的真實排行榜 ===
  const fetchOnlineLeaderboard = async (currentOnlineUsers?: any[]) => {
    // 優先使用最新同步到的線上名單，若無則使用目前的狀態值
    const targetUsers = currentOnlineUsers || onlineUsers;
    
    if (targetUsers.length === 0) {
      setLeaderboard([]);
      return;
    }

    // 抽出所有在線人員的 ID
    const onlineIds = targetUsers.map(u => u.id);

    // 只撈出 ID 存在於線上的那些人的資料，並依番茄數排序
    const { data } = await supabase
      .from("study_profiles")
      .select("*")
      .in("id", onlineIds)
      .order("tomatoes", { ascending: false });
    
    if (data) setLeaderboard(data);
  };

  // === 4. 計時器核心 ===
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
    if (!error) fetchOnlineLeaderboard(); // 刷新
    setTimeLeft(25 * 60);
  };

  // === 5. 改名儲存功能 ===
  const handleSaveName = async () => {
    if (!newName.trim()) return;
    if (newName.length > 20) {
      alert("名字太長囉！请保持在 20 個字以內。");
      return;
    }

    const { error } = await supabase
      .from("study_profiles")
      .update({ nickname: newName.trim() })
      .eq("id", userId);

    if (!error) {
      setMyNickname(newName.trim());
      setIsEditingName(false);
      // 這裡不需要手動刷新排行榜，因為 myNickname 變更會觸發 Presence 重新廣播，進而自動觸發 sync 刷新排行榜！
    } else {
      alert("更新失敗，請稍後再試！");
    }
  };

  // === 6. 按鈕控制 ===
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

      {/* 即時大廳 */}
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

      {/* 排行榜區 */}
      <div className="flex items-center justify-between mt-4 border-b border-slate-200/50 pb-4">
        <h2 className="text-2xl font-bold text-slate-700">在線排行榜</h2>
        <span className="text-sm text-slate-500">僅顯示目前在線夥伴</span>
      </div>

      {/* 真實排行榜列表 */}
      <section className="flex flex-col gap-4 pb-12">
        {leaderboard.length === 0 ? (
          <div className="text-center py-10 text-slate-400">大廳目前空空的，或者還沒有人在線獲得番茄喔！</div>
        ) : (
          leaderboard.map((user, index) => (
            <div key={user.id} className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-[2rem] p-6 flex items-center justify-between transition-all hover:bg-white/90">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-indigo-50 text-indigo-400'}`}>
                  {index + 1}
                </div>
                
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

      {/* 改名彈出視窗 */}
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