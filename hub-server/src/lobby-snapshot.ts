export type LobbyProjectLike = {
  name: string;
  description: string;
  hasRouter: boolean;
  hasSocket: boolean;
};

const LOBBY_FOCUS = '大厅初始化只读快照';

function buildProjectMap(projects: LobbyProjectLike[]): Map<string, LobbyProjectLike> {
  return new Map(projects.map((project) => [project.name, project] as const));
}

function toSnapshotItem(
  projectMap: Map<string, LobbyProjectLike>,
  name: string,
): LobbyProjectLike & { available: boolean } {
  const project = projectMap.get(name);
  return {
    name,
    description: project?.description ?? '',
    hasRouter: project?.hasRouter ?? false,
    hasSocket: project?.hasSocket ?? false,
    available: !!project,
  };
}

export function buildLobbyFoundationSnapshot(projects: LobbyProjectLike[]): {
  phase: 'v3.6';
  title: string;
  focus: string;
  coreObjects: string[];
  availableProjects: Array<LobbyProjectLike & { available: boolean }>;
} {
  const coreObjects = ['app-lobby', 'shared-backend'];
  const projectMap = buildProjectMap(projects);
  return {
    phase: 'v3.6',
    title: '应用大厅轻量化快照',
    focus: LOBBY_FOCUS,
    coreObjects,
    availableProjects: coreObjects.map((name) => toSnapshotItem(projectMap, name)),
  };
}

export function buildLobbyOnboardingSnapshot(projects: LobbyProjectLike[]): {
  phase: 'v3.6';
  title: string;
  focus: string;
  coreObjects: string[];
  steps: Array<{ name: string; description: string; available: boolean }>;
  availableProjects: Array<LobbyProjectLike & { available: boolean }>;
} {
  const coreObjects = ['app-lobby', 'shared-backend'];
  const projectMap = buildProjectMap(projects);
  const availableProjects = coreObjects.map((name) => toSnapshotItem(projectMap, name));
  return {
    phase: 'v3.6',
    title: '应用大厅轻量化引导',
    focus: LOBBY_FOCUS,
    coreObjects,
    steps: [
      { name: 'open-lobby', description: '打开大厅首页并加载项目列表', available: true },
      { name: 'browse-projects', description: '检查分类、搜索与排序是否正常', available: true },
      { name: 'open-project', description: '验证项目跳转与统计回传', available: true },
    ],
    availableProjects,
  };
}
