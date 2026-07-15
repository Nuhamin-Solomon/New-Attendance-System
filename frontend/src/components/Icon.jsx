const paths = {
  dashboard: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  attendance: "M8 2v4m8-4v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 10 2 2 4-4",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.7 7.7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a8.4 8.4 0 0 0-2-1.2L14.5 3h-5l-.4 2.5a8.4 8.4 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a8.4 8.4 0 0 0 2 1.2l.4 2.5h5l.4-2.5a8.4 8.4 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z",
  sync: "M20 11a8.1 8.1 0 0 0-14.9-3M4 4v4h4m-4 5a8.1 8.1 0 0 0 14.9 3M20 20v-4h-4",
  logout: "M10 17l5-5-5-5m5 5H3m10-8V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-1",
  search: "m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  building: "M3 21h18M5 21V5l7-3 7 3v16M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2",
  database: "M20 6c0 2.2-3.6 4-8 4s-8-1.8-8-4 3.6-4 8-4 8 1.8 8 4Zm0 0v6c0 2.2-3.6 4-8 4s-8-1.8-8-4V6m16 6v6c0 2.2-3.6 4-8 4s-8-1.8-8-4v-6",
  plus: "M12 5v14M5 12h14",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
};

export default function Icon({ name, size = 18, stroke = true }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke ? "none" : "currentColor"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
