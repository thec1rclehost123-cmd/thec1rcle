const baseEvents = [
  {
    id: "after-dark-az",
    title: "After Dark AZ: Mansion Party",
    date: "Fri, Nov 21",
    time: "7:00 PM - 1:00 AM",
    location: "Kalyani Nagar, Pune",
    host: "@after_dark_india",
    category: "Trending",
    image: "/events/neon-nights.jpg",
    gradient: ["#3d0d17", "#050505"],
    description: "A multi-floor takeover with indie DJs, projection domes, and mango lassi cocktails.",
    guests: ["Anaya", "Rohit", "Mira", "Kabir", "Zoya", "Rhea"],
    gallery: [
      "/events/neon-nights.jpg",
      "/events/genz-night.svg",
      "/events/disclosure.svg",
      "/events/lofi-house.svg",
      "/events/palm-tree.svg",
      "/events/art-bazaar.svg"
    ]
  },
  {
    id: "campus-cookout",
    title: "Campus Cookout Day Party",
    date: "Sat, Nov 22",
    time: "4:00 PM - 9:00 PM",
    location: "FC Road",
    host: "@campuscollective",
    category: "This Week",
    image: "/events/poolside-vibes.jpg",
    gradient: ["#12322a", "#050505"],
    description: "BBQ smoke, vinyl selectors, and art stalls meet on FC Road for the first summer cookout.",
    guests: ["Yash", "Ishika", "Sameer"],
    gallery: [
      "/events/poolside-vibes.jpg",
      "/events/cypher.svg",
      "/events/select-art.svg",
      "/events/select-activities.svg",
      "/events/art-bazaar.svg",
      "/events/lower-east.svg"
    ]
  },
  {
    id: "lofi-rooftop",
    title: "Lo-Fi Rooftop Flow",
    date: "Sun, Nov 23",
    time: "6:00 PM - 10:00 PM",
    location: "Baner, Pune",
    host: "@quiethours",
    category: "Nearby",
    image: "/events/rooftop-jazz.jpg",
    gradient: ["#152640", "#04070c"],
    description: "Sunset breathwork, crocheted blankets, and dusty beat tapes.",
    guests: ["Rahul", "Gia", "Nikhil"],
    gallery: [
      "/events/rooftop-jazz.jpg",
      "/events/yoga.svg",
      "/events/nirvana.svg",
      "/events/genz-night.svg",
      "/events/campus.svg",
      "/events/palm-tree.svg"
    ]
  },
  {
    id: "genz-night",
    title: "GEN Z NIGHT KP",
    date: "Every Friday",
    time: "10:00 PM onward",
    location: "Koregaon Park",
    host: "@c1rcle.nights",
    category: "Trending",
    image: "/events/techno-bunker.jpg",
    gradient: ["#37052e", "#06040b"],
    description: "A midnight bazaar with DJs, merch, and mocktails.",
    guests: ["Lara", "Harsh", "Reva", "Neel"],
    gallery: [
      "/events/techno-bunker.jpg",
      "/events/holi-edit.svg",
      "/events/lofi-house.svg",
      "/events/cypher.svg",
      "/events/yoga.svg",
      "/events/lower-east.svg"
    ]
  },
  {
    id: "diy-art-basement",
    title: "DIY Art Basement",
    date: "Thu, Dec 01",
    time: "8:00 PM",
    location: "Viman Nagar",
    host: "@underground.studio",
    category: "Trending",
    image: "/events/art-collective.jpg",
    gradient: ["#20130b", "#050505"],
    description: "Immersive AV installations and spoken word loops.",
    guests: ["Kaya", "Shlok", "Arjun"],
    gallery: [
      "/events/art-collective.jpg",
      "/events/select-art.svg",
      "/events/interview-fashion.svg",
      "/events/interview-crew.svg",
      "/events/disclosure.svg",
      "/events/lofi-house.svg"
    ]
  },
  {
    id: "riverfront-fit",
    title: "Riverfront Breathwork",
    date: "Wed, Nov 26",
    time: "7:00 AM",
    location: "Mula Riverwalk",
    host: "@flowclub",
    category: "Nearby",
    image: "/events/urban-oasis.jpg",
    gradient: ["#0a2b1f", "#030a08"],
    description: "Morning run with chai finishers.",
    guests: ["Dev", "Anvi", "Mohan"],
    gallery: [
      "/events/urban-oasis.jpg",
      "/events/palm-tree.svg",
      "/events/campus.svg",
      "/events/holi-edit.svg",
      "/events/nirvana.svg",
      "/events/art-bazaar.svg"
    ]
  },
  {
    id: "house-of-synth",
    title: "House of Synth",
    date: "Sat, Dec 05",
    time: "9:00 PM",
    location: "Magarpatta",
    host: "@pixelrave",
    category: "Trending",
    image: "/events/electric-dreams.jpg",
    description: "Electric jam with analog synth labs and VJ walls.",
    guests: ["Neha", "Vik", "Ritu"],
    gallery: [
      "/events/electric-dreams.jpg",
      "/events/genz-night.svg",
      "/events/lofi-house.svg",
      "/events/campus.svg",
      "/events/lower-east.svg",
      "/events/yoga.svg"
    ]
  },
  {
    id: "secret-brunch",
    title: "Secret Brunch Club",
    date: "Sun, Nov 30",
    time: "11:00 AM",
    location: "Yerawada",
    host: "@suppertables",
    category: "This Week",
    image: "/events/sunday-soul.jpg",
    description: "Goa pop-up chefs and analog cams.",
    guests: ["Sara", "Josh", "Rehaan"],
    gallery: [
      "/events/sunday-soul.jpg",
      "/events/art-bazaar.svg",
      "/events/campus.svg",
      "/events/holi-edit.svg",
      "/events/yoga.svg",
      "/events/palm-tree.svg"
    ]
  },
  {
    id: "cypher-sundays",
    title: "After Class Cypher",
    date: "Thursdays",
    time: "8:00 PM",
    location: "FC Road",
    host: "@thelab",
    category: "This Week",
    image: "/events/indie-jam.jpg",
    description: "Dance crews and analog photo booths.",
    guests: ["Ved", "Maya", "Ansh"],
    gallery: [
      "/events/indie-jam.jpg",
      "/events/holi-edit.svg",
      "/events/lower-east.svg",
      "/events/genz-night.svg",
      "/events/disclosure.svg",
      "/events/palm-tree.svg"
    ]
  },
  {
    id: "lower-east-block",
    title: "Lower East Block Fest",
    date: "Fri, Dec 12",
    time: "5:00 PM",
    location: "New Friends Colony",
    host: "@blockparade",
    category: "Nearby",
    image: "/events/vintage-market.jpg",
    description: "Graffiti parades, house music, and thrift capsules.",
    guests: ["Ira", "Veer", "Krish"],
    gallery: [
      "/events/vintage-market.jpg",
      "/events/genz-night.svg",
      "/events/art-bazaar.svg",
      "/events/campus.svg",
      "/events/palm-tree.svg",
      "/events/interview-crew.svg"
    ]
  },
  {
    id: "nirvana-night",
    title: "Tribute to One Direction",
    date: "Sun, Nov 23",
    time: "8:00 PM",
    location: "High Spirits",
    host: "@no.direction",
    category: "Trending",
    image: "/events/midnight-run.jpg",
    description: "A tribute to the greatest boy band of our generation.",
    guests: ["Sid", "Rupal", "Aditya"],
    gallery: [
      "/events/midnight-run.jpg",
      "/events/lofi-house.svg",
      "/events/cypher.svg",
      "/events/art-bazaar.svg",
      "/events/palm-tree.svg",
      "/events/select-art.svg"
    ]
  },
  {
    id: "sunset-social",
    title: "Sunset Social",
    date: "Fri, Nov 28",
    time: "6:00 PM",
    location: "Pashan Ridge",
    host: "@ceremonies.in",
    category: "This Week",
    image: "/events/comedy-club.jpg",
    description: "Sunset acoustic sets and film swaps.",
    guests: ["Milan", "Pari", "Ishan"],
    gallery: [
      "/events/comedy-club.jpg",
      "/events/yoga.svg",
      "/events/holi-edit.svg",
      "/events/nirvana.svg",
      "/events/genz-night.svg",
      "/events/art-bazaar.svg"
    ]
  },
  {
    id: "honesty-lab",
    title: "Honesty Lab: Stop Performing",
    date: "Mon, Dec 08",
    time: "6:30 PM",
    location: "KP Annex",
    host: "@lifeshop",
    category: "Trending",
    image: "/events/art-collective.jpg",
    gradient: ["#274070", "#05060f"],
    description: "Intention workshop with interactive art.",
    guests: ["Kavya", "Tarun", "Ela"],
    gallery: [
      "/events/art-collective.jpg",
      "/events/holi-edit.svg",
      "/events/genz-night.svg",
      "/events/lofi-house.svg",
      "/events/campus.svg",
      "/events/palm-tree.svg"
    ]
  },
  {
    id: "midnight-market",
    title: "Midnight Market",
    date: "Sat, Dec 20",
    time: "8:00 PM",
    location: "Shivajinagar Warehouse",
    host: "@gridlock",
    category: "Nearby",
    image: "/events/vintage-market.jpg",
    gradient: ["#1b1128", "#040306"],
    description: "Thrift stalls, lowriders, and halo candy.",
    guests: ["Naina", "Ari", "Dev"],
    gallery: [
      "/events/vintage-market.jpg",
      "/events/select-activities.svg",
      "/events/interview-fashion.svg",
      "/events/disclosure.svg",
      "/events/yoga.svg",
      "/events/genz-night.svg"
    ]
  },
  {
    id: "neon-horizon-gala",
    title: "Neon Horizon Gala",
    date: "Sat, Dec 27",
    time: "8:00 PM",
    location: "Sky Deck, Pune",
    host: "@horizon.events",
    category: "Trending",
    image: "/events/electric-dreams.jpg",
    gradient: ["#4f46e5", "#0f172a"],
    description: "An exclusive black-tie affair with a neon twist. Unlimited cocktails and gourmet dining.",
    guests: ["Aria", "Leo", "Zara"],
    gallery: [
      "/events/electric-dreams.jpg",
      "/events/neon-nights.jpg",
      "/events/art-bazaar.svg",
      "/events/disclosure.svg",
      "/events/palm-tree.svg",
      "/events/genz-night.svg"
    ]
  }
];

