export type CharacterState = 'working' | 'patrolling' | 'idle';

export interface CharacterDef {
  id: string;
  name: string;
  shirtColor: string;
  pantsColor: string;
  allowedStations: string[];
  defaultState: CharacterState;
}

export interface StationDef {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface LeisureZoneDef {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface PatrolPoint {
  x: number;
  y: number;
}

export interface StandPos {
  x: number;
  y: number;
}

export const characters: CharacterDef[] = [
  { id: 'quan',    name: 'Quan',    shirtColor: '#4f86c6', pantsColor: '#2d4a6e', allowedStations: ['backend'],                                            defaultState: 'working'    },
  { id: 'jerry',   name: 'Jerry',   shirtColor: '#5cb85c', pantsColor: '#2d5a2d', allowedStations: ['appWebsite'],                                         defaultState: 'working'    },
  { id: 'kicko',   name: 'Kicko',   shirtColor: '#e8a838', pantsColor: '#7a4f10', allowedStations: ['sales'],                                              defaultState: 'working'    },
  { id: 'martin',  name: 'Martin',  shirtColor: '#c0392b', pantsColor: '#7b241c', allowedStations: ['sales'],                                              defaultState: 'working'    },
  { id: 'david',   name: 'David',   shirtColor: '#c678a0', pantsColor: '#5a2d4a', allowedStations: ['design'],                                             defaultState: 'working'    },
  { id: 'hippo',   name: 'Hippo',   shirtColor: '#9b59b6', pantsColor: '#4a2060', allowedStations: ['backend','appWebsite','sales','design','coordinator'], defaultState: 'working'    },
  { id: 'anton',   name: 'Anton',   shirtColor: '#1a1a1a', pantsColor: '#0a0a0a', allowedStations: ['patrol'],                                             defaultState: 'patrolling' },
  { id: 'jan',     name: 'Jan',     shirtColor: '#e67e22', pantsColor: '#7d4000', allowedStations: [],                                                     defaultState: 'idle'       },
  { id: 'krister', name: 'Krister', shirtColor: '#1abc9c', pantsColor: '#0d6655', allowedStations: [],                                                     defaultState: 'idle'       },
  { id: 'tony',    name: 'Tony',    shirtColor: '#e74c3c', pantsColor: '#7b241c', allowedStations: ['docs'],                                                defaultState: 'idle'       },
];

export const stations: StationDef[] = [
  { id: 'backend',     label: 'BACKEND',     x:  40, y:  60, width: 180, height: 120, color: '#1e3a5f' },
  { id: 'appWebsite',  label: 'APP / WEBSITE', x: 260, y:  60, width: 180, height: 120, color: '#1e5f3a' },
  { id: 'sales',       label: 'SALES',       x: 480, y:  60, width: 160, height: 120, color: '#5f3a1e' },
  { id: 'design',      label: 'DESIGN',      x: 680, y:  60, width: 160, height: 120, color: '#5f1e5f' },
  { id: 'coordinator', label: 'COORDINATOR', x: 340, y: 260, width: 160, height: 100, color: '#3a3a5f' },
];

export const leisureZones: LeisureZoneDef[] = [
  { id: 'pingis', label: 'PING PONG', x: 320, y: 420, width: 120, height:  80, color: '#2a4a2a' },
  { id: 'arcade', label: 'ARCADE',    x: 500, y: 420, width:  80, height: 100, color: '#4a2a1a' },
];

export const patrolPoints: PatrolPoint[] = [
  { x:  60, y: 280 },
  { x: 180, y: 380 },
  { x:  80, y: 420 },
  { x:  20, y: 320 },
];

export const standPositions: Record<string, StandPos> = {
  backend:     { x: 130, y: 120 },
  appWebsite:  { x: 350, y: 120 },
  sales:       { x: 560, y: 120 },
  design:      { x: 760, y: 120 },
  coordinator: { x: 420, y: 310 },
  pingis:      { x: 380, y: 460 },
  arcade:      { x: 540, y: 470 },
  patrol_0:    { x:  60, y: 280 },
  patrol_1:    { x: 180, y: 380 },
  patrol_2:    { x:  80, y: 420 },
  patrol_3:    { x:  20, y: 320 },
};

export const hippoRotationOrder = [
  'backend', 'appWebsite', 'sales', 'design', 'coordinator',
] as const;
