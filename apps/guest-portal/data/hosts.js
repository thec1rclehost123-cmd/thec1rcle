export const hosts = {
  "@after_dark_india": {
    name: "After Dark India",
    avatar: "/events/genz-night.svg",
    followers: "18.4K",
    bio: "Nightlife curators building the late-night economy across Pune and Mumbai.",
    location: "Pune, IN"
  },
  "@campuscollective": {
    name: "Campus Collective",
    avatar: "/events/campus.svg",
    followers: "9.2K",
    bio: "Day parties, cookouts, and art walks for India’s campus crowd.",
    location: "Pune, IN"
  },
  "@quiethours": {
    name: "Quiet Hours",
    avatar: "/events/lofi-house.svg",
    followers: "6.1K",
    bio: "Mindful rooftops, lofi flows, and slow-living residencies.",
    location: "Baner, Pune"
  },
  "@underground.studio": {
    name: "Underground Studio",
    avatar: "/events/art-bazaar.svg",
    followers: "12.1K",
    bio: "Immersive AV clubs blending art, poetry, and analog synth jams.",
    location: "Viman Nagar, Pune"
  }
};

export const getHostProfile = (handle) => {
  return hosts[handle] || {
    name: handle?.replace("@", "") || "Guest Host",
    avatar: "/events/holi-edit.svg",
    followers: "1.2K",
    bio: "Building community nights across India.",
    location: "Pune, IN"
  };
};
