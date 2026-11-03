import type { Section } from "./types";

export const SECTIONS: Section[] = [
  {
    titleKey: "fn.section.study",
    items: [
      {
        icon: "bar-chart-outline",
        labelKey: "fn.app.grade",
        color: "#8b5cf6",
        route: "/grade",
        filter: {
          requireBound: true,
          allow: [{ eduLevels: ["本科"] }],
        },
      },
      {
        icon: "calendar-clear-outline",
        labelKey: "fn.app.exam",
        color: "#3b82f6",
        route: "/exam",
        filter: {
          requireBound: true,
          allow: [{ eduLevels: ["本科"] }],
        },
      },
      {
        icon: "book-outline",
        labelKey: "fn.app.classroom",
        color: "#0d9488",
        uri: "https://classroom-iwut.tokenteam.net",
        lan: false,
      },
      {
        icon: "easel-outline",
        labelKey: "fn.app.icSpace",
        color: "#06b6d4",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fzw.whut.edu.cn%2Frem%2Fstatic%2Fsso%2FwebOAuthRed",
        lan: true,
      },
      {
        icon: "library-outline",
        labelKey: "fn.app.library",
        color: "#3b82f6",
        uri: "https://library-info-iwut.tokenteam.net",
        lan: true,
      },
    ],
  },
  {
    titleKey: "fn.section.life",
    items: [
      {
        icon: "card-outline",
        labelKey: "fn.app.card",
        color: "#10b981",
        uri: "https://cardcare-iwut.tokenteam.net",
        lan: false,
      },
      {
        icon: "flash-outline",
        labelKey: "fn.app.elec",
        color: "#eab308",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=http://nyyzf.whut.edu.cn/MobileWebOnlineHall/#/",
        lan: false,
      },
      {
        icon: "wifi-outline",
        labelKey: "fn.app.netPay",
        color: "#2563eb",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=http://cwsf.whut.edu.cn/netdetails515N023",
        lan: false,
      },
    ],
  },
  {
    titleKey: "fn.section.info",
    items: [
      {
        icon: "newspaper-outline",
        labelKey: "fn.app.campusNews",
        color: "#f97316",
        uri: "http://i.whut.edu.cn",
        lan: true,
      },
    ],
  },
];
