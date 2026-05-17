export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  data: any; // could be image, drawing commands, etc.
}

export class LayerStack {
  private layers: Layer[] = [];

  add(data: any, name?: string): string {
    const id = crypto.randomUUID ? crypto.randomUUID() : `layer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    this.layers.push({ id, name: name || `Layer ${this.layers.length + 1}`, visible: true, locked: false, data });
    return id;
  }

  remove(id: string): void {
    this.layers = this.layers.filter(l => l.id !== id);
  }

  get(id: string): Layer | undefined {
    return this.layers.find(l => l.id === id);
  }

  getAll(): Layer[] {
    return [...this.layers];
  }

  move(id: string, dir: 'up' | 'down'): void {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    if (dir === 'up' && idx < this.layers.length - 1) {
      [this.layers[idx], this.layers[idx + 1]] = [this.layers[idx + 1], this.layers[idx]];
    } else if (dir === 'down' && idx > 0) {
      [this.layers[idx], this.layers[idx - 1]] = [this.layers[idx - 1], this.layers[idx]];
    }
  }

  setVisibility(id: string, visible: boolean): void {
    const layer = this.get(id);
    if (layer) layer.visible = visible;
  }

  setLock(id: string, locked: boolean): void {
    const layer = this.get(id);
    if (layer) layer.locked = locked;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      if (typeof layer.data === 'string') {
        const img = new Image();
        img.src = layer.data;
        // note: synchronous rendering may need images loaded; caller should ensure ready.
        // we can draw; but better to have preloaded images. This is a simple version.
        try { ctx.drawImage(img, 0, 0); } catch {}
      } else if (layer.data instanceof Image) {
        ctx.drawImage(layer.data, 0, 0);
      } else if (typeof layer.data === 'object' && layer.data.draw) {
        layer.data.draw(ctx);
      }
    }
  }
}
