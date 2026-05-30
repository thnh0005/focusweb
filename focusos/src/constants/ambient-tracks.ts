// ═══════════════════════════════════════════════════════════════
// Ambient Tracks — FocusOS (U05)
// 50+ curated quotes included here too (static, no API calls)
// ═══════════════════════════════════════════════════════════════

import type { AmbientTrack } from "@/types/session.types";

// ── Ambient Audio Tracks ──────────────────────────────────────

export const AMBIENT_TRACKS: AmbientTrack[] = [
  {
    id: "lofi",
    label: "Lo-fi Beats",
    category: "lofi",
    streamUrl: "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&controls=0",
    icon: "🎵",
  },
  {
    id: "rain",
    label: "Rain",
    category: "rain",
    streamUrl: "https://www.youtube.com/embed/mPZkdNFkNps?autoplay=1&controls=0",
    icon: "🌧️",
  },
  {
    id: "forest",
    label: "Forest / Nature",
    category: "nature",
    streamUrl: "https://www.youtube.com/embed/xNN7iTA57jM?autoplay=1&controls=0",
    icon: "🌲",
  },
  {
    id: "cafe",
    label: "Cafe Ambience",
    category: "cafe",
    streamUrl: "https://www.youtube.com/embed/BOdLmxy06H0?autoplay=1&controls=0",
    icon: "☕",
  },
  {
    id: "whitenoise",
    label: "White Noise",
    category: "whitenoise",
    streamUrl: "https://www.youtube.com/embed/nMfPqeZjc2c?autoplay=1&controls=0",
    icon: "📻",
  },
];

// ── Motivational Quotes (50+ curated, no API calls per design1.md) ──

export const FOCUS_QUOTES = [
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  },
  {
    text: "Deep work is the ability to focus without distraction on a cognitively demanding task.",
    author: "Cal Newport",
  },
  {
    text: "You don't need more time in your day. You need to decide.",
    author: "Seth Godin",
  },
  {
    text: "It is not that we have a short time to live, but that we waste a lot of it.",
    author: "Seneca",
  },
  {
    text: "Waste no more time arguing about what a good man should be. Be one.",
    author: "Marcus Aurelius",
  },
  {
    text: "The present moment is the only moment available to us, and it is the door to all moments.",
    author: "Thích Nhất Hạnh",
  },
  {
    text: "Do the difficult things while they are easy and do the great things while they are small.",
    author: "Lao Tzu",
  },
  {
    text: "Until we can manage time, we can manage nothing else.",
    author: "Peter Drucker",
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
  },
  {
    text: "Your future is created by what you do today, not tomorrow.",
    author: "Robert Kiyosaki",
  },
  {
    text: "Concentrate all your thoughts upon the work in hand.",
    author: "Alexander Graham Bell",
  },
  {
    text: "You have power over your mind, not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
  },
  {
    text: "Perfection of character is this: to live each day as if it were your last.",
    author: "Marcus Aurelius",
  },
  {
    text: "First say to yourself what you would be; and then do what you have to do.",
    author: "Epictetus",
  },
  {
    text: "Make the most of yourself, for that is all there is of you.",
    author: "Ralph Waldo Emerson",
  },
  {
    text: "The most difficult thing is the decision to act, the rest is merely tenacity.",
    author: "Amelia Earhart",
  },
  {
    text: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin",
  },
  {
    text: "Begin anywhere.",
    author: "John Cage",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
  },
  {
    text: "The mind is not a vessel to be filled, but a fire to be ignited.",
    author: "Plutarch",
  },
  {
    text: "Do not be embarrassed by your failures, learn from them and start again.",
    author: "Richard Branson",
  },
  {
    text: "Every moment of resistance to temptation is a victory.",
    author: "Frederick William Faber",
  },
  {
    text: "The successful warrior is the average man, with laser-like focus.",
    author: "Bruce Lee",
  },
  {
    text: "It's not always that we need to do more but rather that we need to focus on less.",
    author: "Nathan W. Morris",
  },
  {
    text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
    author: "Stephen Covey",
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "In the middle of every difficulty lies opportunity.",
    author: "Albert Einstein",
  },
  {
    text: "I am not a product of my circumstances. I am a product of my decisions.",
    author: "Stephen Covey",
  },
  {
    text: "Whatever you can do, or dream you can, begin it.",
    author: "Goethe",
  },
  {
    text: "Lost time is never found again.",
    author: "Benjamin Franklin",
  },
  {
    text: "Better to do something imperfectly than to do nothing flawlessly.",
    author: "Robert H. Schuller",
  },
  {
    text: "Act as if what you do makes a difference. It does.",
    author: "William James",
  },
  {
    text: "Do not wait; the time will never be 'just right.'",
    author: "Napoleon Hill",
  },
  {
    text: "The only limit to our realization of tomorrow will be our doubts of today.",
    author: "Franklin D. Roosevelt",
  },
  {
    text: "Life is 10% what happens to us and 90% how we react to it.",
    author: "Charles R. Swindoll",
  },
  {
    text: "Hard work beats talent when talent doesn't work hard.",
    author: "Tim Notke",
  },
  {
    text: "Genius is one percent inspiration and ninety-nine percent perspiration.",
    author: "Thomas Edison",
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    author: "Zig Ziglar",
  },
  {
    text: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
  },
  {
    text: "Absorb what is useful, discard what is not, add what is uniquely your own.",
    author: "Bruce Lee",
  },
  {
    text: "The measure of intelligence is the ability to change.",
    author: "Albert Einstein",
  },
  {
    text: "Awareness is the greatest agent for change.",
    author: "Eckhart Tolle",
  },
  {
    text: "When you know better, you do better.",
    author: "Maya Angelou",
  },
  {
    text: "Your work is to discover your world and then with all your heart give yourself to it.",
    author: "Buddha",
  },
  {
    text: "Every strike brings me closer to the next home run.",
    author: "Babe Ruth",
  },
  {
    text: "Limitations live only in our minds. But if we use our imaginations, our possibilities become limitless.",
    author: "Jamie Paolinetti",
  },
  {
    text: "The only person you are destined to become is the person you decide to be.",
    author: "Ralph Waldo Emerson",
  },
  {
    text: "Small daily improvements over time lead to stunning results.",
    author: "Robin Sharma",
  },
  {
    text: "The goal is not to be perfect by the end. The goal is to be better today.",
    author: "Simon Sinek",
  },
  {
    text: "All great achievements require time.",
    author: "Maya Angelou",
  },
  {
    text: "Discipline equals freedom.",
    author: "Jocko Willink",
  },
];
