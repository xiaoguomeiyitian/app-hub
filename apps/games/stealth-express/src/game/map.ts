// ===== BSP 地图生成 =====

import type { MapData, Tile, Pos, MonsterType } from './types'

interface Room {
  x: number
  y: number
  w: number
  h: number
  center: Pos
}

function createEmptyMap(w: number, h: number): Tile[][] {
  const tiles: Tile[][] = []
  for (let y = 0; y < h; y++) {
    const row: Tile[] = []
    for (let x = 0; x < w; x++) {
      row.push({ type: 'wall', explored: false, visible: false })
    }
    tiles.push(row)
  }
  return tiles
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function carveRoom(tiles: Tile[][], room: Room): void {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y > 0 && y < tiles.length - 1 && x > 0 && x < tiles[0].length - 1) {
        tiles[y][x] = { type: 'floor', explored: false, visible: false }
      }
    }
  }
}

function carveCorridor(tiles: Tile[][], from: Pos, to: Pos): void {
  let x = from.x
  let y = from.y

  // 先水平再垂直
  if (Math.random() < 0.5) {
    while (x !== to.x) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
        if (tiles[y][x].type === 'wall') {
          tiles[y][x] = { type: 'floor', explored: false, visible: false }
        }
      }
      x += x < to.x ? 1 : -1
    }
    while (y !== to.y) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
        if (tiles[y][x].type === 'wall') {
          tiles[y][x] = { type: 'floor', explored: false, visible: false }
        }
      }
      y += y < to.y ? 1 : -1
    }
  } else {
    while (y !== to.y) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
        if (tiles[y][x].type === 'wall') {
          tiles[y][x] = { type: 'floor', explored: false, visible: false }
        }
      }
      y += y < to.y ? 1 : -1
    }
    while (x !== to.x) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
        if (tiles[y][x].type === 'wall') {
          tiles[y][x] = { type: 'floor', explored: false, visible: false }
        }
      }
      x += x < to.x ? 1 : -1
    }
  }
  // 确保终点也被打通
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
    if (tiles[y][x].type === 'wall') {
      tiles[y][x] = { type: 'floor', explored: false, visible: false }
    }
  }
}

function bspSplit(
  tiles: Tile[][],
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number
): Room[] {
  const MIN_ROOM = 3
  const MIN_SPLIT = MIN_ROOM * 2 + 1

  if (depth <= 0 || w < MIN_SPLIT || h < MIN_SPLIT) {
    // 叶节点：生成一个房间
    const rw = randInt(MIN_ROOM, Math.min(w - 2, 6))
    const rh = randInt(MIN_ROOM, Math.min(h - 2, 5))
    const rx = x + randInt(1, w - rw - 1)
    const ry = y + randInt(1, h - rh - 1)
    const room: Room = {
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      center: { x: Math.floor(rx + rw / 2), y: Math.floor(ry + rh / 2) },
    }
    carveRoom(tiles, room)
    return [room]
  }

  const rooms: Room[] = []
  if (w > h) {
    // 垂直分割
    const split = randInt(x + MIN_SPLIT / 2, x + w - MIN_SPLIT / 2)
    const leftRooms = bspSplit(tiles, x, y, split - x, h, depth - 1)
    const rightRooms = bspSplit(tiles, split, y, x + w - split, h, depth - 1)
    rooms.push(...leftRooms, ...rightRooms)
    // 连接左右
    if (leftRooms.length > 0 && rightRooms.length > 0) {
      const a = leftRooms[randInt(0, leftRooms.length - 1)].center
      const b = rightRooms[randInt(0, rightRooms.length - 1)].center
      carveCorridor(tiles, a, b)
    }
  } else {
    // 水平分割
    const split = randInt(y + MIN_SPLIT / 2, y + h - MIN_SPLIT / 2)
    const topRooms = bspSplit(tiles, x, y, w, split - y, depth - 1)
    const bottomRooms = bspSplit(tiles, x, split, w, y + h - split, depth - 1)
    rooms.push(...topRooms, ...bottomRooms)
    if (topRooms.length > 0 && bottomRooms.length > 0) {
      const a = topRooms[randInt(0, topRooms.length - 1)].center
      const b = bottomRooms[randInt(0, bottomRooms.length - 1)].center
      carveCorridor(tiles, a, b)
    }
  }

  return rooms
}

export function generateMap(floor: number): MapData {
  const width = Math.min(12 + floor * 2, 20)
  const height = Math.min(9 + floor, 15)
  const tiles = createEmptyMap(width, height)

  const depth = 3 + Math.floor(floor / 2)
  const rooms = bspSplit(tiles, 0, 0, width, height, depth)

  if (rooms.length < 2) {
    // 保底：至少两个房间
    return generateMap(floor)
  }

  const entry = rooms[0].center
  const exit = rooms[rooms.length - 1].center
  tiles[entry.y][entry.x] = { type: 'entry', explored: false, visible: false }
  tiles[exit.y][exit.x] = { type: 'exit', explored: false, visible: false }

  return { width, height, tiles, entry, exit }
}

// 获取房间内可用于放置物品/怪物的地板位置
export function getRoomFloorPositions(rooms: Room[]): Pos[] {
  const positions: Pos[] = []
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        positions.push({ x, y })
      }
    }
  }
  return positions
}

export function getFloorPositions(map: MapData): Pos[] {
  const positions: Pos[] = []
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.tiles[y][x].type === 'floor') {
        positions.push({ x, y })
      }
    }
  }
  return positions
}

export function pickRandomPositions(all: Pos[], count: number, exclude: Pos[]): Pos[] {
  const excludeSet = new Set(exclude.map(p => `${p.x},${p.y}`))
  const available = all.filter(p => !excludeSet.has(`${p.x},${p.y}`))
  const result: Pos[] = []
  for (let i = 0; i < Math.min(count, available.length); i++) {
    const idx = randInt(0, available.length - 1)
    result.push(available.splice(idx, 1)[0])
  }
  return result
}