const metadataById = {
  "after-dark-az": {
    city: "Pune, IN",
    venue: "Kalyani Nagar Mansion",
    eventType: "clubs",
    tags: ["Clubs", "Nightlife", "After hours", "College party"],
    startDateTime: "2025-11-21T19:00:00+05:30",
    endDateTime: "2025-11-22T01:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 1599,
    stats: { heatScore: 94, rsvpsLast48h: 184, views: 2380, saves: 402, shares: 118, createdAt: "2025-10-12T09:00:00+05:30" },
    tickets: [
      {
        id: "after-ga",
        name: "General Admission",
        price: 1599,
        currency: "INR",
        quantity: 220,
        remaining: 32,
        description: "All dance floors plus rooftop access.",
        minPerOrder: 1,
        maxPerOrder: 4,
        salesStart: "2025-10-10T10:00:00+05:30",
        salesEnd: "2025-11-21T17:00:00+05:30"
      },
      {
        id: "after-vip",
        name: "VIP Sky Booth",
        price: 3499,
        currency: "INR",
        quantity: 24,
        remaining: 5,
        description: "Private booth, host concierge, and bottle service.",
        minPerOrder: 2,
        maxPerOrder: 8,
        salesStart: "2025-10-10T10:00:00+05:30",
        salesEnd: "2025-11-21T18:00:00+05:30"
      },
      {
        id: "after-rsvp",
        name: "Lantern RSVP",
        price: 0,
        currency: "INR",
        quantity: 60,
        remaining: 12,
        description: "Guestlist RSVP · pay at door",
        rsvpOnly: true
      }
    ]
  },
  "campus-cookout": {
    city: "Pune, IN",
    venue: "FC Road Courtyard",
    eventType: "day-parties",
    tags: ["Day parties", "College", "Cookout"],
    startDateTime: "2025-11-22T16:00:00+05:30",
    endDateTime: "2025-11-22T21:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 299,
    stats: { heatScore: 76, rsvpsLast48h: 126, views: 1640, saves: 230, shares: 72, createdAt: "2025-10-15T08:30:00+05:30" },
    tickets: [
      {
        id: "cookout-student",
        name: "Student Crew",
        price: 299,
        currency: "INR",
        quantity: 150,
        remaining: 34,
        description: "Bring valid college ID at gate.",
        minPerOrder: 1,
        maxPerOrder: 6
      },
      {
        id: "cookout-ga",
        name: "Early Entry",
        price: 499,
        currency: "INR",
        quantity: 180,
        remaining: 88,
        description: "Entry plus tastings from all pop up kitchens."
      },
      {
        id: "cookout-rsvp",
        name: "Community RSVP",
        price: 0,
        currency: "INR",
        quantity: 90,
        remaining: 38,
        description: "RSVP only · Pay for plates on-site",
        rsvpOnly: true
      }
    ]
  },
  "lofi-rooftop": {
    city: "Pune, IN",
    venue: "Baner Terrace Loft",
    eventType: "wellness",
    tags: ["Wellness", "Rooftop", "Breathwork"],
    startDateTime: "2025-11-23T18:00:00+05:30",
    endDateTime: "2025-11-23T22:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 699,
    stats: { heatScore: 68, rsvpsLast48h: 92, views: 1120, saves: 180, shares: 52, createdAt: "2025-10-18T09:30:00+05:30" },
    tickets: [
      {
        id: "lofi-flow",
        name: "Sunset Flow",
        price: 699,
        currency: "INR",
        quantity: 120,
        remaining: 18,
        description: "Breathwork + live beat tape listening.",
        minPerOrder: 1,
        maxPerOrder: 3
      },
      {
        id: "lofi-duo",
        name: "Bring A Friend",
        price: 1099,
        currency: "INR",
        quantity: 80,
        remaining: 12,
        description: "Duo mat zone with herbal tea service."
      }
    ]
  },
  "genz-night": {
    city: "Pune, IN",
    venue: "Koregaon Park Social",
    eventType: "clubs",
    tags: ["Clubs", "Late night", "Pop edits"],
    startDateTime: "2025-11-29T22:00:00+05:30",
    endDateTime: "2025-11-30T03:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 899,
    stats: { heatScore: 89, rsvpsLast48h: 158, views: 2100, saves: 345, shares: 118, createdAt: "2025-10-05T10:00:00+05:30" },
    tickets: [
      {
        id: "genz-floor",
        name: "Floor Pass",
        price: 899,
        currency: "INR",
        quantity: 250,
        remaining: 110,
        description: "Standing access + merch drop pin."
      },
      {
        id: "genz-crew",
        name: "Crew Table",
        price: 2500,
        currency: "INR",
        quantity: 20,
        remaining: 6,
        description: "Reserved table for 4 with mocktails.",
        minPerOrder: 4,
        maxPerOrder: 6
      }
    ]
  },
  "diy-art-basement": {
    city: "Pune, IN",
    venue: "Underground Studio",
    eventType: "live-music",
    tags: ["Live music", "Live art", "Spoken word", "Indie"],
    startDateTime: "2025-12-01T20:00:00+05:30",
    endDateTime: "2025-12-02T00:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "link",
    startingPrice: 699,
    stats: { heatScore: 73, rsvpsLast48h: 102, views: 1400, saves: 180, shares: 55, createdAt: "2025-10-20T11:00:00+05:30" },
    tickets: [
      {
        id: "diy-floor",
        name: "Gallery Pass",
        price: 699,
        currency: "INR",
        quantity: 140,
        remaining: 64,
        description: "Basement gallery plus zine lab."
      },
      {
        id: "diy-circle",
        name: "Artist Circle",
        price: 1299,
        currency: "INR",
        quantity: 30,
        remaining: 18,
        description: "Front row pillows + meet the visualists."
      }
    ]
  },
  "riverfront-fit": {
    city: "Pune, IN",
    venue: "Mula Riverwalk",
    eventType: "wellness",
    tags: ["Wellness", "Run club", "Community", "Sunrise"],
    startDateTime: "2025-11-26T07:00:00+05:30",
    endDateTime: "2025-11-26T09:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 0,
    stats: { heatScore: 61, rsvpsLast48h: 90, views: 880, saves: 140, shares: 40, createdAt: "2025-10-08T07:30:00+05:30" },
    tickets: [
      {
        id: "river-rsvp",
        name: "Community RSVP",
        price: 0,
        currency: "INR",
        quantity: 220,
        remaining: 150,
        description: "Guided breathwork and chai finishers.",
        rsvpOnly: true
      }
    ]
  },
  "house-of-synth": {
    city: "Mumbai, IN",
    location: "Lower Parel Warehouse",
    venue: "Magnetic Fields Lab",
    eventType: "concerts",
    tags: ["Live music", "Live electronica", "Analog synths", "Clubs"],
    startDateTime: "2025-12-05T21:00:00+05:30",
    endDateTime: "2025-12-06T01:30:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 1299,
    stats: { heatScore: 82, rsvpsLast48h: 132, views: 1750, saves: 260, shares: 82, createdAt: "2025-10-22T10:00:00+05:30" },
    tickets: [
      {
        id: "synth-floor",
        name: "Arena Pass",
        price: 1299,
        currency: "INR",
        quantity: 180,
        remaining: 0,
        description: "Standing room with VJ pit view."
      },
      {
        id: "synth-lab",
        name: "Lab Deck",
        price: 2499,
        currency: "INR",
        quantity: 40,
        remaining: 0,
        description: "Behind the booth walkthrough.",
        minPerOrder: 2,
        maxPerOrder: 4
      }
    ]
  },
  "secret-brunch": {
    city: "Pune, IN",
    venue: "Yerawada Courtyard",
    eventType: "house-parties",
    tags: ["House parties", "Brunch", "Chef pop up", "House party"],
    startDateTime: "2025-11-30T11:00:00+05:30",
    endDateTime: "2025-11-30T15:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "password",
    passwordCode: "TABLE22",
    startingPrice: 0,
    stats: { heatScore: 67, rsvpsLast48h: 94, views: 1200, saves: 150, shares: 46, createdAt: "2025-10-18T15:30:00+05:30" },
    tickets: [
      {
        id: "brunch-rsvp",
        name: "RSVP Seat",
        price: 0,
        currency: "INR",
        quantity: 80,
        remaining: 22,
        description: "Includes chai welcome and access to chef stalls.",
        rsvpOnly: true
      },
      {
        id: "brunch-chef",
        name: "Chef’s Table",
        price: 1899,
        currency: "INR",
        quantity: 20,
        remaining: 4,
        description: "Six course tasting by Goa pop up chefs."
      }
    ]
  },
  "cypher-sundays": {
    city: "Pune, IN",
    venue: "FC Road Studios",
    eventType: "college",
    tags: ["College parties", "College crews", "Dance battle", "Hip hop"],
    startDateTime: "2025-11-28T20:00:00+05:30",
    endDateTime: "2025-11-28T23:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 299,
    stats: { heatScore: 65, rsvpsLast48h: 110, views: 980, saves: 140, shares: 44, createdAt: "2025-10-24T12:00:00+05:30" },
    tickets: [
      {
        id: "cypher-crew",
        name: "Crew Entry",
        price: 299,
        currency: "INR",
        quantity: 60,
        remaining: 12,
        description: "Includes slot in open cypher battle."
      },
      {
        id: "cypher-gallery",
        name: "Gallery Seat",
        price: 449,
        currency: "INR",
        quantity: 90,
        remaining: 38,
        description: "Stadium seating + photo booth token."
      }
    ]
  },
  "lower-east-block": {
    city: "New Delhi, IN",
    location: "New Friends Colony, New Delhi",
    venue: "The Block Parade",
    eventType: "festivals",
    tags: ["Festivals", "Block party", "Graffiti", "House music"],
    startDateTime: "2025-12-12T17:00:00+05:30",
    endDateTime: "2025-12-13T00:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 1499,
    stats: { heatScore: 72, rsvpsLast48h: 108, views: 1600, saves: 200, shares: 60, createdAt: "2025-10-25T10:30:00+05:30" },
    tickets: [
      {
        id: "block-pass",
        name: "Block Pass",
        price: 1499,
        currency: "INR",
        quantity: 240,
        remaining: 98,
        description: "Day pass + skate demos."
      },
      {
        id: "block-raver",
        name: "Night Circuit",
        price: 1999,
        currency: "INR",
        quantity: 160,
        remaining: 44,
        description: "Late night warehouse stage until 2 AM."
      }
    ]
  },
  "nirvana-night": {
    city: "Pune, IN",
    venue: "High Spirits",
    eventType: "concerts",
    tags: ["Concerts", "Pop", "Tribute night", "One Direction"],
    startDateTime: "2025-11-23T20:00:00+05:30",
    endDateTime: "2025-11-23T23:30:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 799,
    stats: { heatScore: 100, rsvpsLast48h: 118, views: 1500, saves: 210, shares: 62, createdAt: "2025-10-28T12:00:00+05:30" },
    tickets: [
      {
        id: "nirvana-floor",
        name: "Floor Pass",
        price: 799,
        currency: "INR",
        quantity: 200,
        remaining: 84,
        description: "Standing pass with zine bundle."
      },
      {
        id: "nirvana-balcony",
        name: "Balcony Booth",
        price: 1499,
        currency: "INR",
        quantity: 30,
        remaining: 8,
        description: "Balcony stools + drink combo.",
        minPerOrder: 2,
        maxPerOrder: 4
      }
    ]
  },
  "sunset-social": {
    city: "Pune, IN",
    venue: "Pashan Ridge",
    eventType: "day-parties",
    tags: ["Day parties", "Sunset", "Acoustic", "Film swap"],
    startDateTime: "2025-11-28T18:00:00+05:30",
    endDateTime: "2025-11-28T21:30:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 0,
    stats: { heatScore: 64, rsvpsLast48h: 105, views: 1300, saves: 170, shares: 55, createdAt: "2025-10-18T08:00:00+05:30" },
    tickets: [
      {
        id: "sunset-rsvp",
        name: "Sunset RSVP",
        price: 0,
        currency: "INR",
        quantity: 150,
        remaining: 60,
        description: "Bring your disposable for the film swap.",
        rsvpOnly: true
      }
    ]
  },
  "honesty-lab": {
    city: "Pune, IN",
    venue: "KP Annex Studio",
    eventType: "workshops",
    tags: ["Workshop", "Intention", "Community"],
    startDateTime: "2025-12-08T18:30:00+05:30",
    endDateTime: "2025-12-08T21:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "password",
    passwordCode: "HONESTY",
    startingPrice: 399,
    stats: { heatScore: 58, rsvpsLast48h: 80, views: 960, saves: 180, shares: 42, createdAt: "2025-10-26T13:30:00+05:30" },
    tickets: [
      {
        id: "honesty-circle",
        name: "Circle Seat",
        price: 399,
        currency: "INR",
        quantity: 60,
        remaining: 10,
        description: "Guided prompts + zine kit."
      }
    ]
  },
  "midnight-market": {
    city: "Bangalore, IN",
    location: "Indiranagar Yard, Bangalore",
    venue: "Neon Bazaar",
    eventType: "markets",
    tags: ["Markets", "Night market", "Thrift", "Car meet"],
    startDateTime: "2025-12-20T20:00:00+05:30",
    endDateTime: "2025-12-21T02:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 499,
    stats: { heatScore: 75, rsvpsLast48h: 140, views: 1800, saves: 220, shares: 78, createdAt: "2025-10-30T11:30:00+05:30" },
    tickets: [
      {
        id: "market-pass",
        name: "Market Pass",
        price: 499,
        currency: "INR",
        quantity: 260,
        remaining: 122,
        description: "Night market access + thrift tokens."
      },
      {
        id: "market-crew",
        name: "Crew Add-On",
        price: 899,
        currency: "INR",
        quantity: 120,
        remaining: 52,
        description: "Includes access to the rooftop cypher."
      }
    ]
  },
  "neon-horizon-gala": {
    city: "Pune, IN",
    venue: "Sky Deck, Viman Nagar",
    eventType: "gala",
    tags: ["Gala", "Black Tie", "Cocktails", "VIP"],
    startDateTime: "2025-12-27T20:00:00+05:30",
    endDateTime: "2025-12-28T02:00:00+05:30",
    timezone: "Asia/Kolkata",
    visibility: "public",
    startingPrice: 2499,
    stats: { heatScore: 98, rsvpsLast48h: 210, views: 3500, saves: 560, shares: 190, createdAt: "2025-11-01T10:00:00+05:30" },
    tickets: [
      {
        id: "gala-ga",
        name: "General Access",
        price: 2499,
        currency: "INR",
        quantity: 300,
        remaining: 150,
        description: "Entry + 2 premium cocktails."
      },
      {
        id: "gala-vip",
        name: "VIP Lounge",
        price: 5999,
        currency: "INR",
        quantity: 50,
        remaining: 12,
        description: "Unlimited F&B + Private Lounge Access.",
        minPerOrder: 1,
        maxPerOrder: 4
      },
      {
        id: "gala-table",
        name: "VVIP Table (6 Pax)",
        price: 25000,
        currency: "INR",
        quantity: 10,
        remaining: 3,
        description: "Reserved table for 6 with bottle service.",
        minPerOrder: 1,
        maxPerOrder: 1
      }
    ]
  }
};

