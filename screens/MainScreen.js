/* --------------------------------------------------------------
   MainScreen.js – Philippines‑only (UTC+8)
   • No toLocaleString(timeZone)
   • No Intl / external libs
   • All dates are calculated with +8h offset
-------------------------------------------------------------- */

import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { BarChart, StackedBarChart } from 'react-native-svg-charts';
import { supabase } from '../lib/supabase';

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;               // +8 h

/* ---------- helpers that work ONLY with PH time ---------- */
const toPHDate = (date = new Date()) => new Date(date.getTime() + PH_OFFSET_MS);
const toPHDateString = (date = new Date()) => {
  const ph = toPHDate(date);
  return `${ph.getUTCFullYear()}-${String(ph.getUTCMonth() + 1).padStart(2, '0')}-${String(ph.getUTCDate()).padStart(2, '0')}`;
};

const isSamePHDay = (d1, d2) => toPHDateString(d1) === toPHDateString(d2);
const isYesterdayPH = (earlier, later) => {
  const y = new Date(later);
  y.setUTCDate(y.getUTCDate() - 1);
  return isSamePHDay(earlier, y);
};

/* ---------- CORRECT PH DATE FORMATTING (NO Intl) ---------- */
const formatPHDate = (date = new Date()) => {
  const ph = toPHDate(date);
  const year = ph.getUTCFullYear();
  const month = ph.getUTCMonth();
  const day = ph.getUTCDate();
  const dayOfWeek = ph.getUTCDay();

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return `${weekdays[dayOfWeek]},\n${months[month]} ${day}, ${year}`;
};

