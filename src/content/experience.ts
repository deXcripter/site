export type Entry = {
  title: string;
  org: string;
  period: string;
  start: string;
  body: string[];
};

export const work: Entry[] = [
  {
    title: "Software Engineer",
    org: "SEORCE",
    period: "Jul 2025 — Present",
    start: "2025-07",
    body: [
      "Before SEORCE I was mostly in crypto: smart contracts, audits, that world.",
      "I took the job without being sure it was for me. The team shipped fast, and I figured I'd stay through the year then move on. Working on SEO tools changed my mind. Once I started looking at how crawlers, rankings, and AI search actually work, I got hooked.",
      "I stayed. That role is where I decided to go all in on SEO and the tools around it.",
    ],
  },
  {
    title: "Lead Backend Engineer",
    org: "myBigshelf",
    period: "Feb 2024",
    start: "2024-02",
    body: [
      "myBigshelf is a platform for book lovers to discover and share their favorite books.",
      "My first experience working with a team of developers, and we were all students at the time. I was responsible for the backend of the platform, and I had to learn a lot about the different technologies that will be used to build the platform.",
    ],
  },
  {
    title: "Intern",
    org: "Promild Tech Limited",
    period: "Sep 2023",
    start: "2023-09",
    body: [
      "On paper, I was an intern at Promild Tech Limited, a 6-month program through school. In reality, I wasn't being challenged, so I left early and focused on self learning instead.",
      "During this period, I learned a lot about JavaScript, React, Node.js, MongoDB and other related web technologies. I also built a CRUD application, though I never finished it since my internship period ended before I could. Still, that project ended up being the reason I got my first shot as a developer at Bigshelf.",
    ],
  },
];

export const education: Entry[] = [
  {
    title: "B.Sc. Computer Science",
    org: "Nnamdi Azikiwe University, Nigeria",
    period: "May 2021 — Mar 2025",
    start: "2021-05",
    body: [
      "Always been a fan of computers, grew up playing a lot of PC games. That got me interested, so I applied for computer science and got into the university.",
      "Wrapped up my computer science degree at Nnamdi Azikiwe University, Nigeria.",
    ],
  },
];

export const projects = [
  {
    name: "SEORCE",
    period: "2025 — now",
    summary:
      "SEORCE helps brands see how they show up in Google, Bing, and AI search tools like ChatGPT, Perplexity, and Gemini.",
    details: [
      { label: "Role", value: "Software Engineer" },
      { label: "Focus", value: "Technical SEO, crawl work, search traffic, AI search analytics" },
      { label: "Surface", value: "Google, Bing, ChatGPT, Perplexity, Gemini" },
    ],
  },
  {
    name: "myBigshelf",
    period: "2024",
    summary: "A platform for book lovers to discover and share their favorite books, built by a team of students.",
    details: [
      { label: "Role", value: "Lead Backend Engineer" },
      { label: "Focus", value: "Backend architecture and infrastructure" },
      { label: "Team", value: "Student developers" },
    ],
  },
];
