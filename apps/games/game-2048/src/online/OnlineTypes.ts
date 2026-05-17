// ===== 2048 联机协议类型 =====

export interface OnlineMessage {
  type: string;
  data?: unknown;
}