/* ------------------------------------------------------- */
const MainScreen = () => {
  const [tdee, setTdee] = useState(0);
  const [progressValue, setProgressValue] = useState(0);
  const [streak, setStreak] = useState(0);
  const [markedDates, setMarkedDates] = useState({});
  const [loginDates, setLoginDates] = useState([]);   // ["2025-11-01", …]
  const [lastSignInUTC, setLastSignInUTC] = useState(null); // UTC Date from DB
  const [canSignIn, setCanSignIn] = useState(true);

  const userIdRef = useRef(null);
  const midnightTimerRef = useRef(null);
  const dailyIntervalRef = useRef(null);

  /* ---------- midnight reset (PH midnight) ---------- */
  const scheduleMidnightReset = () => {
    const now = new Date();
    const phNow = toPHDate(now);
    const phTomorrow = new Date(phNow);
    phTomorrow.setUTCHours(0, 0, 0, 0);
    phTomorrow.setUTCDate(phTomorrow.getUTCDate() + 1);

    const msUntilPHMidnight = phTomorrow.getTime() - now.getTime();

    if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    if (dailyIntervalRef.current) clearInterval(dailyIntervalRef.current);

    midnightTimerRef.current = setTimeout(async () => {
      if (userIdRef.current) {
        await resetProgress(userIdRef.current);
        await refreshSignInStatus();
      }
      scheduleMidnightReset();
    }, msUntilPHMidnight);

    // fallback every 24 h
    dailyIntervalRef.current = setInterval(async () => {
      if (userIdRef.current) {
        await resetProgress(userIdRef.current);
        await refreshSignInStatus();
      }
    }, 24 * 60 * 60 * 1000);
  };

  const resetProgress = async (userId) => {
    try {
      await supabase.from('weighApp').update({ progress: 0 }).eq('id', userId);
      setProgressValue(0);
    } catch (e) {
      console.error('reset error:', e);
    }
  };

  const refreshSignInStatus = async () => {
    if (!userIdRef.current) return;
    const { data } = await supabase
      .from('weighApp')
      .select('last_sign_in')
      .eq('id', userIdRef.current)
      .single();

    const lastUTC = data?.last_sign_in ? new Date(data.last_sign_in) : null;
    const todayPH = toPHDateString();
    const can = !lastUTC || toPHDateString(lastUTC) !== todayPH;
    setCanSignIn(can);
    setLastSignInUTC(lastUTC);
  };

  /* ---------- initial load + realtime ---------- */
  useEffect(() => {
    let subscription = null;

    const fetchUserData = async () => {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr || !auth?.user?.id) return;

        const userId = auth.user.id;
        userIdRef.current = userId;

        const { data, error } = await supabase
          .from('weighApp')
          .select('tdee, progress, last_sign_in, streak, login_dates')
          .eq('id', userId)
          .single();

        if (error) throw error;

        setTdee(Math.round(data?.tdee || 0));

        const todayPH = toPHDateString();
        const lastSignInPH = data?.last_sign_in ? toPHDateString(new Date(data.last_sign_in)) : null;

        // reset progress if we crossed a PH day
        let prog = data?.progress || 0;
        if (lastSignInPH && lastSignInPH !== todayPH) {
          await resetProgress(userId);
          prog = 0;
        } else {
          setProgressValue(prog);
        }

        setStreak(data?.streak || 0);
        const dates = Array.isArray(data?.login_dates) ? data.login_dates : [];
        setLoginDates(dates);
        const marked = {};
        dates.forEach(d => (marked[d] = { marked: true, dotColor: '#FFBA00' }));
        setMarkedDates(marked);

        const can = !lastSignInPH || lastSignInPH !== todayPH;
        setCanSignIn(can);
        setLastSignInUTC(data?.last_sign_in ? new Date(data.last_sign_in) : null);

        scheduleMidnightReset();

        // realtime
        subscription = supabase
          .channel(`weighApp-${userId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'weighApp', filter: `id=eq.${userId}` },
            (payload) => {
              const u = payload.new;
              setTdee(Math.round(u.tdee || 0));
              setProgressValue(u.progress || 0);
              setStreak(u.streak || 0);

              if (Array.isArray(u.login_dates)) {
                setLoginDates(u.login_dates);
                const m = {};
                u.login_dates.forEach(d => (m[d] = { marked: true, dotColor: '#FFBA00' }));
                setMarkedDates(m);
              }

              const last = u.last_sign_in ? new Date(u.last_sign_in) : null;
              const todayPH = toPHDateString();
              setCanSignIn(!last || toPHDateString(last) !== todayPH);
              setLastSignInUTC(last);
            }
          )
          .subscribe();
      } catch (e) {
        console.error('fetch error:', e);
      }
    };

    fetchUserData();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
      if (dailyIntervalRef.current) clearInterval(dailyIntervalRef.current);
    };
  }, []);

  /* ---------- SIGN‑IN ---------- */
  const signInToday = async () => {
    if (!canSignIn || !userIdRef.current) return;

    try {
      const todayPH = toPHDateString();                 // "2025-11-03"
      const { data, error } = await supabase
        .from('weighApp')
        .select('streak, last_sign_in, login_dates')
        .eq('id', userIdRef.current)
        .single();

      if (error) throw error;

      const lastUTC = data?.last_sign_in ? new Date(data.last_sign_in) : null;
      const lastPH = lastUTC ? toPHDateString(lastUTC) : null;

      if (lastPH === todayPH) return;                  // already signed today

      let newStreak = 1;
      if (lastUTC && isYesterdayPH(lastUTC, new Date())) {
        newStreak = (data?.streak || 0) + 1;
      }

      const cur = Array.isArray(data?.login_dates) ? data.login_dates : [];
      const newDates = [...new Set([...cur, todayPH])];

      await supabase
        .from('weighApp')
        .update({
          last_sign_in: new Date().toISOString(),   // UTC
          streak: newStreak,
          login_dates: newDates,
        })
        .eq('id', userIdRef.current);

      setCanSignIn(false);
    } catch (e) {
      console.error('sign‑in error:', e);
    }
  };

  /* ---------- CHARTS ---------- */
  const progressPct = tdee > 0 ? (progressValue / tdee) * 100 : 0;
  const chartData = [progressPct];

  const capped = Math.min(progressValue, tdee);
  const protein = Math.round(capped * 0.2);
  const fats = Math.round(capped * 0.3);
  const carbs = Math.round(capped * 0.5);
  const macroData = [{ protein, fats, carbs }];
  const keys = ['protein', 'fats', 'carbs'];
  const colors = ['#599f00', '#83cc2b', '#c1ff73'];

  // CORRECT: Use formatPHDate() → always shows PH time
  const formattedDate = formatPHDate();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>WEIGHAPP</Text>

      {/* Progress */}
      <View style={styles.chartContainer}>
        <Text style={styles.progressText}>Progress: {progressValue}</Text>
        <BarChart
          style={styles.barChart}
          data={chartData}
          svg={{ fill: '#83cc25' }}
          contentInset={{ top: 10, bottom: 10 }}
          gridMin={0}
          gridMax={100}
          yMin={0}
          yMax={100}
          horizontal
          animate
          yAccessor={({ item }) => item}
        />
        <Text style={styles.baseGoalText}>Base Goal: {tdee}</Text>
      </View>

      {/* Macros */}
      <View style={styles.macroContainer}>
        <Text style={styles.macroText}>Macro Nutrient Breakdown</Text>
        <StackedBarChart
          style={styles.barChart}
          keys={keys}
          colors={colors}
          data={macroData}
          contentInset={{ top: 10, bottom: 10 }}
          horizontal
          animate
        />
        <View style={styles.macroLabels}>
          <Text style={styles.macroLabel}>
            <Text style={{ fontWeight: 'bold' }}>Protein</Text>:{' '}
            <Text style={{ color: '#599f00' }}>{protein} cal</Text>
          </Text>
          <Text style={styles.macroLabel}>
            <Text style={{ fontWeight: 'bold' }}>Fats</Text>:{' '}
            <Text style={{ color: '#83cc2b' }}>{fats} cal</Text>
          </Text>
          <Text style={styles.macroLabel}>
            <Text style={{ fontWeight: 'bold' }}>Carbs</Text>:{' '}
            <Text style={{ color: '#c1ff73' }}>{carbs} cal</Text>
          </Text>
        </View>
      </View>

      {/* Streak + Sign‑in */}
      <View style={styles.bottomContainer}>
        <View style={styles.streakContainer}>
          <Text style={styles.streakText}>Current Streak:</Text>
          <Text style={styles.streakCount}>{streak}</Text>
        </View>

        <View style={styles.signInContainer}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <Button
            title="Sign in today"
            onPress={signInToday}
            disabled={!canSignIn}
            color={canSignIn ? '#83cc25' : '#D3D3D3'}
          />
        </View>
      </View>
    </View>
  );
};

export default MainScreen;

/* ------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', backgroundColor: '#211e1e' },
  header: {
    margin: 15,
    textAlign: 'center',
    padding: '2.5%',
    borderRadius: 50,
    height: '7%',
    width: '99%',
    backgroundColor: '#3f3a3a',
    fontSize: 24,
    color: '#96e235',
    fontWeight: 'bold',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartContainer: {
    borderRadius: 30,
    height: '30%',
    width: '97%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '2%',
    backgroundColor: '#3f3a3a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  macroContainer: {
    borderRadius: 30,
    paddingHorizontal: '2%',
    height: '30%',
    width: '97%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3f3a3a',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bottomContainer: {
    flexDirection: 'row',
    width: '97%',
    marginTop: 20,
    justifyContent: 'space-between',
  },
  streakContainer: {
    borderRadius: 30,
    width: '48%',
    height: '57%',
    backgroundColor: '#3f3a3a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  signInContainer: {
    borderRadius: 30,
    width: '48%',
    height: '57%',
    backgroundColor: '#3f3a3a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  progressText: { fontSize: 18, color: '#FFF', marginBottom: 10, fontWeight: '600' },
  macroText: { fontSize: 18, color: '#FFF', marginBottom: 10, fontWeight: '600' },
  streakText: { fontSize: 18, color: '#FFF', fontWeight: '600', marginBottom: 10 },
  streakCount: { fontSize: 24, color: '#83cc25', fontWeight: 'bold' },
  dateText: { fontSize: 18, color: '#c1ff73', fontWeight: '600', marginBottom: 10 },
  barChart: {
    height: 40,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3.84,
    elevation: 5,
  },
  baseGoalText: { marginTop: 10, color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  macroLabels: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 },
  macroLabel: { color: '#FFF', fontSize: 16 },
});