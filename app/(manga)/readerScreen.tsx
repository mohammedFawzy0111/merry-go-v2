/**
 * readerScreen.tsx
 *
 * Tachiyomi-style reader — rebuilt from scratch.
 *
 * Architecture decisions (all crash-driven):
 *  - Vertical mode   → plain FlatList, ScrollView per-page for native zoom
 *  - Horizontal mode → FlatList + pagingEnabled, tap zones handle page turn
 *                      (NO outer GestureDetector / ZoomableView wrapper)
 *  - Zero Reanimated on nav bars → plain useState visibility, no FadeIn/FadeOut
 *  - Zoom            → ScrollView maximumZoomScale (fully native, never crashes)
 *  - No ZoomableView, no Gesture.Simultaneous wrapping scroll views
 */

import { useFontSize, useReadingMode, useTheme } from '@/contexts/settingProvider';
import { sourceManager } from '@/sources';
import { useDownloadStore } from '@/store/downloadStore';
import { useHistoryStore } from '@/store/historyStore';
import { Chapter } from '@/utils/sourceModel';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image as RNImage,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get('window');
const CONTROLS_TIMEOUT = 3500;
const BLURHASH = 'L6PZfSjE.AyE_3t7t7R**0o#DgR4';

const log  = (...a: any[]) => __DEV__ && console.log('[Reader]', ...a);
const warn = (...a: any[]) => __DEV__ && console.warn('[Reader]', ...a);

// ─── ZoomPage — native scroll-view zoom, one per horizontal page ──────────────

const ZoomPage = React.memo(({ uri }: { uri: string }) => {
  const [ratio, setRatio] = useState(4 / 3);

  useEffect(() => {
    if (!uri) return;
    let alive = true;
    RNImage.getSize(
      uri,
      (w, h) => { if (alive && w > 0 && h > 0) setRatio(h / w); },
      () => {},
    );
    return () => { alive = false; };
  }, [uri]);

  return (
    <ScrollView
      style={{ width: W, height: H }}
      contentContainerStyle={styles.zoomContent}
      maximumZoomScale={4}
      minimumZoomScale={1}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      bouncesZoom
      centerContent
    >
      <Image
        source={{ uri }}
        style={{ width: W, height: W * ratio }}
        contentFit="contain"
        placeholder={BLURHASH}
        transition={120}
        recyclingKey={uri}
      />
    </ScrollView>
  );
});

// ─── WebtoonPage — full-width image, no zoom, for vertical scroll ─────────────

