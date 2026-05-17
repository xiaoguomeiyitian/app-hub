// ===== 输入管理器（键盘 + 触控） =====

export class InputManager {
  private keys = new Set<string>()
  private interactPressed = false
  private dodgePressed = false
  private attackPressed = false

  // 虚拟摇杆状态
  private joystickDir = { dx: 0, dy: 0 }

  constructor() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase()
      this.keys.add(key)
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        this.attackPressed = true
      }
      if (e.key === 'Shift') {
        e.preventDefault()
        this.dodgePressed = true
      }
      if (key === 'q') {
        this.interactPressed = true
      }
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase())
    })
  }

  // 由虚拟摇杆调用
  setJoystickDirection(dx: number, dy: number): void {
    this.joystickDir = { dx, dy }
  }

  // 由虚拟按钮调用
  triggerAttack(): void { this.attackPressed = true }
  triggerDodge(): void { this.dodgePressed = true }
  triggerInteract(): void { this.interactPressed = true }

  getDirection(): { dx: number; dy: number } {
    // 优先键盘输入
    let dx = 0
    let dy = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) dy = -1
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy = 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx = -1
    if (this.keys.has('d') || this.keys.has('arrowright')) dx = 1

    // 如果键盘无输入，用摇杆
    if (dx === 0 && dy === 0) {
      dx = this.joystickDir.dx
      dy = this.joystickDir.dy
    }

    if (dx !== 0 && dy !== 0) {
      if (Math.random() < 0.5) return { dx, dy: 0 }
      else return { dx: 0, dy }
    }
    return { dx, dy }
  }

  shouldAttack(): boolean {
    if (this.attackPressed) { this.attackPressed = false; return true }
    return false
  }

  shouldDodge(): boolean {
    if (this.dodgePressed) { this.dodgePressed = false; return true }
    return false
  }

  shouldInteract(): boolean {
    if (this.interactPressed) { this.interactPressed = false; return true }
    return false
  }
}
