export type LifeMoment = {
  date: string;
  displayDateZh: string;
  displayDateEn: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  media: {
    type: 'image' | 'video';
    src: string;
    srcSet?: string;
    sizes?: string;
    poster?: string;
    width?: number;
    height?: number;
    altZh: string;
    altEn: string;
  };
};

export const lifeMoments: LifeMoment[] = [
  {
    date: '2026-05-29',
    displayDateZh: '2026年5月29日',
    displayDateEn: 'May 29, 2026',
    titleZh: '小熊帽子的午后',
    titleEn: 'A Soft Afternoon',
    descriptionZh: '工作和项目之外，生活里也有很小、很亮的锚点。',
    descriptionEn: 'A small, bright anchor outside code, projects, and shipping.',
    media: {
      type: 'image',
      src: '/media/life/2026-05-29-little-light.webp',
      srcSet:
        '/media/life/2026-05-29-little-light-560.webp 560w, /media/life/2026-05-29-little-light.webp 960w',
      sizes: '(max-width: 760px) calc(100vw - 48px), 420px',
      width: 960,
      height: 721,
      altZh: '穿着小熊帽子的生活照片',
      altEn: 'A warm everyday photo with a bear-eared hood',
    },
  },
];

export const getLifeMoments = () =>
  [...lifeMoments].sort((left, right) => right.date.localeCompare(left.date));
