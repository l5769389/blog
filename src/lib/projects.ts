export const portfolioProjects = [
  {
    id: 'respira-scope',
    name: 'RespiraScope',
    area: 'Respiration / Signal Processing',
    statusZh: '代表项目',
    statusEn: 'Selected',
    descriptionZh: '呼吸信号采集、实时滤波、峰谷识别、BPM 计算、记录复盘和 Web Console 展示工具。',
    descriptionEn:
      'A respiration signal tool for acquisition, filtering, peak detection, BPM, recording review, and Web Console monitoring.',
    introZh:
      'RespiraScope 面向设备联调、算法验证和实时监测演示，把呼吸传感器数据从采集、滤波、事件识别到 Web Console 可视化串成完整链路。',
    introEn:
      'RespiraScope connects respiration sensor acquisition, filtering, event detection, and Web Console visualization for device debugging and algorithm validation.',
    image: '/images/respira-scope/breath-monitor.png',
    tags: ['FastAPI', 'Socket.IO', 'Signal Processing', 'Web Console'],
    tech: ['FastAPI', 'Socket.IO', 'Signal Processing', 'PyInstaller'],
    href: '/projects/respira-scope/',
    reviewHref: '/blog/respira-scope-class-design/',
    githubHref: 'https://github.com/l5769389/RespiraScope',
    capabilitiesZh: [
      '接入真实 TCP 呼吸传感器，也支持内置模拟信号。',
      '实时展示原始波形、滤波波形、峰谷标记、BPM 和稳定性。',
      '支持记录片段回看，用于异常场景分析和算法调试。',
      '通过 Web Console 提供监测、模拟配置、接口说明和运行状态。',
    ],
    capabilitiesEn: [
      'Connects to TCP respiration sensors and supports built-in simulated signals.',
      'Shows raw signals, filtered signals, peak markers, BPM, and stability in real time.',
      'Records segments for abnormal-signal review and algorithm debugging.',
      'Provides monitoring, simulation settings, API notes, and runtime status in a Web Console.',
    ],
    highlightsZh: ['实时信号链路', '异常场景回看', '工程验证工具', '可打包部署'],
    highlightsEn: ['Real-time signal pipeline', 'Abnormal-signal review', 'Engineering validation', 'Packaged deployment'],
  },
  {
    id: 'dicom-vision',
    name: 'DicomVision',
    area: 'DICOM / Medical Imaging',
    statusZh: '代表项目',
    statusEn: 'Selected',
    descriptionZh: '面向 DICOM 阅片、MPR 重建、测量分析、DICOM 标签检查和 QA 流程的医学影像工作台。',
    descriptionEn:
      'A medical imaging workbench for DICOM viewing, MPR reconstruction, measurement, DICOM tags, and QA workflows.',
    introZh:
      'DicomVision 是医学影像工作台，覆盖 DICOM 数据接入、序列管理、阅片视图、MPR/4D/3D 重建、测量分析和 QA 流程。',
    introEn:
      'DicomVision is a medical imaging workbench for DICOM loading, series management, viewing, MPR/4D/3D reconstruction, measurement, and QA workflows.',
    image: '/images/dicom-vision/theme-dark.png',
    tags: ['Vue 3', 'FastAPI', 'Electron', 'Socket.IO'],
    tech: ['Vue 3', 'FastAPI', 'Electron', 'DICOM'],
    href: '/projects/dicom-vision/',
    reviewHref: '/blog/series/dicom-vision/',
    githubHref: 'https://github.com/l5769389/DicomVisionClient',
    capabilitiesZh: [
      '支持本地 DICOM 文件、文件夹和 PACS 查询下载。',
      '提供 Stack、Compare、MPR、4D 和 3D 等多种阅片与重建视图。',
      '支持窗宽窗位、测量标注、DICOM 标签查看和脱敏导出。',
      '通过前后端分离架构把复杂影像计算放到服务端处理。',
    ],
    capabilitiesEn: [
      'Loads local DICOM files and folders, with PACS query and download workflows.',
      'Provides Stack, Compare, MPR, 4D, and 3D viewing and reconstruction modes.',
      'Supports windowing, measurements, DICOM tag inspection, and anonymized export.',
      'Uses a client-server architecture to keep heavier imaging work on the backend.',
    ],
    highlightsZh: ['医学影像工作流', 'MPR/3D 重建', '测量与 QA', 'C/S 架构'],
    highlightsEn: ['Medical imaging workflow', 'MPR/3D reconstruction', 'Measurement and QA', 'Client-server architecture'],
  },
  {
    id: 'notedock',
    name: 'noteDock',
    area: 'Local Notes / Markdown',
    statusZh: '工具项目',
    statusEn: 'Tooling',
    descriptionZh: '本地优先的 Markdown 编辑器和文档工作台，支持多格式预览、图形嵌入和知识关系整理。',
    descriptionEn:
      'A local-first Markdown editor and document workspace with previews, diagrams, and knowledge links.',
    introZh:
      'noteDock 面向个人知识库和工程写作，把 Markdown 编辑、文件工作区、多格式预览、图形内容和知识关系整理放进一个本地桌面工具。',
    introEn:
      'noteDock brings Markdown editing, file workspaces, rich previews, diagrams, and knowledge links into a local-first desktop tool.',
    image: '/images/note-dock/todo-card-mockup.png',
    tags: ['Electron', 'React', 'Markdown', 'Excalidraw'],
    tech: ['Electron', 'React', 'Milkdown', 'Excalidraw'],
    href: '/projects/notedock/',
    reviewHref: undefined,
    githubHref: 'https://github.com/l5769389/note',
    capabilitiesZh: [
      '提供 Markdown 编辑、预览和本地工作区文件管理。',
      '支持 PDF、Word、Excel、HTML 等多格式资料预览。',
      '集成 Excalidraw、Mermaid、React Flow 和思维导图等图形内容。',
      '通过标签、frontmatter、wiki link 和反向链接整理知识关系。',
    ],
    capabilitiesEn: [
      'Provides Markdown editing, preview, and local workspace file management.',
      'Previews PDF, Word, Excel, HTML, and other reference files.',
      'Integrates Excalidraw, Mermaid, React Flow, and mind-map style content.',
      'Organizes knowledge with tags, frontmatter, wiki links, and backlinks.',
    ],
    highlightsZh: ['本地优先', '多格式预览', '图形化笔记', '知识关系'],
    highlightsEn: ['Local-first', 'Multi-format preview', 'Visual notes', 'Knowledge links'],
  },
];

export type PortfolioProject = (typeof portfolioProjects)[number];

export function getProjectById(id: string) {
  return portfolioProjects.find((project) => project.id === id);
}
