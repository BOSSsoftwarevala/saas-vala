import { useEffect, useRef, useState } from 'react';
import { Bell, Heart, Home, Library, LayoutGrid, Mic2, MoreHorizontal, Pause, Play, Radio, Search, SkipBack, SkipForward, User2, Disc3 } from 'lucide-react';

type MenuItem = {
  label: string;
  icon: typeof Home;
  active?: boolean;
};

type PlaylistCard = {
  id: string;
  title: string;
  tracks: string;
  accent: string;
};

type Artist = {
  id: string;
  name: string;
  followers: string;
  plays: string;
  accent: string;
  emoji: string;
};

type Track = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  accent: string;
  artwork: string;
};

const MENU_TOP: MenuItem[] = [
  { label: 'Explore', icon: Home, active: true },
  { label: 'Genres', icon: Radio },
  { label: 'Albums', icon: Disc3 },
  { label: 'Artist', icon: User2 },
];

const MENU_LIBRARY: MenuItem[] = [
  { label: 'Favourites', icon: Heart },
  { label: 'Popular', icon: LayoutGrid },
  { label: 'My Music', icon: Library },
];

const PLAYLISTS: PlaylistCard[] = [
  { id: '1', title: 'Musik Pop', tracks: '20 Tracks', accent: 'from-fuchsia-400 via-purple-400 to-pink-300' },
  { id: '2', title: 'Musik Anu', tracks: '22 Tracks', accent: 'from-pink-300 via-fuchsia-400 to-violet-400' },
  { id: '3', title: 'Lofi Bass', tracks: '18 Tracks', accent: 'from-purple-300 via-fuchsia-300 to-rose-300' },
  { id: '4', title: 'Anak Senja', tracks: '25 Tracks', accent: 'from-violet-300 via-purple-400 to-pink-300' },
];

const ARTISTS: Artist[] = [
  { id: '1', name: 'Mamank', followers: '1528 Followers', plays: '122M Plays', accent: 'from-fuchsia-500 to-violet-500', emoji: '🧑🏾‍🎤' },
  { id: '2', name: 'Maimunah', followers: '1928 Followers', plays: '50M Plays', accent: 'from-pink-400 to-purple-500', emoji: '👩🏻‍🎤' },
  { id: '3', name: 'Paijo', followers: '1028 Followers', plays: '32M Plays', accent: 'from-violet-400 to-fuchsia-500', emoji: '🧑🏽' },
];

const TRENDING: Track[] = [
  { id: '1', title: 'Balonku Ada 5 Meter', artist: 'Mamank', genre: 'Dance Beat', duration: '3:20', accent: 'from-violet-400 to-fuchsia-500', artwork: '🚘' },
  { id: '2', title: 'Kucing Kesayangan', artist: 'Maimunah', genre: 'Electro Pop', duration: '3:20', accent: 'from-pink-400 to-violet-500', artwork: '🐈' },
  { id: '3', title: 'Balonku Ada 5 Meter', artist: 'Mamank', genre: 'Dance Beat', duration: '3:20', accent: 'from-purple-400 to-fuchsia-500', artwork: '🚘' },
];

const WAVE_BARS = [18, 26, 14, 22, 30, 16, 25, 12, 20, 28, 17, 24, 15, 29, 19, 23];