const slugify = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-/, "").replace(/-$/, "");

const inferCity = (location = "") => {
  if (!location) return "Pune, IN";
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 1]}, IN`;
  return `${parts[0] || "Pune"}, IN`;
};

const summarizeTickets = (tickets = []) => {
  if (!tickets.length) {
    return {
      minPrice: 0,
      totalCapacity: 0,
      totalRemaining: 0,
      soldOut: false,
      fewSpotsLeft: false
    };
  }

  const summary = tickets.reduce(
    (acc, ticket) => {
      const capacity = Number(ticket.capacity ?? ticket.quantity) || 0;
      const remaining = Math.max(Number(ticket.remaining ?? ticket.quantity) || 0, 0);
      const price = Number(ticket.price) || 0;

      return {
        minPrice: Math.min(acc.minPrice, price),
        totalCapacity: acc.totalCapacity + capacity,
        totalRemaining: acc.totalRemaining + remaining
      };
    },
    { minPrice: Infinity, totalCapacity: 0, totalRemaining: 0 }
  );

  const soldOut = summary.totalRemaining <= 0;
  const fewSpotsLeft = !soldOut && summary.totalCapacity > 0 && summary.totalRemaining / summary.totalCapacity <= 0.2;

  return {
    minPrice: Number.isFinite(summary.minPrice) ? summary.minPrice : 0,
    totalCapacity: summary.totalCapacity,
    totalRemaining: summary.totalRemaining,
    soldOut,
    fewSpotsLeft
  };
};

const formatPriceLabel = (price) => {
  if (price <= 0) return "Free RSVP";
  const formatter = new Intl.NumberFormat("en-IN");
  return `Starts at ₹${formatter.format(price)}`;
};

const toIsoString = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

const applyMetadata = (event) => {
  const metadata = metadataById[event.id] || {};
  const ticketsSource = Array.isArray(metadata.tickets)
    ? metadata.tickets
    : Array.isArray(event.tickets)
      ? event.tickets
      : [];
  const tickets = ticketsSource.map((ticket, index) => ({
    ...ticket,
    id: ticket.id || `${event.id}-ticket-${index + 1}`
  }));
  const ticketSummary = summarizeTickets(tickets);
  const startPrice = typeof metadata.startingPrice === "number" ? metadata.startingPrice : ticketSummary.minPrice;
  const stats = metadata.stats || event.stats || {};
  const startDateTime = metadata.startDateTime || event.startDateTime || "";
  const endDateTime = metadata.endDateTime || event.endDateTime || startDateTime;
  const startDate = metadata.startDate || toIsoString(startDateTime);
  const endDate = metadata.endDate || toIsoString(endDateTime);
  const createdAt = metadata.createdAt || stats.createdAt || startDate || "2025-10-01T10:00:00+05:30";
  const updatedAt = metadata.updatedAt || createdAt;
  const priceRange = metadata.priceRange || {
    min: startPrice,
    max: typeof metadata.maxPrice === "number" ? metadata.maxPrice : startPrice,
    currency: "INR"
  };

  return {
    ...event,
    ...metadata,
    location: metadata.location || event.location,
    city: metadata.city || event.city || inferCity(metadata.location || event.location),
    citySlug: slugify(metadata.city || inferCity(metadata.location || event.location)),
    eventType: metadata.eventType || event.eventType || "clubs",
    tags: metadata.tags || event.tags || [],
    startDateTime,
    endDateTime,
    startDate,
    endDate,
    timezone: metadata.timezone || event.timezone || "Asia/Kolkata",
    visibility: metadata.visibility || event.visibility || "public",
    passwordCode: metadata.passwordCode || event.passwordCode || "",
    tickets,
    stats: {
      heatScore: typeof stats.heatScore === "number" ? stats.heatScore : 60,
      rsvpsLast48h: stats.rsvpsLast48h ?? 28,
      rsvps: stats.rsvps ?? stats.rsvpsLast48h ?? 60,
      views: stats.views ?? 620,
      saves: stats.saves ?? 54,
      shares: stats.shares ?? 18,
      createdAt
    },
    createdAt,
    updatedAt,
    startingPrice: startPrice,
    isFree: metadata.isFree ?? startPrice <= 0,
    priceLabel: metadata.priceLabel || formatPriceLabel(startPrice),
    priceRange,
    inventory: {
      total: ticketSummary.totalCapacity,
      remaining: ticketSummary.totalRemaining,
      soldOut: metadata.soldOut ?? ticketSummary.soldOut,
      fewSpotsLeft: metadata.fewSpotsLeft ?? ticketSummary.fewSpotsLeft
    }
  };
};

export const events = baseEvents.map(applyMetadata);

export function getEventById(id) {
  return events.find((event) => event.id === id);
}
