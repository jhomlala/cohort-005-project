/**
 * PROTOTYPE (throwaway, wayfinder ticket "Prototype the Notification Feed look and feel").
 *
 * Question: how should the Notification Feed look and behave inside Cadence?
 * Three variants on the existing app shell (app/routes/layout.app.tsx), switched with `?variant=A|B|C`:
 *   A  Bell popover      bell + unread badge in the top-right, dropdown list
 *   B  Sidebar drawer    "Notifications" item in the sidebar, slide-over drawer grouped by day, with actions
 *   C  Persistent rail   always-visible right column, dense rows, filter chips
 *
 * Sample data is the v1 catalogue (R1-R4, C1, C2, P2, P7), per role. In-memory only, nothing is sent
 * anywhere. Push is stubbed. Delete this file, not the decision, once a variant wins.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Archive,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Inbox,
  MessageSquare,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Smartphone,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";

// ---------------------------------------------------------------- data

type Group = "Refunds" | "Questions" | "Courses & Seats";
type Tone = "good" | "bad" | "refund" | "question" | "sale" | "seat";

export interface FeedItem {
  id: string;
  ref: string; // catalogue id, e.g. "R3"
  group: Group;
  tone: Tone;
  title: string;
  body: string;
  minutesAgo: number;
  to: string;
  push: boolean; // is this one of the three push Notifications?
  read: boolean;
  archived: boolean;
}

type Seed = Omit<FeedItem, "read" | "archived" | "id">;

const BUYER: Seed[] = [
  {
    ref: "R3",
    group: "Refunds",
    tone: "good",
    title: "Refund Request approved",
    body: "Your Refund Request for Intro to TypeScript was approved. We are returning $49.00. Your access has ended; your progress is kept.",
    minutesAgo: 12,
    to: "/settings",
    push: true,
  },
  {
    ref: "C2",
    group: "Questions",
    tone: "question",
    title: "Your question was answered",
    body: "Sarah Chen answered your question on “Generics in practice”.",
    minutesAgo: 95,
    to: "/courses",
    push: true,
  },
  {
    ref: "R4",
    group: "Refunds",
    tone: "bad",
    title: "Refund Request declined",
    body: "Your Refund Request for Advanced React Patterns was declined: you have watched more than the Watch Limit. You can raise a new one.",
    minutesAgo: 60 * 30,
    to: "/settings",
    push: true,
  },
  {
    ref: "R1",
    group: "Refunds",
    tone: "refund",
    title: "We have your Refund Request",
    body: "Your Refund Request for Advanced React Patterns is open. A Platform Admin will decide it.",
    minutesAgo: 60 * 52,
    to: "/settings",
    push: false,
  },
];

const INSTRUCTOR: Seed[] = [
  {
    ref: "C1",
    group: "Questions",
    tone: "question",
    title: "New question on your lesson",
    body: "Alex Kim asked a question on “Generics in practice”.",
    minutesAgo: 8,
    to: "/instructor/questions",
    push: false,
  },
  {
    ref: "P2",
    group: "Courses & Seats",
    tone: "sale",
    title: "Your course was bought",
    body: "Maria Lopez bought Intro to TypeScript.",
    minutesAgo: 70,
    to: "/instructor",
    push: false,
  },
  {
    ref: "C1",
    group: "Questions",
    tone: "question",
    title: "New question on your lesson",
    body: "Jo Park asked a question on “Mapped types”.",
    minutesAgo: 60 * 27,
    to: "/instructor/questions",
    push: false,
  },
  {
    ref: "P2",
    group: "Courses & Seats",
    tone: "sale",
    title: "Your course was bought",
    body: "A Team Licence for Intro to TypeScript was bought: 10 Seats.",
    minutesAgo: 60 * 60,
    to: "/instructor",
    push: false,
  },
];

const PLATFORM_ADMIN: Seed[] = [
  {
    ref: "R2",
    group: "Refunds",
    tone: "refund",
    title: "Refund Request needs a decision",
    body: "Maria Lopez asked for a refund on Intro to TypeScript ($49.00).",
    minutesAgo: 5,
    to: "/admin/refunds",
    push: false,
  },
  {
    ref: "R2",
    group: "Refunds",
    tone: "refund",
    title: "Refund Request needs a decision",
    body: "Alex Kim asked for a refund on Advanced React Patterns ($79.00).",
    minutesAgo: 140,
    to: "/admin/refunds",
    push: false,
  },
  {
    ref: "R2",
    group: "Refunds",
    tone: "refund",
    title: "Refund Request needs a decision",
    body: "Jo Park asked for a refund on a Team Licence for Node Fundamentals ($390.00).",
    minutesAgo: 60 * 26,
    to: "/admin/refunds",
    push: false,
  },
];

const TEAM_ADMIN: Seed[] = [
  {
    ref: "P7",
    group: "Courses & Seats",
    tone: "seat",
    title: "A Seat was claimed",
    body: "Priya Rao claimed a Seat on Intro to TypeScript. 3 of 10 Seats claimed.",
    minutesAgo: 30,
    to: "/team",
    push: false,
  },
  {
    ref: "P7",
    group: "Courses & Seats",
    tone: "seat",
    title: "A Seat was claimed",
    body: "Tom Ellis claimed a Seat on Intro to TypeScript. 2 of 10 Seats claimed.",
    minutesAgo: 60 * 29,
    to: "/team",
    push: false,
  },
];

function seedFor(role: UserRole | null, isTeamAdmin: boolean): FeedItem[] {
  let seeds: Seed[] = [];
  if (role === UserRole.Student) seeds = [...BUYER];
  else if (role === UserRole.Instructor) seeds = [...INSTRUCTOR];
  else if (role === UserRole.Admin) seeds = [...PLATFORM_ADMIN];
  if (isTeamAdmin) seeds = [...seeds, ...TEAM_ADMIN];
  return seeds
    .sort((a, b) => a.minutesAgo - b.minutesAgo)
    .map((s, i) => ({
      ...s,
      id: `${s.ref}-${i}`,
      // the freshest two start unread, so the badge has something to show
      read: i >= 2,
      archived: false,
    }));
}

// ---------------------------------------------------------------- state

export function useFakeFeed(role: UserRole | null, isTeamAdmin: boolean) {
  const [items, setItems] = useState<FeedItem[]>(() =>
    seedFor(role, isTeamAdmin)
  );
  const [pushOn, setPushOn] = useState(false);

  // switching user in the DevUI re-seeds the feed
  useEffect(() => {
    setItems(seedFor(role, isTeamAdmin));
  }, [role, isTeamAdmin]);

  const visible = items.filter((i) => !i.archived);
  return {
    items: visible,
    unread: visible.filter((i) => !i.read).length,
    pushOn,
    hasPushKinds: visible.some((i) => i.push),
    enablePush: () => setPushOn(true),
    markRead: (id: string) =>
      setItems((xs) => xs.map((i) => (i.id === id ? { ...i, read: true } : i))),
    markAllRead: () => setItems((xs) => xs.map((i) => ({ ...i, read: true }))),
    archive: (id: string) =>
      setItems((xs) =>
        xs.map((i) => (i.id === id ? { ...i, archived: true } : i))
      ),
    reset: () => setItems(seedFor(role, isTeamAdmin)),
    clear: () => setItems((xs) => xs.map((i) => ({ ...i, archived: true }))),
  };
}

export type Feed = ReturnType<typeof useFakeFeed>;

// ---------------------------------------------------------------- shared bits

function ago(min: number) {
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.floor(min / 60)}h ago`;
  return `${Math.floor(min / 1440)}d ago`;
}

const TONE: Record<Tone, { icon: React.ReactNode; cls: string }> = {
  good: {
    icon: <CircleCheck className="size-4" />,
    cls: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  bad: {
    icon: <CircleX className="size-4" />,
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  refund: {
    icon: <Receipt className="size-4" />,
    cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  question: {
    icon: <MessageSquare className="size-4" />,
    cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  sale: {
    icon: <ShoppingCart className="size-4" />,
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  seat: {
    icon: <UsersRound className="size-4" />,
    cls: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  },
};

function ToneIcon({ tone }: { tone: Tone }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        TONE[tone].cls
      )}
    >
      {TONE[tone].icon}
    </span>
  );
}

function Empty({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-muted-foreground",
        compact ? "gap-1 px-4 py-10" : "gap-2 px-6 py-14"
      )}
    >
      <Inbox className="size-8 opacity-50" />
      <div className="text-sm font-medium text-foreground">
        You&apos;re all caught up
      </div>
      <div className="text-xs">
        Refund decisions, answers and other news will show up here.
      </div>
    </div>
  );
}

function UnreadBadge({ n, className }: { n: number; className?: string }) {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        "min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground",
        className
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

// ---------------------------------------------------------------- Variant A: bell popover

export function VariantA({ feed }: { feed: Feed }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const list = tab === "unread" ? feed.items.filter((i) => !i.read) : feed.items;

  return (
    <div className="fixed right-4 top-3 z-40">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative z-10 rounded-full border bg-background p-2 shadow-sm transition-colors hover:bg-accent"
      >
        <Bell className="size-5" />
        <UnreadBadge n={feed.unread} className="absolute -right-1.5 -top-1.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-10 mt-2 w-96 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold">Notifications</div>
              <button
                onClick={feed.markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all as read
              </button>
            </div>
            <div className="flex gap-1 border-b px-3 py-2">
              {(["all", "unread"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                    tab === t
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                  {t === "unread" && feed.unread > 0 ? ` (${feed.unread})` : ""}
                </button>
              ))}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {list.length === 0 ? (
                <Empty compact />
              ) : (
                list.map((n) => (
                  <Link
                    key={n.id}
                    to={n.to}
                    onClick={() => {
                      feed.markRead(n.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent/60",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <ToneIcon tone={n.tone} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={cn(
                            "text-sm",
                            n.read ? "font-medium" : "font-semibold"
                          )}
                        >
                          {n.title}
                        </div>
                        {!n.read && (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground/70">
                        {ago(n.minutesAgo)}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="border-t px-4 py-2 text-center text-[11px] text-muted-foreground/60">
              Powered by Knock
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Variant B: sidebar item + drawer

export function VariantB({ feed }: { feed: Feed }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const today = feed.items.filter((i) => i.minutesAgo < 1440);
  const earlier = feed.items.filter((i) => i.minutesAgo >= 1440);

  function Group({ label, items }: { label: string; items: FeedItem[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "rounded-lg border bg-card p-3",
                !n.read && "border-primary/40"
              )}
            >
              <div className="flex gap-3">
                <ToneIcon tone={n.tone} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{n.title}</div>
                    {!n.read && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {n.body}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground/70">
                      {ago(n.minutesAgo)}
                    </span>
                    {n.push && feed.pushOn && (
                      <span className="flex items-center gap-1 text-muted-foreground/70">
                        <Smartphone className="size-3" /> push sent
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => {
                          feed.markRead(n.id);
                          setOpen(false);
                          navigate(n.to);
                        }}
                        className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Open
                      </button>
                      {!n.read && (
                        <button
                          onClick={() => feed.markRead(n.id)}
                          title="Mark as read"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                        >
                          <CheckCheck className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => feed.archive(n.id)}
                        title="Archive"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                      >
                        <Archive className="size-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-3 pb-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            open
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Bell className="size-4" />
          Notifications
          <UnreadBadge n={feed.unread} className="ml-auto" />
        </button>
      </div>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-56 z-40 flex w-[26rem] flex-col border-r bg-background shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="font-semibold">Notifications</div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>
            {feed.hasPushKinds && !feed.pushOn && (
              <div className="m-4 mb-0 flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
                <Smartphone className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 text-xs text-muted-foreground">
                  Get a push when a Refund Request is decided or your question
                  is answered.
                </div>
                <button
                  onClick={feed.enablePush}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                >
                  Enable push
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
              {feed.items.length === 0 ? (
                <Empty />
              ) : (
                <>
                  <Group label="Today" items={today} />
                  <Group label="Earlier" items={earlier} />
                </>
              )}
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs">
              <span className="text-muted-foreground/60">Powered by Knock</span>
              <button
                onClick={feed.markAllRead}
                className="font-medium text-muted-foreground hover:text-foreground"
              >
                Mark all as read
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Variant C: persistent right rail

export function VariantC({ feed }: { feed: Feed }) {
  const groups: Array<"All" | Group> = [
    "All",
    "Refunds",
    "Questions",
    "Courses & Seats",
  ];
  const [group, setGroup] = useState<"All" | Group>("All");
  const list =
    group === "All" ? feed.items : feed.items.filter((i) => i.group === group);

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-80 flex-col border-l bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Bell className="size-4" />
        <div className="text-sm font-semibold">Activity</div>
        <UnreadBadge n={feed.unread} />
        <button
          onClick={feed.markAllRead}
          title="Mark all as read"
          className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        >
          <CheckCheck className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
              group === g
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <Empty compact />
        ) : (
          list.map((n) => (
            <Link
              key={n.id}
              to={n.to}
              onClick={() => feed.markRead(n.id)}
              className={cn(
                "group flex items-stretch gap-2.5 border-b px-3 py-2.5 hover:bg-accent/60",
                !n.read && "bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "w-1 shrink-0 rounded-full",
                  n.read ? "bg-transparent" : "bg-primary"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div
                    className={cn(
                      "truncate text-xs",
                      n.read ? "font-medium" : "font-semibold"
                    )}
                  >
                    {n.title}
                  </div>
                  <div className="shrink-0 text-[10px] text-muted-foreground/70">
                    {ago(n.minutesAgo)}
                  </div>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {n.body}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground/60">
        Powered by Knock
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- switcher

const VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Sidebar drawer" },
  { key: "C", name: "Persistent rail" },
] as const;

export function useVariant(): "A" | "B" | "C" {
  const [params] = useSearchParams();
  const v = params.get("variant");
  return v === "B" || v === "C" ? v : "A";
}

export function PrototypeSwitcher({ feed }: { feed: Feed }) {
  const [, setParams] = useSearchParams();
  const current = useVariant();
  const idx = VARIANTS.findIndex((v) => v.key === current);

  function go(delta: number) {
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length];
    setParams(
      (p) => {
        p.set("variant", next.key);
        return p;
      },
      { replace: true }
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs text-white shadow-2xl">
      <button onClick={() => go(-1)} aria-label="Previous variant">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-40 text-center font-medium">
        {current} ({VARIANTS[idx].name})
      </span>
      <button onClick={() => go(1)} aria-label="Next variant">
        <ChevronRight className="size-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-white/30" />
      <button
        onClick={feed.reset}
        title="Reset the sample feed"
        className="flex items-center gap-1 opacity-80 hover:opacity-100"
      >
        <RotateCcw className="size-3" /> reset
      </button>
      <button
        onClick={feed.clear}
        title="Empty the feed to see the empty state"
        className="flex items-center gap-1 opacity-80 hover:opacity-100"
      >
        <Trash2 className="size-3" /> empty
      </button>
    </div>
  );
}