export default function AiChatLive() {
  const [query, setQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeTrack, setActiveTrack] = useState<Track>(TRENDING[0]);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current) return;
    progressRef.current.style.width = '58%';
  }, [activeTrack]);

  return (
    <div className="min-h-screen bg-[#d7b3f5] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1240px] rounded-[40px] border-[9px] border-[#17132d] bg-[#17132d] p-3 shadow-[0_30px_80px_rgba(52,20,91,0.35)]">
        <div className="grid min-h-[720px] grid-cols-1 gap-3 rounded-[30px] bg-[#f8f5fd] p-3 lg:grid-cols-[225px_minmax(0,1fr)]">
          <aside className="flex flex-col rounded-[26px] bg-[linear-gradient(180deg,#20153b_0%,#17122f_100%)] px-5 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_top,#d946ef,#6d28d9_70%)] shadow-[0_14px_30px_rgba(192,38,211,0.45)]">
                <User2 className="h-8 w-8" />
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs text-white/50">Hi</p>
              <h2 className="mt-1 text-[34px] font-semibold leading-[1.05] tracking-tight">Ahmad<br />Fauzi</h2>
            </div>

            <div className="mt-8">
              <p className="mb-3 text-xs text-white/40">Menu</p>
              <div className="space-y-1.5">
                {MENU_TOP.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${item.active ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7">
              <p className="mb-3 text-xs text-white/40">Library</p>
              <div className="space-y-1.5">
                {MENU_LIBRARY.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/5 hover:text-white"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto rounded-[22px] border border-white/10 bg-[#1a1230] px-3 py-2.5">
              <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-white/35">
                <span>Now</span>
                <div className="flex items-end gap-[3px]">
                  {WAVE_BARS.slice(0, 10).map((bar, index) => (
                    <span key={`sidebar-wave-${index}`} className="w-[3px] rounded-full bg-white/35" style={{ height: `${Math.max(6, bar / 2)}px` }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-[26px] bg-[linear-gradient(135deg,#ca72ff_0%,#8c3cff_55%,#6d28d9_100%)] p-4 shadow-[0_18px_34px_rgba(147,51,234,0.45)]">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-[linear-gradient(135deg,#f3d1ff,#a855f7)] p-[2px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#d8b4fe,#7c3aed)] text-xl">{activeTrack.artwork}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">Balonku A...</p>
                  <p className="text-xs text-white/70">Bening Anu</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-5 text-white">
                <SkipBack className="h-4 w-4" />
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#7c3aed]"
                  onClick={() => setIsPlaying((value) => !value)}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </button>
                <SkipForward className="h-4 w-4" />
              </div>
            </div>
          </aside>

          <main className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_286px]">
            <section className="rounded-[28px] bg-white px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-[40px] font-semibold leading-none text-[#17132d]">Home</h1>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#efe7fb] text-[#30224d]">
                    <Bell className="h-4 w-4" />
                  </button>
                  <div className="flex h-11 items-center gap-2 rounded-full border border-[#efe7fb] px-4 text-[#b5aac9]">
                    <Search className="h-4 w-4" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Type here to search"
                      className="w-40 border-0 bg-transparent text-sm outline-none placeholder:text-[#c6bdd6]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[26px] bg-[linear-gradient(135deg,#cc6dff_0%,#a855f7_40%,#7c3aed_100%)] px-7 py-6 text-white shadow-[0_24px_48px_rgba(168,85,247,0.35)]">
                <div className="grid items-center gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Musikania</p>
                    <h2 className="mt-3 max-w-[320px] text-[46px] font-semibold leading-[1.02]">Listen to trending songs all the time</h2>
                    <p className="mt-3 max-w-[330px] text-sm leading-6 text-white/80">With Musikania, you can get premium music for free anywhere and at any time.</p>
                    <button type="button" className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#7c3aed] shadow-[0_12px_28px_rgba(255,255,255,0.3)]">
                      Explore Now
                    </button>
                  </div>
                  <div className="relative flex min-h-[220px] items-end justify-center">
                    <div className="absolute right-8 top-2 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
                    <div className="absolute left-10 top-10 h-16 w-16 rounded-full bg-fuchsia-300/30 blur-xl" />
                    <div className="flex h-[250px] w-[250px] items-end justify-center rounded-[30px] bg-[radial-gradient(circle_at_top,#f9d8ff_0%,rgba(255,255,255,0.08)_60%,transparent_80%)]">
                      <div className="mb-6 flex flex-col items-center">
                        <div className="mb-2 flex gap-2">
                          <div className="h-8 w-8 rounded-full bg-white/30" />
                          <div className="h-8 w-8 rounded-full bg-white/30" />
                        </div>
                        <div className="flex h-[170px] w-[130px] items-center justify-center rounded-t-[70px] bg-[linear-gradient(180deg,#ffe4f4,#f5d0fe)] text-6xl shadow-[0_20px_40px_rgba(244,114,182,0.25)]">🎧</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-[36px] font-semibold leading-none text-[#17132d]">Playlist</h3>
                <button type="button" className="text-sm font-medium text-[#6c5b8c]">See More</button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {PLAYLISTS.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    className={`overflow-hidden rounded-[22px] bg-gradient-to-br ${playlist.accent} p-[1px] text-left shadow-[0_16px_32px_rgba(168,85,247,0.18)]`}
                    onClick={() => setActiveTrack(TRENDING[Number(playlist.id) % TRENDING.length])}
                  >
                    <div className="rounded-[21px] bg-[linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.08))] px-4 py-4 backdrop-blur-xl">
                      <div className="flex h-28 items-end rounded-[18px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.75),rgba(255,255,255,0.15),transparent_75%)] p-3">
                        <div className="rounded-full bg-white/80 p-2 text-[#8b5cf6] shadow-lg">
                          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{playlist.title}</p>
                          <p className="text-xs text-white/75">{playlist.tracks}</p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#8b5cf6]">
                          <Play className="ml-0.5 h-3 w-3 fill-current" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-[36px] font-semibold leading-none text-[#17132d]">Trending</h3>
                <button type="button" className="text-sm font-medium text-[#6c5b8c]">See More</button>
              </div>

              <div className="mt-4 space-y-2">
                {TRENDING.map((track, index) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setActiveTrack(track)}
                    className={`grid w-full grid-cols-[34px_minmax(0,1fr)_70px_40px] items-center gap-3 rounded-[22px] px-3 py-3 text-left transition ${activeTrack.id === track.id ? 'bg-[#f4edff]' : 'hover:bg-[#faf6ff]'}`}
                  >
                    <span className="text-sm font-medium text-[#8b7da8]">0{index + 1}</span>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${track.accent} p-[1px]`}>
                        <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white/70 text-lg">{track.artwork}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1d1531]">{track.title}</p>
                        <p className="truncate text-xs text-[#8b7da8]">{track.artist} · {track.genre}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#5d4c7a]">{track.duration}</span>
                    <div className="flex justify-end">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d946ef,#8b5cf6)] text-white shadow-[0_10px_20px_rgba(168,85,247,0.28)]">
                        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-[28px] bg-white px-5 py-5">
              <div>
                <h3 className="text-[26px] font-semibold text-[#17132d]">Top Artist</h3>
                <div className="mt-4 space-y-3">
                  {ARTISTS.map((artist) => (
                    <button key={artist.id} type="button" className="flex w-full items-center gap-3 rounded-[22px] px-2 py-2 text-left transition hover:bg-[#faf6ff]">
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${artist.accent} p-[1px] shadow-[0_10px_24px_rgba(168,85,247,0.16)]`}>
                        <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white/75 text-xl">{artist.emoji}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1d1531]">{artist.name}</p>
                        <p className="text-[11px] text-[#9487ae]">{artist.followers} · {artist.plays}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button type="button" className="mt-2 text-sm font-medium text-[#6c5b8c]">See More</button>
              </div>

              <div className="mt-auto overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,#271042_0%,#160825_100%)] p-5 text-white shadow-[0_24px_48px_rgba(33,16,66,0.4)]">
                <div className={`rounded-[26px] bg-gradient-to-br ${activeTrack.accent} p-[1px]`}>
                  <div className="flex h-48 items-end justify-center rounded-[25px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),rgba(255,255,255,0.08),transparent_72%)] pb-5 text-7xl">{activeTrack.artwork}</div>
                </div>
                <div className="mt-5 text-center">
                  <p className="text-xl font-semibold">{activeTrack.title}</p>
                  <p className="mt-1 text-sm text-white/65">{activeTrack.artist}</p>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-white/70">
                  <span>1:20</span>
                  <span>3:30</span>
                </div>
                <div className="mt-3 flex h-9 items-end justify-between gap-1.5 px-1">
                  {WAVE_BARS.map((bar, index) => (
                    <span
                      key={`player-wave-${index}`}
                      className={`w-[4px] rounded-full ${index < 9 ? 'bg-white' : 'bg-white/35'}`}
                      style={{ height: `${bar}px` }}
                    />
                  ))}
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div ref={progressRef} className="h-2 rounded-full bg-[linear-gradient(90deg,#ffffff,#d8b4fe)]" />
                </div>
                <div className="mt-6 flex items-center justify-center gap-6">
                  <button type="button" className="text-white/70"><Mic2 className="h-4 w-4" /></button>
                  <button type="button" className="text-white/90"><SkipBack className="h-5 w-5" /></button>
                  <button
                    type="button"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#271042] shadow-[0_12px_24px_rgba(255,255,255,0.22)]"
                    onClick={() => setIsPlaying((value) => !value)}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                  </button>
                  <button type="button" className="text-white/90"><SkipForward className="h-5 w-5" /></button>
                  <button type="button" className="text-white/70"><MoreHorizontal className="h-5 w-5" /></button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
