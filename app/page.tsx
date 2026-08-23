"use client";
import { useEffect, useState } from "react";

type PlayerStat = {
  name: string;
  total: number;
  win: number;
  draw: number;
  loss: number;
  winRate: string;
};

export default function Home() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentView, setCurrentView] = useState<"home" | "leaderboard" | "admin">("home");

  const [selectedMonthYear, setSelectedMonthYear] = useState("all");
  const [availablePeriods, setAvailablePeriods] = useState<{value: string, label: string}[]>([]);

  const [searchQuery, setSearchQuery] = useState("");

  const [sortConfig, setSortConfig] = useState<{ key: keyof PlayerStat; direction: "asc" | "desc" }>({
    key: "winRate",
    direction: "desc",
  });

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [formName, setFormName] = useState("");
  const [formResult, setFormResult] = useState("win");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const SHEETDB_URL = "https://sheetdb.io/api/v1/jltp7ipqyzfv9?sheet=Matches";
  const ADMIN_PIN = "102030";

  const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  const fetchData = () => {
    setLoading(true);
    fetch(SHEETDB_URL)
      .then((res) => res.json())
      .then((data) => {
        setRawData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching data: ", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (rawData.length === 0) return;
    const periods = new Set<string>();
    rawData.forEach(match => {
      if (match.Date) {
        periods.add(match.Date.substring(0, 7));
      }
    });

    const periodArray = Array.from(periods).sort().reverse().map(period => {
      const [year, month] = period.split("-");
      const monthName = thaiMonths[parseInt(month) - 1];
      return { value: period, label: `${monthName} ${year}` };
    });

    setAvailablePeriods(periodArray);
  }, [rawData]);

  useEffect(() => {
    if (rawData.length === 0) return;
    const playerStats: Record<string, any> = {};

    rawData.forEach((match: any) => {
      const name = match.Name;
      const result = match.Result?.toLowerCase();
      const date = match.Date;

      if (!name) return;
      if (selectedMonthYear !== "all") {
        if (!date) return;
        if (date.substring(0, 7) !== selectedMonthYear) return; 
      }

      if (!playerStats[name]) {
        playerStats[name] = { name, total: 0, win: 0, draw: 0, loss: 0 };
      }
      playerStats[name].total += 1;
      if (result === "win") playerStats[name].win += 1;
      else if (result === "draw") playerStats[name].draw += 1;
      else if (result === "loss") playerStats[name].loss += 1;
    });

    const statsArray = Object.values(playerStats).map((player: any) => ({
      ...player,
      winRate: ((player.win / player.total) * 100).toFixed(2),
    }));

    statsArray.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (sortConfig.key === "winRate") {
        aValue = parseFloat(aValue as string);
        bValue = parseFloat(bValue as string);
      }
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    setStats(statsArray);
  }, [rawData, selectedMonthYear, sortConfig]);

  useEffect(() => {
    if (rawData.length === 0) return;
    const dates = rawData.map(m => m.Date).filter(Boolean).sort();
    if (dates.length === 0) return;
    
    const latestDateStr = dates[dates.length - 1];
    const latestDate = new Date(latestDateStr);
    const sevenDaysAgo = new Date(latestDate);
    sevenDaysAgo.setDate(latestDate.getDate() - 7);

    const weeklyPlayerStats: Record<string, any> = {};

    rawData.forEach((match: any) => {
      if (!match.Name || !match.Date) return;
      const matchDate = new Date(match.Date);

      if (matchDate >= sevenDaysAgo && matchDate <= latestDate) {
        const name = match.Name;
        const result = match.Result?.toLowerCase();

        if (!weeklyPlayerStats[name]) {
          weeklyPlayerStats[name] = { name, total: 0, win: 0, draw: 0, loss: 0 };
        }
        weeklyPlayerStats[name].total += 1;
        if (result === "win") weeklyPlayerStats[name].win += 1;
        else if (result === "draw") weeklyPlayerStats[name].draw += 1;
        else if (result === "loss") weeklyPlayerStats[name].loss += 1;
      }
    });

    const weeklyArray = Object.values(weeklyPlayerStats).map((player: any) => ({
      ...player,
      winRate: player.total > 0 ? ((player.win / player.total) * 100).toFixed(2) : "0.00",
    }));

    weeklyArray.sort((a, b) => {
      if (b.win !== a.win) {
        return b.win - a.win;
      }
      return parseFloat(b.winRate) - parseFloat(a.winRate);
    });

    setWeeklyStats(weeklyArray);
  }, [rawData]);

  const handleSort = (key: keyof PlayerStat) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const uniqueNames = Array.from(new Set(rawData.map((item) => item.Name).filter(Boolean)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formDate) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    setIsSubmitting(true);

    const nextId = rawData.length > 0 ? rawData.length + 1 : 1;

    try {
      const response = await fetch(SHEETDB_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [{ Match_ID: nextId, Name: formName, Result: formResult, Date: formDate }],
        }),
      });

      if (response.ok) {
        alert("บันทึกผลการแข่งขันสำเร็จ!");
        setFormName("");
        fetchData(); 
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error) {
      console.error(error);
      alert("เชื่อมต่อฐานข้อมูลไม่ได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMenuClick = (view: "home" | "leaderboard" | "admin") => {
    if (view === "admin" && !isAdmin) {
      const pin = prompt("กรุณาใส่รหัส PIN เพื่อเข้าสู่การจัดการแข่งขัน");
      if (pin === ADMIN_PIN) {
        setIsAdmin(true);
        setCurrentView("admin");
        setSelectedPlayer(null);
      } else if (pin !== null) {
        alert("รหัส PIN ไม่ถูกต้อง");
      }
    } else {
      setCurrentView(view);
      setSelectedPlayer(null);
    }
  };

  const filteredStats = stats.filter(player => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const playerMatches = selectedPlayer 
    ? rawData.filter(m => m.Name === selectedPlayer).slice().reverse() 
    : [];

  const playerOverall = selectedPlayer 
    ? stats.find(s => s.name === selectedPlayer) 
    : null;

  const getMonthlyStatsForPlayer = () => {
    if (!selectedPlayer) return [];
    const monthlyMap: Record<string, { total: number; win: number; draw: number; loss: number }> = {};

    rawData.forEach(m => {
      if (m.Name === selectedPlayer && m.Date) {
        const period = m.Date.substring(0, 7);
        if (!monthlyMap[period]) {
          monthlyMap[period] = { total: 0, win: 0, draw: 0, loss: 0 };
        }
        monthlyMap[period].total += 1;
        
        const res = m.Result?.toLowerCase();
        if (res === "win") monthlyMap[period].win += 1;
        else if (res === "draw") monthlyMap[period].draw += 1;
        else if (res === "loss") monthlyMap[period].loss += 1;
      }
    });

    return Object.keys(monthlyMap).sort().map(period => {
      const [year, month] = period.split("-");
      const monthName = thaiMonths[parseInt(month) - 1];
      const data = monthlyMap[period];
      const rate = data.total > 0 ? ((data.win / data.total) * 100).toFixed(1) : "0";
      return {
        label: `${monthName} ${year}`,
        rate: parseFloat(rate),
        total: data.total,
        win: data.win,
        draw: data.draw,
        loss: data.loss
      };
    });
  };

  const playerMonthlyStats = getMonthlyStatsForPlayer();

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 md:p-8 font-sans">
      {/* --- แถบเมนูด้านบน --- */}
      <div className="flex flex-col gap-4 mb-6 pb-4 border-b border-orange-200">
        <div className="flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-black text-orange-500 tracking-tight">🏆 LEAGUE PORTAL</h1>
          {isAdmin && currentView === "admin" && (
            <button 
              onClick={() => { setIsAdmin(false); setCurrentView("home"); }} 
              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold py-1.5 px-3 rounded"
            >
              ออกจากโหมดจัดการ
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 bg-orange-100 p-1 rounded-lg">
          <button
            onClick={() => handleMenuClick("home")}
            className={`py-2 px-1 text-xs md:text-sm rounded-md font-bold text-center transition-all truncate ${
              currentView === "home" && !selectedPlayer ? "bg-orange-600 text-white shadow" : "text-orange-900 hover:text-orange-600"
            }`}
          >
            ดาวเด่น
          </button>
          <button
            onClick={() => handleMenuClick("leaderboard")}
            className={`py-2 px-1 text-xs md:text-sm rounded-md font-bold text-center transition-all truncate ${
              currentView === "leaderboard" && !selectedPlayer ? "bg-orange-600 text-white shadow" : "text-orange-900 hover:text-orange-600"
            }`}
          >
            ตารางรวม
          </button>
          <button
            onClick={() => handleMenuClick("admin")}
            className={`py-2 px-1 text-xs md:text-sm rounded-md font-bold text-center transition-all truncate ${
              currentView === "admin" && !selectedPlayer ? "bg-orange-600 text-white shadow" : "text-orange-900 hover:text-orange-600"
            }`}
          >
            ⚙️ จัดการผล
          </button>
        </div>
      </div>

      {/* --- โปรไฟล์รายบุคคล --- */}
      {selectedPlayer ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg md:text-2xl font-black text-gray-900 truncate pr-2">🔥 {selectedPlayer}</h2>
            <button 
              onClick={() => setSelectedPlayer(null)} 
              className="text-xs md:text-sm bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3 rounded transition-colors shrink-0"
            >
              ← กลับ
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <div className="bg-white p-3 rounded-lg shadow border border-orange-200 text-center">
              <p className="text-gray-600 text-[10px] md:text-xs uppercase font-bold">แข่งรวม</p>
              <p className="text-xl md:text-2xl font-black text-gray-900">{playerOverall?.total || 0}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg shadow border border-green-300 text-center">
              <p className="text-green-700 text-[10px] md:text-xs uppercase font-bold">ชนะ</p>
              <p className="text-xl md:text-2xl font-black text-green-800">{playerOverall?.win || 0}</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg shadow border border-amber-300 text-center">
              <p className="text-amber-700 text-[10px] md:text-xs uppercase font-bold">เสมอ</p>
              <p className="text-xl md:text-2xl font-black text-amber-800">{playerOverall?.draw || 0}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg shadow border border-red-300 text-center">
              <p className="text-red-700 text-[10px] md:text-xs uppercase font-bold">แพ้</p>
              <p className="text-xl md:text-2xl font-black text-red-800">{playerOverall?.loss || 0}</p>
            </div>
            <div className="col-span-2 md:col-span-1 bg-orange-50 p-3 rounded-lg shadow border border-orange-300 text-center">
              <p className="text-orange-700 text-[10px] md:text-xs uppercase font-bold">Win Rate</p>
              <p className="text-xl md:text-2xl font-black text-orange-800">{playerOverall?.winRate || "0.00"}%</p>
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-orange-200">
            <h3 className="text-sm md:text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>📈</span> สถิติรายเดือน
            </h3>
            <div className="space-y-4">
              {playerMonthlyStats.map((item, idx) => (
                <div key={idx} className="bg-orange-50/70 p-3 rounded-lg border border-orange-200">
                  <div className="flex flex-col md:flex-row justify-between text-xs md:text-sm mb-2 gap-1">
                    <span className="font-bold text-gray-900">{item.label}</span>
                    <div className="flex flex-wrap items-center gap-2 font-bold text-xs">
                      <span className="text-green-700">ชนะ: {item.win}</span>
                      <span className="text-amber-700">เสมอ: {item.draw}</span>
                      <span className="text-red-700">แพ้: {item.loss}</span>
                      <span className="bg-orange-200 text-orange-900 px-2 py-0.5 rounded font-black">
                        {item.rate}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-600 to-amber-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${item.rate}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-orange-200 overflow-hidden">
            <h3 className="bg-orange-100 px-4 py-3 font-extrabold text-orange-950 text-xs md:text-sm">ประวัติการแข่งขันรายแมตช์</h3>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="bg-gray-100 text-gray-900 border-b font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">วันที่</th>
                    <th className="px-4 py-2.5 text-center">ผลการแข่งขัน</th>
                  </tr>
                </thead>
                <tbody>
                  {playerMatches.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-orange-50/50">
                      <td className="px-4 py-3 text-gray-800 font-medium">{m.Date}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold ${
                          m.Result?.toLowerCase() === 'win' ? 'bg-green-200 text-green-900' :
                          m.Result?.toLowerCase() === 'draw' ? 'bg-amber-200 text-amber-900' :
                          'bg-red-200 text-red-900'
                        }`}>
                          {m.Result?.toUpperCase() === 'WIN' ? 'ชนะ' : m.Result?.toLowerCase() === 'draw' ? 'เสมอ' : 'แพ้'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : currentView === "admin" && isAdmin ? (
        /* --- หน้าจัดการแข่งขัน --- */
        <div className="bg-orange-100 border border-orange-300 p-4 md:p-6 rounded-lg shadow-sm space-y-4">
          <h2 className="text-base md:text-xl font-extrabold text-orange-950">⚙️ เพิ่มผลการแข่งขันใหม่</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs md:text-sm font-bold text-gray-800 mb-1">ชื่อผู้เล่น</label>
              <input type="text" list="players" required className="w-full border border-orange-400 rounded px-3 py-2 bg-white font-medium text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600" placeholder="เลือกหรือพิมพ์ชื่อใหม่..." value={formName} onChange={(e) => setFormName(e.target.value)} />
              <datalist id="players">
                {uniqueNames.map((name, i) => <option key={i} value={name as string} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold text-gray-800 mb-1">ผลการแข่ง</label>
              <select className="w-full border border-orange-400 rounded px-3 py-2 bg-white font-medium text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600" value={formResult} onChange={(e) => setFormResult(e.target.value)}>
                <option value="win">ชนะ</option>
                <option value="draw">เสมอ</option>
                <option value="loss">แพ้</option>
              </select>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold text-gray-800 mb-1">วันที่แข่ง</label>
              <input type="date" required className="w-full border border-orange-400 rounded px-3 py-2 bg-white font-medium text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded transition-colors disabled:bg-orange-300 text-sm mt-2">
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกผล"}
            </button>
          </form>
        </div>
      ) : currentView === "home" ? (
        /* --- หน้าแรก: ดาวเด่นประจำสัปดาห์ --- */
        <div className="space-y-4">
          <div className="text-center py-5 bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl text-white shadow-lg p-4">
            <h2 className="text-xl md:text-3xl font-black mb-1">🔥 ดาวเด่นประจำสัปดาห์</h2>
            <p className="text-orange-100 font-medium text-xs md:text-sm">5 อันดับผู้เล่นที่คว้าชัยชนะมากที่สุดในช่วง 7 วันล่าสุด</p>
          </div>

          {loading ? (
            <p className="text-center text-gray-600 font-bold py-10">กำลังโหลดข้อมูลดาวเด่น...</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {weeklyStats.slice(0, 5).map((player, index) => (
                <div 
                  key={index}
                  onClick={() => setSelectedPlayer(player.name)}
                  className="bg-white rounded-xl shadow border-2 border-orange-200 p-4 flex items-center justify-between cursor-pointer hover:border-orange-500 hover:shadow-md transition-all relative overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                      index === 0 ? 'bg-yellow-400 text-yellow-950' :
                      index === 1 ? 'bg-gray-300 text-gray-800' :
                      index === 2 ? 'bg-amber-600 text-white' : 'bg-orange-100 text-orange-800'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-sm md:text-base">{player.name}</h3>
                      <span className="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-black text-[11px] mt-0.5">
                        ชนะ {player.win} นัด
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 text-center text-xs font-bold">
                    <div className="bg-orange-50 px-2.5 py-1 rounded border border-orange-100">
                      <span className="text-[10px] text-gray-500 block">ชนะ</span>
                      <span className="text-green-700">{player.win}</span>
                    </div>
                    <div className="bg-orange-50 px-2.5 py-1 rounded border border-orange-100">
                      <span className="text-[10px] text-gray-500 block">เสมอ</span>
                      <span className="text-amber-700">{player.draw}</span>
                    </div>
                    <div className="bg-orange-50 px-2.5 py-1 rounded border border-orange-100">
                      <span className="text-[10px] text-gray-500 block">แพ้</span>
                      <span className="text-red-700">{player.loss}</span>
                    </div>
                  </div>
                </div>
              ))}
              {weeklyStats.length === 0 && (
                <div className="text-center py-10 bg-white rounded-xl shadow border border-orange-200">
                  <p className="text-gray-600 font-bold text-sm">ยังไม่มีข้อมูลการแข่งขันในสัปดาห์นี้</p>
                </div>
              )}
            </div>
          )}

          <div className="text-center pt-2">
            <button 
              onClick={() => setCurrentView("leaderboard")}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-xl shadow transition-colors text-sm"
            >
              ดูตารางคะแนนรวมทั้งหมด →
            </button>
          </div>
        </div>
      ) : (
        /* --- หน้าตารางคะแนนรวม (เปลี่ยนสีหัวข้อและคำว่าช่วงเวลาให้เป็นสีสว่าง) --- */
        <>
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg md:text-2xl font-black text-orange-400">🏆 ตารางคะแนนรวม</h2>
              <div className="flex items-center">
                <label className="mr-2 text-orange-200 font-bold text-xs md:text-sm">ช่วงเวลา:</label>
                <select 
                  className="border border-orange-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-600 shadow-sm text-xs md:text-sm"
                  value={selectedMonthYear} 
                  onChange={(e) => setSelectedMonthYear(e.target.value)}
                >
                  <option value="all">รวมทั้งหมด (All Time)</option>
                  {availablePeriods.map(period => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full">
              <input 
                type="text"
                placeholder="🔍 ค้นหาชื่อผู้เล่น..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-orange-300 rounded-lg px-4 py-2 bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 shadow-sm"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-center text-gray-600 font-bold py-10">กำลังดึงข้อมูลการแข่งขัน...</p>
          ) : (
            <div className="overflow-x-auto shadow-lg sm:rounded-lg border border-orange-200 bg-white">
              <table className="w-full text-xs md:text-sm text-left text-gray-700 whitespace-nowrap">
                <thead className="text-[11px] md:text-xs text-gray-900 uppercase bg-orange-200 font-black">
                  <tr>
                    <th className="px-3 md:px-6 py-3">อันดับ</th>
                    <th className="px-3 md:px-6 py-3 cursor-pointer hover:bg-orange-300" onClick={() => handleSort("name")}>
                      รายชื่อผู้เล่น {sortConfig.key === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center cursor-pointer hover:bg-orange-300" onClick={() => handleSort("total")}>
                      แข่งรวม {sortConfig.key === "total" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center text-green-800 cursor-pointer hover:bg-orange-300" onClick={() => handleSort("win")}>
                      ชนะ {sortConfig.key === "win" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center text-amber-800 cursor-pointer hover:bg-orange-300" onClick={() => handleSort("draw")}>
                      เสมอ {sortConfig.key === "draw" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center text-red-800 cursor-pointer hover:bg-orange-300" onClick={() => handleSort("loss")}>
                      แพ้ {sortConfig.key === "loss" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 md:px-6 py-3 text-center font-black cursor-pointer hover:bg-orange-300" onClick={() => handleSort("winRate")}>
                      Win Rate {sortConfig.key === "winRate" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((player, index) => (
                    <tr 
                      key={index} 
                      onClick={() => setSelectedPlayer(player.name)}
                      className="bg-white border-b hover:bg-orange-50 transition-colors cursor-pointer font-medium"
                      title="คลิกเพื่อดูสถิติรายบุคคล"
                    >
                      <td className="px-3 md:px-6 py-3 font-extrabold text-gray-900">{index + 1}</td>
                      <td className="px-3 md:px-6 py-3 font-bold text-orange-700 underline">{player.name}</td>
                      <td className="px-3 md:px-6 py-3 text-center text-gray-900 font-bold">{player.total}</td>
                      <td className="px-3 md:px-6 py-3 text-center font-bold text-green-700">{player.win}</td>
                      <td className="px-3 md:px-6 py-3 text-center font-bold text-amber-700">{player.draw}</td>
                      <td className="px-3 md:px-6 py-3 text-center font-bold text-red-700">{player.loss}</td>
                      <td className="px-3 md:px-6 py-3 text-center font-black text-orange-600 text-sm md:text-base">
                        {player.winRate}%
                      </td>
                    </tr>
                  ))}
                  {filteredStats.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500 font-bold">
                        ไม่พบรายชื่อผู้เล่นที่ค้นหา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}