const WebtoonPage = React.memo(({ uri }: { uri: string }) => {
  const [ratio, setRatio] = useState(3 / 2);

  useEffect(() => {
    if (!uri) return;
    let alive = true;
    RNImage.getSize(
      uri,
      (w, h) => { if (alive && w > 0 && h > 0) setRatio(h / w); },
      () => {},
    );
    return () => { alive = false; };
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={{ width: W, height: W * ratio }}
      contentFit="fill"
      placeholder={BLURHASH}
      transition={120}
      recyclingKey={uri}
    />
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReaderScreen() {
  const {
    chapterUrl,
    sourceName,
    mangaUrl,
  } = useLocalSearchParams<{
    chapterUrl: string;
    sourceName: string;
    mangaUrl?: string;
  }>();

  const { colors, isDark } = useTheme();
  const { readingMode }    = useReadingMode();
  const router             = useRouter();
  const insets             = useSafeAreaInsets();

  const source = sourceManager.getSourceByName(sourceName as string)?.source;
  const { getDownloadByChapter, loadDownloads } = useDownloadStore();
  const { addToHistory, updateHistory }         = useHistoryStore();

  // ── state ──────────────────────────────────────────────────────────────────
  const [chapter, setChapter]         = useState<Chapter | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [uiVisible, setUiVisible]     = useState(true);
  const [currentPage, setCurrentPage] = useState(0);   // 0-indexed

  const flatRef        = useRef<FlatList>(null);
  const hideTimer      = useRef<ReturnType<typeof setTimeout>>();
  const saveTimer      = useRef<ReturnType<typeof setTimeout>>();
  const scrubberWidth  = useRef(0);
  const mounted        = useRef(true);

  const isVertical = readingMode === 'vertical';
  const isRTL      = readingMode === 'rtl';
  const totalPages = chapter?.pages.length ?? 0;

  // unmount guard
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(hideTimer.current);
      clearTimeout(saveTimer.current);
    };
  }, []);

  // ── fetch chapter ──────────────────────────────────────────────────────────
  const fetchChapter = useCallback(async (url: string) => {
    if (!mounted.current) return;
    log('fetch', url);
    setLoading(true);
    setError(null);

    try {
      // 1. Check completed local download
      let dl = null;
      try { dl = await getDownloadByChapter(url); } catch {}

      if (dl?.status === 'done' && dl.localPath) {
        try {
          const files = await FileSystem.readDirectoryAsync(dl.localPath);
          const pages = files
            .filter(f => /^page_\d+\.(jpg|jpeg|png|webp)$/i.test(f))
            .sort((a, b) => {
              const n = (s: string) => parseInt(s.match(/\d+/)![0], 10);
              return n(a) - n(b);
            })
            .map(f => `${dl!.localPath}${f}`);

          if (pages.length > 0) {
            if (mounted.current) {
              setChapter(new Chapter({
                manga: dl.mangaUrl, title: dl.chapterTitle,
                number: 0, url: dl.chapterUrl, pages, isDownloaded: true,
              }));
            }
            return;
          }
        } catch (e) { warn('local read error', e); }
      }

      // 2. Network
      if (!source) {
        if (mounted.current) setError('Source plugin not found. Is it installed?');
        return;
      }

      const data = await source.fetchChapterDetails(url);

      if (!data?.pages?.length) {
        if (mounted.current) setError('This chapter has no pages.');
        return;
      }

      if (mounted.current) setChapter(data);
    } catch (e) {
      warn('fetchChapter threw', e);
      if (mounted.current) setError(`Failed to load chapter:\n${String(e)}`);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [source, getDownloadByChapter]);

  // load downloads index once
  useEffect(() => { loadDownloads().catch(() => {}); }, []);

  // re-fetch when URL changes
  useEffect(() => {
    if (!chapterUrl) return;
    setCurrentPage(0);
    setChapter(null);
    fetchChapter(chapterUrl as string);
  }, [chapterUrl]);

  // resume last page
  useEffect(() => {
    if (!chapter) return;
    const resume = chapter.lastReadPage ?? 0;
    if (resume > 0 && resume < chapter.pages.length && !isVertical) {
      setCurrentPage(resume);
      setTimeout(() => {
        try { flatRef.current?.scrollToOffset({ offset: W * resume, animated: false }); }
        catch {}
      }, 80);
    }
  }, [chapter?.url]);

  // ── UI auto-hide ───────────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (mounted.current) setUiVisible(false);
    }, CONTROLS_TIMEOUT);
  }, []);

  const showUI = useCallback(() => {
    if (mounted.current) setUiVisible(true);
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleUI = useCallback(() => {
    if (!mounted.current) return;
    setUiVisible(v => {
      if (!v) resetHideTimer();
      return !v;
    });
  }, [resetHideTimer]);

  useEffect(() => { if (uiVisible) resetHideTimer(); }, [uiVisible]);

  // ── save progress ──────────────────────────────────────────────────────────
  const saveProgress = useCallback((page: number) => {
    if (!chapter) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!mounted.current) return;
      const now  = new Date().toISOString();
      const mUrl = (mangaUrl as string) || chapter.manga;
      const item = {
        mangaUrl: mUrl,
        mangaTitle: chapter.title || 'Unknown',
        chapterUrl: chapter.url,
        chapterNumber: chapter.number,
        source: sourceName as string,
        lastRead: now,
        page,
      };
      try { await addToHistory(item); }
      catch {
        try { await updateHistory(mUrl, chapter.url, chapter.number, now, page); }
        catch {}
      }
    }, 500);
  }, [chapter, mangaUrl, sourceName, addToHistory, updateHistory]);

  // ── page navigation ────────────────────────────────────────────────────────
  const goToPage = useCallback((idx: number) => {
    if (!chapter) return;
    const clamped = Math.max(0, Math.min(chapter.pages.length - 1, idx));
    setCurrentPage(clamped);
    saveProgress(clamped);
    if (!isVertical) {
      try { flatRef.current?.scrollToOffset({ offset: W * clamped, animated: false }); }
      catch {}
    }
  }, [chapter, isVertical, saveProgress]);

  const tapPrev = useCallback(() => goToPage(isRTL ? currentPage + 1 : currentPage - 1), [goToPage, currentPage, isRTL]);
  const tapNext = useCallback(() => goToPage(isRTL ? currentPage - 1 : currentPage + 1), [goToPage, currentPage, isRTL]);

  // ── scroll handlers ────────────────────────────────────────────────────────
  const onHorizontalScrollEnd = useCallback((e: any) => {
    const idx = Math.max(0, Math.round(e.nativeEvent.contentOffset.x / W));
    setCurrentPage(idx);
    saveProgress(idx);
  }, [saveProgress]);

  const onVerticalScroll = useCallback((e: any) => {
    if (!chapter) return;
    const y      = e.nativeEvent.contentOffset.y;
    const maxY   = e.nativeEvent.contentSize.height - H;
    const approx = maxY > 0 ? Math.round((y / maxY) * (chapter.pages.length - 1)) : 0;
    const clamped = Math.max(0, Math.min(chapter.pages.length - 1, approx));
    setCurrentPage(clamped);
    saveProgress(clamped);
  }, [chapter, saveProgress]);

  // ── scrubber ───────────────────────────────────────────────────────────────
  const onScrubLayout = useCallback((e: any) => {
    scrubberWidth.current = e.nativeEvent.layout.width;
  }, []);

  const onScrubPress = useCallback((e: any) => {
    if (!chapter || scrubberWidth.current === 0) return;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / scrubberWidth.current));
    const page  = Math.round(ratio * (chapter.pages.length - 1));
    goToPage(page);
    showUI();
  }, [chapter, goToPage, showUI]);

  // ── renderers ──────────────────────────────────────────────────────────────
  const renderHPage = useCallback(({ item }: { item: string }) =>
    <ZoomPage uri={item} />, []);

  const renderVPage = useCallback(({ item }: { item: string }) =>
    <WebtoonPage uri={item} />, []);

  const keyExtract = useCallback((_: string, i: number) => `pg-${i}`, []);

  const hLayout = useCallback((_: any, i: number) =>
    ({ length: W, offset: W * i, index: i }), []);

  // ── computed ───────────────────────────────────────────────────────────────
  const sliderPct    = totalPages > 1 ? currentPage / (totalPages - 1) : 0;
  const displayPage  = currentPage + 1;

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000' }]}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadText, { color: 'rgba(255,255,255,0.6)' }]}>
          Loading chapter…
        </Text>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR
  // ══════════════════════════════════════════════════════════════════════════
  if (error || !chapter) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={52} color={colors.error} />
          <Text style={[styles.errTitle, { color: colors.text }]}>
            Could not load chapter
          </Text>
          <Text style={[styles.errBody, { color: colors.textSecondary }]}>
            {error ?? 'Unknown error'}
          </Text>
          <TouchableOpacity
            style={[styles.errBtn, { backgroundColor: colors.accent }]}
            onPress={() => fetchChapter(chapterUrl as string)}
          >
            <Text style={styles.errBtnTxt}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.errBtn, { backgroundColor: colors.surface, marginTop: 8 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.errBtnTxt, { color: colors.text }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READER
  // ══════════════════════════════════════════════════════════════════════════
  const pages = chapter.pages;

  return (
    <View style={[styles.fill, { backgroundColor: '#000' }]}>
      <StatusBar hidden={!uiVisible} animated />

      {/* ═══ VERTICAL / WEBTOON ═══════════════════════════════════════════ */}
      {isVertical && (
        <Pressable style={styles.fill} onPress={toggleUI}>
          <FlatList
            ref={flatRef}
            data={pages}
            keyExtractor={keyExtract}
            renderItem={renderVPage}
            showsVerticalScrollIndicator={false}
            onScroll={onVerticalScroll}
            scrollEventThrottle={200}
            removeClippedSubviews
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
          />
        </Pressable>
      )}

      {/* ═══ HORIZONTAL PAGER (LTR / RTL) ════════════════════════════════ */}
      {!isVertical && (
        <View style={styles.fill}>
          <FlatList
            ref={flatRef}
            data={isRTL ? [...pages].reverse() : pages}
            keyExtractor={keyExtract}
            renderItem={renderHPage}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onHorizontalScrollEnd}
            scrollEventThrottle={16}
            removeClippedSubviews
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={hLayout}
            onScrollToIndexFailed={() => {}}
          />

          {/* Tap zones — drawn OVER the FlatList */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Pressable style={styles.tapLeft}  onPress={isRTL ? tapNext : tapPrev} />
            <Pressable style={styles.tapMid}   onPress={toggleUI} />
            <Pressable style={styles.tapRight} onPress={isRTL ? tapPrev : tapNext} />
          </View>
        </View>
      )}

      {/* ═══ PAGE COUNTER PILL (always visible) ══════════════════════════ */}
      {!uiVisible && (
        <View
          style={[
            styles.pillWrap,
            { bottom: insets.bottom + 14 },
          ]}
          pointerEvents="none"
        >
          <View style={styles.pill}>
            <Text style={styles.pillTxt}>{displayPage} / {totalPages}</Text>
          </View>
        </View>
      )}

      {/* ═══ TOP BAR ══════════════════════════════════════════════════════ */}
      {uiVisible && (
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + 2 },
          ]}
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.topTitleBlock}>
            <Text numberOfLines={1} style={styles.topChapter}>
              {chapter.title ? chapter.title : `Chapter ${chapter.number}`}
            </Text>
            <Text numberOfLines={1} style={styles.topSource}>{sourceName}</Text>
          </View>

          {/* Mode badge */}
          <View style={styles.badge}>
            <MaterialCommunityIcons
              name={
                isVertical ? 'arrow-expand-vertical'
                : isRTL     ? 'arrow-left-bold'
                :             'arrow-right-bold'
              }
              size={13}
              color="rgba(255,255,255,0.75)"
            />
            <Text style={styles.badgeTxt}>
              {isVertical ? 'Webtoon' : isRTL ? 'RTL' : 'LTR'}
            </Text>
          </View>
        </View>
      )}

      {/* ═══ BOTTOM BAR ═══════════════════════════════════════════════════ */}
      {uiVisible && (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: insets.bottom + 6 },
          ]}
        >
          {/* ─ Page / total ─ */}
          <Text style={styles.pgLabel}>
            <Text style={styles.pgCurrent}>{displayPage}</Text>
            <Text style={styles.pgSep}> / {totalPages}</Text>
          </Text>

          {/* ─ Scrubber row ─ */}
          <View style={styles.scrubRow}>
            {/* Prev chapter */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
              <Ionicons name="play-skip-back" size={20} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>

            {/* Track */}
            <Pressable
              style={styles.scrubTrack}
              onLayout={onScrubLayout}
              onPress={onScrubPress}
            >
              <View style={styles.trackBg} />
              <View style={[styles.trackFill, {
                width: `${sliderPct * 100}%`,
                backgroundColor: colors.accent,
              }]} />
              <View style={[styles.thumb, {
                left: `${sliderPct * 100}%`,
                backgroundColor: colors.accent,
              }]} />
            </Pressable>

            {/* Next chapter */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
              <Ionicons name="play-skip-forward" size={20} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </View>

          {/* ─ Prev / chapter title / next ─ */}
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navBtn} onPress={tapPrev}>
              <Ionicons
                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                size={26}
                color={currentPage === 0 ? 'rgba(255,255,255,0.25)' : '#fff'}
              />
            </TouchableOpacity>

            <View style={styles.navCenter}>
              <Text numberOfLines={1} style={styles.navChapterTxt}>
                {chapter.title || `Chapter ${chapter.number}`}
              </Text>
            </View>

            <TouchableOpacity style={styles.navBtn} onPress={tapNext}>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={26}
                color={currentPage === totalPages - 1 ? 'rgba(255,255,255,0.25)' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // Loading
  loadText: {
    marginTop: 14,
    fontSize: 14,
    textAlign: 'center',
  },

  // Error
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 10,
  },
  errTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  errBody:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  errBtn: {
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 8,
    minWidth: 130,
    alignItems: 'center',
  },
  errBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Zoom page
  zoomContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: H,
  },

  // Tap zones
  tapLeft:  { position: 'absolute', left: 0,    top: 0, bottom: 0, width: '25%' },
  tapMid:   { position: 'absolute', left: '25%', right: '25%', top: 0, bottom: 0 },
  tapRight: { position: 'absolute', right: 0,   top: 0, bottom: 0, width: '25%' },

  // Page pill
  pillWrap: {
    position: 'absolute',
    alignSelf: 'center',
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  pillTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.70)',
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitleBlock: { flex: 1, gap: 2 },
  topChapter: { color: '#fff', fontSize: 15, fontWeight: '600' },
  topSource:  { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  badgeTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500' },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.70)',
    gap: 6,
  },

  // Page label
  pgLabel:   { textAlign: 'center' },
  pgCurrent: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pgSep:     { color: 'rgba(255,255,255,0.45)', fontSize: 13 },

  // Scrubber
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrubTrack: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  trackBg: {
    position: 'absolute',
    left: 4, right: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  trackFill: {
    position: 'absolute',
    left: 4,
    height: 3,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -5,        // offset so it sits on top of the fill end
    top: '50%',
    marginTop: -9,
  },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  navBtn:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navCenter:     { flex: 1, alignItems: 'center' },
  navChapterTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'center' },
});
