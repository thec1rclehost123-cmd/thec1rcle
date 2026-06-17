export type Prompt = {
  id: string;
  title: string;
  answer: string;
};

export type DatingPhoto = {
  id: string;
  source: number | string | { uri: string };
  caption?: string;
};

export type DatingProfile = {
  id: string;
  name: string;
  age: number;
  headline: string;
  sharedEvent: string;
  venue: string;
  distance: string;
  profileRouteId: string;
  tags: string[];
  photos: DatingPhoto[];
  prompts: Prompt[];
};

export const MOCK_PROFILES: DatingProfile[] = [
  {
    id: 'arya',
    name: 'Arya',
    age: 26,
    headline: 'House, rooftop sets, and leaving right before the encore ends.',
    sharedEvent: 'Aqua Sundays',
    venue: 'The Bund, Pune',
    distance: '2 km away',
    profileRouteId: 'fallback-arya',
    tags: ['Afro house', 'Rooftops', 'Late dinner', 'Verified'],
    photos: [
      {
        id: 'arya-1',
        source: require('../../assets/images/attendees/arya.png'),
        caption: "Tonight's main character energy",
      },
      {
        id: 'arya-2',
        source: require('../../assets/images/attendees/riya.png'),
        caption: 'Me and my best friend at Aqua Sundays',
      },
      {
        id: 'arya-3',
        source: require('../../assets/images/attendees/anaya.png'),
        caption: 'Always near the front',
      },
    ],
    prompts: [
      {
        id: 'arya-p1',
        title: 'A non-negotiable for me is',
        answer: 'A DJ who knows how to build a set, not just drop beat after beat.',
      },
      {
        id: 'arya-p2',
        title: "I know it's a good set when",
        answer: "I haven't checked my phone in two hours.",
      },
      {
        id: 'arya-p3',
        title: "We'll get along if",
        answer: 'You know when to leave a party before it peaks.',
      },
    ],
  },
  {
    id: 'neil',
    name: 'Neil',
    age: 28,
    headline: 'Table host by accident, playlist critic by choice.',
    sharedEvent: 'Midnight Club',
    venue: 'District Club, Pune',
    distance: '4 km away',
    profileRouteId: 'fallback-neil',
    tags: ['VIP', 'Tech house', 'No drama', 'Tables'],
    photos: [
      {
        id: 'neil-1',
        source: require('../../assets/images/attendees/neil.png'),
        caption: 'Probably near the speaker stack',
      },
      {
        id: 'neil-2',
        source: require('../../assets/images/attendees/sam.png'),
        caption: 'Waiting for the drop',
      },
      {
        id: 'neil-3',
        source: require('../../assets/images/attendees/yash.png'),
        caption: 'Backstage pass perqs',
      },
    ],
    prompts: [
      {
        id: 'neil-p1',
        title: 'The hallmark of a good night out is',
        answer: 'Good lighting, clean bass, and enough space to actually move.',
      },
      {
        id: 'neil-p2',
        title: "I'll never shut up about",
        answer: 'How underrated the warmup DJs are compared to the headliners.',
      },
      {
        id: 'neil-p3',
        title: 'My simple pleasure',
        answer: 'A club that still respects crowd flow over VIP tables.',
      },
    ],
  },
  {
    id: 'riya',
    name: 'Riya',
    age: 25,
    headline: 'Here for sundowners, sharp fits, and people who actually read the invite.',
    sharedEvent: 'Velvet Nights',
    venue: 'Anjuna Beach, Goa',
    distance: '9 km away',
    profileRouteId: 'fallback-riya',
    tags: ['Sundowners', 'Bollywood edits', 'Goa weekends', 'Fashion'],
    photos: [
      {
        id: 'riya-1',
        source: require('../../assets/images/attendees/riya.png'),
        caption: 'Golden hour loyalist',
      },
      {
        id: 'riya-2',
        source: require('../../assets/images/attendees/isha.png'),
        caption: 'Post-set clarity',
      },
      {
        id: 'riya-3',
        source: require('../../assets/images/attendees/hira.png'),
        caption: 'Always matching the vibe',
      },
    ],
    prompts: [
      {
        id: 'riya-p1',
        title: 'My ideal night out involves',
        answer: 'Starting with a high-energy house set and ending with late night pizza.',
      },
      {
        id: 'riya-p2',
        title: 'Green flag I look for',
        answer: 'You actually RSVP and know the dress code.',
      },
      {
        id: 'riya-p3',
        title: 'I will fall for you if',
        answer: 'You hype the outfit and still make the reservation.',
      },
    ],
  },
];
